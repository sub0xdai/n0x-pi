import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

function formatTokens(count: number): string {
    if (!Number.isFinite(count) || count < 0) return "?";
    if (count < 1000) return String(count);
    if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
    if (count < 1000000) return `${Math.round(count / 1000)}k`;
    return `${(count / 1000000).toFixed(1)}M`;
}

function estimateTokens(text: string): number {
    return Math.round(text.length / 4);
}

export default function (pi: ExtensionAPI) {
    const update = (ctx: ExtensionContext) => {
        if (!ctx.hasUI) return;
        const text = `sys ${formatTokens(estimateTokens(ctx.getSystemPrompt()))}`;
        ctx.ui.setWidget("sys", [text], { placement: "aboveEditor" });
    };

    pi.on("session_start", async (_event, ctx) => update(ctx));
    pi.on("before_agent_start", async (_event, ctx) => update(ctx));
    pi.on("agent_end", async (_event, ctx) => update(ctx));
}
