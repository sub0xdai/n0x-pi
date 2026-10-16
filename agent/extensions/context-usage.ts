import assert from "node:assert";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "context-tokens";
const SET_SEGMENT = "editor:set-status-segment";
const REMOVE_SEGMENT = "editor:remove-status-segment";

function formatTokens(count: number): string {
  assert(Number.isFinite(count) && count >= 0);
  const text =
    count < 1000
      ? String(Math.round(count))
      : count < 1_000_000
        ? `${Math.round(count / 1000)}k`
        : `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  assert(text.length > 0);
  return text;
}

export function segmentText(tokens: number, contextWindow: number): string {
  assert(contextWindow > 0);
  const text = `${formatTokens(tokens)}/${formatTokens(contextWindow)}`;
  assert(text.length > 0);
  return text;
}

export default function (pi: ExtensionAPI) {
  const sync = (ctx: ExtensionContext) => {
    const usage = ctx.getContextUsage();
    if (!usage || usage.tokens === null) {
      pi.events.emit(REMOVE_SEGMENT, { key: STATUS_KEY });
      return;
    }
    assert(usage.contextWindow > 0);
    const text = segmentText(usage.tokens, usage.contextWindow);
    assert(text.length > 0);
    pi.events.emit(SET_SEGMENT, {
      key: STATUS_KEY,
      text,
      align: "right",
      priority: -1,
    });
  };

  pi.on("session_start", async (_event, ctx) => sync(ctx));
  pi.on("model_select", async (_event, ctx) => sync(ctx));
  pi.on("tool_execution_end", async (_event, ctx) => sync(ctx));
  pi.on("agent_end", async (_event, ctx) => sync(ctx));
  pi.on("session_compact", async (_event, ctx) => sync(ctx));
  pi.on("session_shutdown", () => {
    pi.events.emit(REMOVE_SEGMENT, { key: STATUS_KEY });
  });
}
