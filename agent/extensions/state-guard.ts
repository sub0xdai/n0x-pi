import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
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
  nudged: boolean;
}

type Outcome =
  | { kind: "read"; path: string; ok: boolean }
  | { kind: "mutate"; path: string; ok: boolean }
  | { kind: "verify" }
  | { kind: "nudged" };

const INITIAL: Observed = { read: new Set(), dirty: new Set(), nudged: false };

const VERIFY_COMMAND =
  /\b(test|check|lint|build|clippy|typecheck|tsc|pytest|ruff|mypy|eslint|biome|gradle)\b/;

function assertInvariant(state: Observed): Observed {
  for (const path of state.dirty) {
    if (!state.read.has(path)) {
      throw new Error(`state-guard: dirty path was never observed as read: ${path}`);
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
      return { ...state, dirty: new Set(), nudged: false };
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
  });

  pi.on("agent_before_settle", async (event, ctx) => {
    if (event.outcome !== "completed") return;
    if (state.dirty.size === 0 || state.nudged) return;
    state = reduce(state, { kind: "nudged" });
    render(ctx);
    return {
      entries: [
        {
          type: "custom_message",
          customType: "state-guard",
          content:
            `Unverified mutations this turn: ${[...state.dirty].join(", ")}. ` +
            "Run the project check (test, lint, or build) before finishing.",
          display: true,
        },
      ],
      continue: true,
    };
  });
}
