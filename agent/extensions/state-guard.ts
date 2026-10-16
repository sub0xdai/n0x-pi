import { execFile } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
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
    const { stdout } = await runGate(GATE, [file], { timeout: 15_000 });
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

export default function stateGuard(pi: ExtensionAPI) {
  let state: Observed = INITIAL;

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
    return undefined;
  });

  pi.on("tool_result", async (event, ctx) => {
    const outcome = outcomeOf(event);
    if (outcome !== undefined) record(ctx.cwd, outcome);
    render(ctx);
    const raw = event.isError ? undefined : writtenPath(event);
    if (raw === undefined) return undefined;
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
