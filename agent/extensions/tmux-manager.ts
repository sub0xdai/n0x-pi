import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { execSync, spawn } from "node:child_process";

const HELP =
  "Tmux Commands:\n" +
  "  /tmux list                 - List sessions\n" +
  "  /tmux new <name> [cmd]     - Create detached session\n" +
  "  /tmux attach <name>        - Attach (exits pi temporarily)\n" +
  "  /tmux send <name> <cmd>    - Send command to session\n" +
  "  /tmux capture <name>       - Print pane content\n" +
  "  /tmux kill <name>          - Kill session";

const MAX_LINES = 200;

function execTmux(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("tmux", args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr?.on("data", (chunk) => (stderr += chunk.toString()));
    proc.on("close", (code) =>
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code || 0 }),
    );
    proc.on("error", (error) => resolve({ stdout: "", stderr: error.message, code: -1 }));
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
  const failure = (text: string) => ({
    content: [{ type: "text" as const, text }],
    isError: true,
    details: {},
  });

  const NOT_INSTALLED = failure("Error: tmux not installed");

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
      const result = await execTmux(args);
      if (result.code !== 0) return failure(`Error: ${result.stderr}`);
      return {
        content: [
          { type: "text", text: `✓ Session '${params.name}' started\n$ ${params.command}` },
        ],
        details: { session: params.name },
      };
    },
  });

  pi.registerTool({
    name: "tmux_capture_pane",
    label: "Tmux: Capture Pane",
    description: "Read the visible content of a tmux session. Use to check on background jobs.",
    parameters: Type.Object({
      session: Type.String({ description: "Session name" }),
      target: Type.Optional(Type.String({ description: "Target pane (default: active)" })),
    }),
    async execute(_id, params) {
      if (!hasTmux()) return NOT_INSTALLED;
      const target = params.target || params.session;
      const result = await execTmux(["capture-pane", "-p", "-t", target]);
      if (result.code !== 0) return failure(`Error: ${result.stderr}`);
      const lines = result.stdout.split("\n");
      const tail = lines.slice(-MAX_LINES).join("\n");
      const truncated =
        lines.length > MAX_LINES ? `${tail}\n... (truncated to last ${MAX_LINES} lines)` : tail;
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
      enter: Type.Optional(
        Type.Boolean({ description: "Press Enter after sending", default: true }),
      ),
    }),
    async execute(_id, params) {
      if (!hasTmux()) return NOT_INSTALLED;
      const args = ["send-keys", "-t", params.session, params.keys];
      if (params.enter !== false) args.push("Enter");
      const result = await execTmux(args);
      if (result.code !== 0) return failure(`Error: ${result.stderr}`);
      return {
        content: [{ type: "text", text: `✓ Sent to '${params.session}': ${params.keys}` }],
        details: {},
      };
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
      const result = await execTmux(["kill-session", "-t", params.name]);
      if (result.code !== 0) return failure(`Error: ${result.stderr}`);
      return { content: [{ type: "text", text: `✓ Killed '${params.name}'` }], details: {} };
    },
  });

  pi.registerCommand("tmux", {
    description: "Manage tmux sessions for background work",
    handler: async (args, ctx) => {
      if (!hasTmux()) {
        ctx.ui.notify("tmux not installed", "error");
        return;
      }

      const [command, name, ...rest] = args?.split(" ") || [];
      const missing = (usage: string) => ctx.ui.notify(`Usage: ${usage}`, "error");

      switch (command) {
        case "list": {
          const result = await execTmux(["list-sessions"]);
          ctx.ui.notify(result.stdout || "No active sessions", "info");
          break;
        }
        case "new": {
          if (!name) return missing("/tmux new <name> [command]");
          const launched = rest.join(" ") || "bash";
          await execTmux(["new-session", "-d", "-s", name, launched]);
          ctx.ui.notify(`✓ Created '${name}'  $ ${launched}`, "info");
          break;
        }
        case "attach": {
          if (!name) return missing("/tmux attach <name>");
          await execTmux(["attach-session", "-t", name]);
          break;
        }
        case "kill": {
          if (!name) return missing("/tmux kill <name>");
          await execTmux(["kill-session", "-t", name]);
          ctx.ui.notify(`✓ Killed '${name}'`, "info");
          break;
        }
        case "send": {
          if (!name || !rest.length) return missing("/tmux send <name> <command>");
          await execTmux(["send-keys", "-t", name, rest.join(" "), "Enter"]);
          ctx.ui.notify(`✓ Sent to '${name}'`, "info");
          break;
        }
        case "capture": {
          if (!name) return missing("/tmux capture <name>");
          const result = await execTmux(["capture-pane", "-p", "-t", name]);
          ctx.ui.notify(result.stdout || "Empty session", "info");
          break;
        }
        default:
          ctx.ui.notify(HELP, "info");
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!hasTmux()) return;
    const result = await execTmux(["list-sessions"]);
    if (result.stdout) {
      const count = result.stdout.split("\n").length;
      ctx.ui.notify(`tmux: ${count} active session(s)`, "info");
    }
  });
}
