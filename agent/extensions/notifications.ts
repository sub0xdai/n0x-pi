import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";

function notifyDesktop(title: string, body: string) {
  // Linux: notify-send (libnotify) — most distros / i3 / GNOME / KDE
  try {
    spawn("notify-send", ["-a", "pi", "-t", "5000", title, body], { stdio: "ignore", detached: true }).unref();
    return;
  } catch {}
  // macOS fallback
  try {
    spawn("osascript", ["-e", `display notification "${body}" with title "${title}"`], {
      stdio: "ignore",
      detached: true,
    }).unref();
  } catch {}
}

function osc777(title: string, body: string) {
  // OSC 777 — terminals that support it (alacritty, foot, ghostty, kitty when configured)
  try {
    process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
  } catch {}
}

export default function (pi: ExtensionAPI) {
  let lastToolStart = 0;
  const LONG_TASK_MS = 10_000;

  pi.on("tool_execution_start", async (event) => {
    if (["bash", "write"].includes(event.toolName)) {
      lastToolStart = Date.now();
    }
  });

  pi.on("tool_execution_end", async (event) => {
    if (lastToolStart && Date.now() - lastToolStart > LONG_TASK_MS) {
      const duration = Math.round((Date.now() - lastToolStart) / 1000);
      const title = "pi: long task done";
      const body = `${event.toolName ?? "tool"} took ${duration}s`;
      osc777(title, body);
      notifyDesktop(title, body);
    }
    lastToolStart = 0;
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    const title = "pi";
    const body = "Ready for next command";
    osc777(title, body);
    notifyDesktop(title, body);
  });
}
