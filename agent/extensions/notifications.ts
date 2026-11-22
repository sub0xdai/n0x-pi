import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const LONG_TASK_MS = 10_000;

function launch(command: string, args: string[]) {
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}

function notifyDesktop(title: string, body: string) {
  try {
    launch("notify-send", ["-a", "pi", "-t", "5000", title, body]);
    return;
  } catch {}
  try {
    launch("osascript", ["-e", `display notification "${body}" with title "${title}"`]);
  } catch {}
}

function osc777(title: string, body: string) {
  try {
    process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
  } catch {}
}

export default function (pi: ExtensionAPI) {
  let lastToolStartMs = 0;

  pi.on("tool_execution_start", async (event) => {
    if (["bash", "write"].includes(event.toolName)) {
      lastToolStartMs = Date.now();
    }
  });

  pi.on("tool_execution_end", async (event) => {
    const elapsedMs = lastToolStartMs === 0 ? 0 : Date.now() - lastToolStartMs;
    if (elapsedMs > LONG_TASK_MS) {
      const durationSec = Math.round(elapsedMs / 1000);
      const title = "pi: long task done";
      const body = `${event.toolName ?? "tool"} took ${durationSec}s`;
      osc777(title, body);
      notifyDesktop(title, body);
    }
    lastToolStartMs = 0;
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    osc777("pi", "Ready for next command");
    notifyDesktop("pi", "Ready for next command");
  });
}
