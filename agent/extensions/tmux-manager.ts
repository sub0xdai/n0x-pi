import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { spawn, execSync } from "node:child_process";

function execTmux(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("tmux", args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) =>
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code || 0 })
    );
    proc.on("error", (err) => resolve({ stdout: "", stderr: err.message, code: -1 }));
  });
}

function hasTmux(): boolean {
  try {
    execSync("which tmux", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export default function (pi: ExtensionAPI) {
  const NOT_INSTALLED = {
    content: [{ type: "text" as const, text: "Error: tmux not installed" }],
    isError: true,
    details: {},
  };

  // ============== Tools (LLM-callable) ==============

  pi.registerTool({
    name: "tmux_new_session",
    label: "Tmux: New Session",
    description: "Create a detached tmux session running a command. Use for long jobs.",
    parameters: Type.Object({
      name: Type.String({ description: "Session name" }),
      command: Type.String({ description: "Command to run" }),
      cwd: Type.Optional(Type.String({ description: "Working directory" })),
    }),
    async execute(_id, params) {
      if (!hasTmux()) return NOT_INSTALLED;
      const args = ["new-session", "-d", "-s", params.name];
      if (params.cwd) args.unshift("-c", params.cwd);
      args.push(params.command);
      const r = await execTmux(args);
      if (r.code !== 0)
        return { content: [{ type: "text", text: `Error: ${r.stderr}` }], isError: true, details: {} };
      return {
        content: [{ type: "text", text: `✓ Session '${params.name}' started\n$ ${params.command}` }],
        details: { session: params.name },
      };
    },
  });

  pi.registerTool({
    name: "tmux_capture_pane",
    label: "Tmux: Capture Pane",
    description: "Read the current visible content of a tmux session — use to check on background jobs.",
    parameters: Type.Object({
      session: Type.String({ description: "Session name" }),
      target: Type.Optional(Type.String({ description: "Target pane (default: active)" })),
    }),
    async execute(_id, params) {
      if (!hasTmux()) return NOT_INSTALLED;
      const r = await execTmux(["capture-pane", "-p", "-t", params.target || params.session]);
      if (r.code !== 0)
        return { content: [{ type: "text", text: `Error: ${r.stderr}` }], isError: true, details: {} };
      const lines = r.stdout.split("\n");
      const truncated =
        lines.length > 200 ? lines.slice(-200).join("\n") + "\n... (truncated to last 200 lines)" : r.stdout;
      return {
        content: [{ type: "text", text: `Session: ${params.session}\n\n${truncated}` }],
        details: { session: params.session, lines: lines.length },
      };
    },
  });

  pi.registerTool({
    name: "tmux_send_keys",
    label: "Tmux: Send Keys",
    description: "Send keys/commands to a tmux session.",
    parameters: Type.Object({
      session: Type.String({ description: "Session name" }),
      keys: Type.String({ description: "Keys or command to send" }),
      enter: Type.Optional(Type.Boolean({ description: "Press Enter after sending", default: true })),
    }),
    async execute(_id, params) {
      if (!hasTmux()) return NOT_INSTALLED;
      const args = ["send-keys", "-t", params.session, params.keys];
      if (params.enter !== false) args.push("Enter");
      const r = await execTmux(args);
      if (r.code !== 0)
        return { content: [{ type: "text", text: `Error: ${r.stderr}` }], isError: true, details: {} };
      return { content: [{ type: "text", text: `✓ Sent to '${params.session}': ${params.keys}` }], details: {} };
    },
  });

  pi.registerTool({
    name: "tmux_kill_session",
    label: "Tmux: Kill Session",
    description: "Terminate a tmux session.",
    parameters: Type.Object({
      name: Type.String({ description: "Session name to kill" }),
    }),
    async execute(_id, params) {
      if (!hasTmux()) return NOT_INSTALLED;
      const r = await execTmux(["kill-session", "-t", params.name]);
      if (r.code !== 0)
        return { content: [{ type: "text", text: `Error: ${r.stderr}` }], isError: true, details: {} };
      return { content: [{ type: "text", text: `✓ Killed '${params.name}'` }], details: {} };
    },
  });

  // ============== Slash command (user-facing) ==============

  pi.registerCommand("tmux", {
    description: "Manage tmux sessions for background work",
    handler: async (args, ctx) => {
      if (!hasTmux()) {
        ctx.ui.notify("tmux not installed", "error");
        return;
      }

      const [cmd, sessionName, ...rest] = args?.split(" ") || [];

      switch (cmd) {
        case "list": {
          const r = await execTmux(["list-sessions"]);
          ctx.ui.notify(r.stdout || "No active sessions", "info");
          break;
        }
        case "new": {
          if (!sessionName) {
            ctx.ui.notify("Usage: /tmux new <name> [command]", "error");
            return;
          }
          const command = rest.join(" ") || "bash";
          await execTmux(["new-session", "-d", "-s", sessionName, command]);
          ctx.ui.notify(`✓ Created '${sessionName}'  $ ${command}`, "success");
          break;
        }
        case "attach": {
          if (!sessionName) {
            ctx.ui.notify("Usage: /tmux attach <name>", "error");
            return;
          }
          await execTmux(["attach-session", "-t", sessionName]);
          break;
        }
        case "kill": {
          if (!sessionName) {
            ctx.ui.notify("Usage: /tmux kill <name>", "error");
            return;
          }
          await execTmux(["kill-session", "-t", sessionName]);
          ctx.ui.notify(`✓ Killed '${sessionName}'`, "success");
          break;
        }
        case "send": {
          if (!sessionName || !rest.length) {
            ctx.ui.notify("Usage: /tmux send <name> <command>", "error");
            return;
          }
          await execTmux(["send-keys", "-t", sessionName, rest.join(" "), "Enter"]);
          ctx.ui.notify(`✓ Sent to '${sessionName}'`, "success");
          break;
        }
        case "capture": {
          if (!sessionName) {
            ctx.ui.notify("Usage: /tmux capture <name>", "error");
            return;
          }
          const r = await execTmux(["capture-pane", "-p", "-t", sessionName]);
          ctx.ui.notify(r.stdout || "Empty session", "info");
          break;
        }
        default:
          ctx.ui.notify(
            "Tmux Commands:\n" +
              "  /tmux list                 - List sessions\n" +
              "  /tmux new <name> [cmd]     - Create detached session\n" +
              "  /tmux attach <name>        - Attach (exits pi temporarily)\n" +
              "  /tmux send <name> <cmd>    - Send command to session\n" +
              "  /tmux capture <name>       - Print pane content\n" +
              "  /tmux kill <name>          - Kill session",
            "info"
          );
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!hasTmux()) return;
    const r = await execTmux(["list-sessions"]);
    if (r.stdout) {
      const count = r.stdout.split("\n").length;
      ctx.ui.notify(`tmux: ${count} active session(s)`, "info");
    }
  });
}
