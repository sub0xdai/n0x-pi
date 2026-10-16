import { execFile } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";

type Phase = "DISCOVER" | "MUTATE" | "VERIFY";

interface Observed {
  read: ReadonlySet<string>;
  dirty: ReadonlySet<string>;
  violations: Readonly<Record<string, string>>;
  nudged: boolean;
}

type Outcome =
  | { kind: "read"; path: string; ok: boolean }
  | { kind: "mutate"; path: string; ok: boolean }
  | { kind: "violated"; path: string; detail: string }
  | { kind: "clean"; path: string }
  | { kind: "verify" }
  | { kind: "nudged" };

const INITIAL: Observed = { read: new Set(), dirty: new Set(), violations: {}, nudged: false };

const GATE = join(homedir(), ".pi", "agent", "scripts", "__check.sh");

const RUN_OPTIONS = { encoding: "utf8" as const, timeout: 15_000 };

const runGate = promisify(execFile);

const VERIFY_COMMAND =
  /\b(test|check|lint|build|clippy|typecheck|tsc|pytest|ruff|mypy|eslint|biome|gradle)\b/;

function assertInvariant(state: Observed): Observed {
  for (const path of state.dirty) {
    if (!state.read.has(path)) {
      throw new Error(`state-guard: dirty path was never observed as read: ${path}`);
    }
  }
  for (const path of Object.keys(state.violations)) {
    if (!state.dirty.has(path)) {
      throw new Error(`state-guard: violation recorded for a path that is not dirty: ${path}`);
    }
  }
  return state;
}

function step(state: Observed, outcome: Outcome): Observed {
  switch (outcome.kind) {
    case "read": {
      if (!outcome.ok) return state;
      return { ...state, read: new Set(state.read).add(outcome.path) };
    }
    case "mutate": {
      if (!outcome.ok) return state;
      return {
        ...state,
        read: new Set(state.read).add(outcome.path),
        dirty: new Set(state.dirty).add(outcome.path),
        nudged: false,
      };
    }
    case "verify": {
      return { ...state, dirty: new Set(), violations: {}, nudged: false };
    }
    case "violated": {
      return {
        ...state,
        read: new Set(state.read).add(outcome.path),
        dirty: new Set(state.dirty).add(outcome.path),
        violations: { ...state.violations, [outcome.path]: outcome.detail },
        nudged: false,
      };
    }
    case "clean": {
      if (!(outcome.path in state.violations)) return state;
      const next = { ...state.violations };
      delete next[outcome.path];
      return { ...state, violations: next };
    }
    case "nudged": {
      return { ...state, nudged: true };
    }
  }
}

function reduce(state: Observed, outcome: Outcome): Observed {
  return assertInvariant(step(state, outcome));
}

function phaseOf(state: Observed): Phase {
  if (state.dirty.size > 0) return "VERIFY";
  if (state.read.size > 0) return "MUTATE";
  return "DISCOVER";
}

function normalizePath(cwd: string, raw: string): string {
  if (raw.length === 0 || cwd.length === 0) {
    throw new Error("state-guard: path and working directory must both be non-empty");
  }
  const unmarked = raw.startsWith("@") ? raw.slice(1) : raw;
  const expanded =
    unmarked === "~" || unmarked.startsWith("~/")
      ? resolve(homedir(), unmarked.slice(1))
      : unmarked;
  const full = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
  let canonical = full;
  try {
    canonical = realpathSync.native(full);
  } catch {
    canonical = full;
  }
  if (!isAbsolute(canonical)) {
    throw new Error(`state-guard: path did not resolve to an absolute path: ${raw}`);
  }
  return canonical;
}

function blindMutation(state: Observed, cwd: string, event: ToolCallEvent): string | undefined {
  if (event.toolName !== "edit" && event.toolName !== "write") return undefined;
  const raw = event.input.path;
  const full = normalizePath(cwd, raw);
  if (!existsSync(full) || state.read.has(full)) return undefined;
  const blocked = `${event.toolName} refused: ${raw} exists and was not read in this session.`;
  return `${blocked} Read it, then repeat the ${event.toolName}.`;
}

function outcomeOf(event: ToolResultEvent): Outcome | undefined {
  const input = event.input as Record<string, unknown>;
  const raw = typeof input.path === "string" ? input.path : undefined;
  if (event.toolName === "read" && raw) {
    return { kind: "read", path: raw, ok: !event.isError };
  }
  if ((event.toolName === "edit" || event.toolName === "write") && raw) {
    return { kind: "mutate", path: raw, ok: !event.isError };
  }
  if (event.toolName === "bash" || event.toolName === "powershell") {
    const command = typeof input.command === "string" ? input.command : "";
    if (!event.isError && VERIFY_COMMAND.test(command)) return { kind: "verify" };
  }
  return undefined;
}

function writtenPath(event: ToolResultEvent): string | undefined {
  if (event.toolName !== "edit" && event.toolName !== "write") return undefined;
  const input = event.input as Record<string, unknown>;
  return typeof input.path === "string" ? input.path : undefined;
}

async function gateViolations(file: string): Promise<string[]> {
  try {
    const { stdout } = await runGate(GATE, [file], RUN_OPTIONS);
    const parsed: unknown = JSON.parse(stdout);
    if (!Array.isArray(parsed)) return [`the gate did not return a list for ${file}`];
    return parsed.map((item) => {
      const violation = item as { rule?: string; line?: number; message?: string };
      const rule = violation.rule ?? "unknown";
      return `${rule} line ${violation.line ?? 0}: ${violation.message ?? "violation"}`;
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return [`the gate did not run: ${detail}`];
  }
}

const MAX_SHELL_GATED = 10;

const GATED_SUFFIX = new RegExp(
  "\\.(ts|tsx|js|jsx|mjs|cjs|sh|bash|py|rb|rs|go|java|c|cc|cpp|h|hpp|swift|kt" +
    "|json|jsonl|md|toml|yml|yaml|sql|conf)([\\s\"';)|]|$)"
);

const IN_PLACE_EDIT = /\b(?:sed|perl)\s+-[a-zA-Z]*i|\bdd\b[^|;&]*\bof=|\btruncate\s+/;

const TEMP_PREFIXES = ["/tmp/", "/dev/null", "/dev/stdout", "/dev/stderr", "/var/folders/"];

function isTemporary(target: string): boolean {
  const environmentTmp = tmpdir();
  const prefixes = environmentTmp ? [...TEMP_PREFIXES, `${environmentTmp}/`] : TEMP_PREFIXES;
  return prefixes.some((prefix) => target.startsWith(prefix));
}

function shellWriteTargets(command: string): string[] {
  const targets: string[] = [];
  const redirect = /(?:^|[\s;&|()])(>>?)\s*("([^"]+)"|'([^']+)'|([^\s|;&>()]+))/g;
  for (const match of command.matchAll(redirect)) {
    const target = match[3] ?? match[4] ?? match[5];
    if (target) targets.push(target);
  }
  const tee = /\btee\b\s*(?:-a\s*)?("([^"]+)"|'([^']+)'|([^\s|;&>()]+))/g;
  for (const match of command.matchAll(tee)) {
    const target = match[2] ?? match[3] ?? match[4];
    if (target) targets.push(target);
  }
  if (IN_PLACE_EDIT.test(command) && GATED_SUFFIX.test(command)) targets.push(command);
  return targets;
}

function shellWriteBlock(command: string, cwd: string): string | undefined {
  for (const target of shellWriteTargets(command)) {
    if (!GATED_SUFFIX.test(target)) continue;
    if (target.includes("$(")) continue;
    const absolute = isAbsolute(target) ? target : resolve(cwd, target);
    if (isTemporary(absolute)) continue;
    const head = `State invariant violation: bash writing ${target} is not gated.`;
    return `${head} Use the edit or write tool so state-guard can verify the change.`;
  }
  return undefined;
}

const FINGERPRINT_STATUS = /^\s*(\S{1,2})\s+(.+)$/;

async function gitFingerprint(cwd: string): Promise<Map<string, string> | undefined> {
  try {
    const { stdout } = await runGate("git", ["status", "--porcelain", "-uall"], {
      ...RUN_OPTIONS,
      cwd,
    });
    const print = new Map<string, string>();
    for (const line of stdout.split("\n")) {
      const parsed = FINGERPRINT_STATUS.exec(line);
      if (!parsed) continue;
      const raw = parsed[2].trim();
      const path = raw.includes(" -> ") ? raw.slice(raw.indexOf(" -> ") + 4) : raw;
      const full = resolve(cwd, path.replace(/^"|"$/g, ""));
      try {
        const info = statSync(full);
        print.set(full, `${parsed[1]}|${info.size}|${info.mtimeMs}`);
      } catch {
        print.set(full, `${parsed[1]}|deleted`);
      }
    }
    return print;
  } catch {
    return undefined;
  }
}

function advancedPaths(before: Map<string, string>, after: Map<string, string>): string[] {
  const advanced: string[] = [];
  for (const [path, fingerprint] of after) {
    if (before.get(path) !== fingerprint) advanced.push(path);
  }
  return advanced;
}

export default function stateGuard(pi: ExtensionAPI) {
  let state: Observed = INITIAL;
  const snapshots = new Map<string, Map<string, string>>();

  async function gateShellSideEffects(event: ToolResultEvent, cwd: string): Promise<string[]> {
    if (event.toolName !== "bash" && event.toolName !== "powershell") return [];
    const before = snapshots.get(event.toolCallId);
    snapshots.delete(event.toolCallId);
    if (before === undefined) return [];
    const after = await gitFingerprint(cwd);
    if (after === undefined) return [];
    const notes: string[] = [];
    for (const path of advancedPaths(before, after).slice(0, MAX_SHELL_GATED)) {
      if (isTemporary(path)) continue;
      const violations = await gateViolations(path);
      if (violations.length === 0) {
        record(cwd, { kind: "clean", path });
        continue;
      }
      record(cwd, { kind: "violated", path, detail: violations.join(" | ") });
      notes.push(`[state-guard] bash changed ${path}, and __check.sh rejected it:`);
      notes.push(...violations.map((violation) => `  ${violation}`));
    }
    return notes;
  }

  function render(ctx: ExtensionContext): void {
    if (ctx.mode !== "tui") return;
    ctx.ui.setStatus(
      "state-guard",
      `[${phaseOf(state)} read:${state.read.size} dirty:${state.dirty.size}]`
    );
  }

  function record(cwd: string, outcome: Outcome): void {
    const target = "path" in outcome ? outcome.path : undefined;
    const normalized =
      target === undefined ? outcome : { ...outcome, path: normalizePath(cwd, target) };
    state = reduce(state, normalized);
  }

  pi.on("session_start", async (_event, ctx) => {
    state = INITIAL;
    render(ctx);
  });

  pi.on("tool_call", async (event, ctx) => {
    const reason = blindMutation(state, ctx.cwd, event);
    if (reason !== undefined) return { block: true, reason };
    if (event.toolName === "bash" || event.toolName === "powershell") {
      const command = String((event.input as Record<string, unknown>).command ?? "");
      const shellReason = shellWriteBlock(command, ctx.cwd);
      if (shellReason !== undefined) return { block: true, reason: shellReason };
      const fingerprint = await gitFingerprint(ctx.cwd);
      if (fingerprint !== undefined) snapshots.set(event.toolCallId, fingerprint);
    }
    return undefined;
  });

  pi.on("tool_result", async (event, ctx) => {
    const outcome = outcomeOf(event);
    if (outcome !== undefined) record(ctx.cwd, outcome);
    render(ctx);
    const raw = event.isError ? undefined : writtenPath(event);
    if (raw === undefined) {
      const shellTouched = await gateShellSideEffects(event, ctx.cwd);
      if (shellTouched.length === 0) return undefined;
      const text = shellTouched.join("\n");
      return { content: [...event.content, { type: "text" as const, text }] };
    }
    const full = normalizePath(ctx.cwd, raw);
    const violations = await gateViolations(full);
    if (violations.length === 0) {
      record(ctx.cwd, { kind: "clean", path: full });
      return undefined;
    }
    record(ctx.cwd, { kind: "violated", path: full, detail: violations.join(" | ") });
    const block = `[state-guard] __check.sh rejected ${raw}:\n${violations.join("\n")}`;
    return { content: [...event.content, { type: "text" as const, text: block }] };
  });

  pi.on("agent_before_settle", async (event, ctx) => {
    if (event.outcome !== "completed") return;
    if (state.dirty.size === 0 || state.nudged) return;
    state = reduce(state, { kind: "nudged" });
    render(ctx);
    const failing = Object.entries(state.violations)
      .slice(0, 3)
      .map(([path, detail]) => `${path}: ${detail}`);
    const gateNote =
      failing.length === 0
        ? ""
        : ` The mechanical gate is failing on ${failing.join("; ")}.`;
    return {
      entries: [
        {
          type: "custom_message",
          customType: "state-guard",
          content:
            `Unverified mutations this turn: ${[...state.dirty].join(", ")}.` +
            `${gateNote} Fix every violation, then run the project check.`,
          display: true,
        },
      ],
      continue: true,
    };
  });
}
