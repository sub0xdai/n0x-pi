import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface PlanState {
  enabled: boolean;
  planFile: string;
  steps: Array<{
    id: string;
    description: string;
    status: "pending" | "in-progress" | "completed" | "skipped";
    timestamp: number;
  }>;
  currentStep: number;
}

async function resolvePlanFile(): Promise<string> {
  try {
    await fs.access(".specify");
    await fs.mkdir(".specify/scratch", { recursive: true });
    return ".specify/scratch/PLAN.md";
  } catch {
    return "PLAN.md";
  }
}

export default function (pi: ExtensionAPI) {
  const planState: PlanState = {
    enabled: false,
    planFile: "PLAN.md",
    steps: [],
    currentStep: 0,
  };

  async function savePlan() {
    const content = `# Plan

**Status**: ${planState.enabled ? "Active" : "Inactive"}
**Last Updated**: ${new Date().toISOString()}

## Steps

${planState.steps
  .map(
    (step, i) => `### ${i + 1}. ${step.description}
- **Status**: ${step.status}
- **ID**: ${step.id}
`
  )
  .join("\n")}
`;
    await fs.mkdir(path.dirname(planState.planFile), { recursive: true }).catch(() => {});
    fs.writeFile(planState.planFile, content).catch(console.error);
  }

  function generateId() {
    return Math.random().toString(36).substring(2, 9);
  }

  pi.registerCommand("plan", {
    description: "Toggle plan mode or manage plan steps",
    handler: async (args, ctx) => {
      const [cmd, ...rest] = args?.split(" ") || [];

      switch (cmd) {
        case "start":
          planState.enabled = true;
          planState.steps = [];
          planState.currentStep = 0;
          planState.planFile = await resolvePlanFile();
          await savePlan();
          ctx.ui.notify(`Plan mode: ON  (file: ${planState.planFile})`, "success");
          ctx.ui.notify("Use /plan add <description> to add steps", "info");
          break;

        case "stop":
          planState.enabled = false;
          await savePlan();
          ctx.ui.notify("Plan mode: OFF", "info");
          break;

        case "add": {
          if (!rest.length) {
            ctx.ui.notify("Usage: /plan add <description>", "error");
            return;
          }
          const step = {
            id: generateId(),
            description: rest.join(" "),
            status: "pending" as const,
            timestamp: Date.now(),
          };
          planState.steps.push(step);
          await savePlan();
          ctx.ui.notify(`Added step: ${step.description}`, "success");
          break;
        }

        case "done":
          if (planState.currentStep >= planState.steps.length) {
            ctx.ui.notify("No more steps!", "info");
            return;
          }
          planState.steps[planState.currentStep].status = "completed";
          planState.currentStep++;
          await savePlan();
          ctx.ui.notify(
            `Step completed! ${planState.currentStep}/${planState.steps.length}`,
            "success"
          );
          break;

        case "status": {
          const status = planState.steps
            .map((s, i) => `  ${i + 1}. [${s.status.toUpperCase()}] ${s.description}`)
            .join("\n");
          ctx.ui.notify(`Plan Status:\n${status || "No steps yet"}`, "info");
          break;
        }

        case "clear":
          planState.steps = [];
          planState.currentStep = 0;
          await savePlan();
          ctx.ui.notify("Plan cleared", "info");
          break;

        default:
          ctx.ui.notify(
            "Plan Mode Commands:\n" +
              "  /plan start  - Enable plan mode\n" +
              "  /plan stop   - Disable plan mode\n" +
              "  /plan add <desc> - Add step\n" +
              "  /plan done   - Mark current step done\n" +
              "  /plan status - Show progress\n" +
              "  /plan clear  - Clear all steps",
            "info"
          );
      }
    },
  });

  // Gate destructive tool calls when plan mode is active
  pi.on("tool_call", async (event, ctx) => {
    if (!planState.enabled) return;
    const destructive = ["write", "edit", "bash", "delete"];
    if (!destructive.includes(event.toolName)) return;

    const current = planState.steps[planState.currentStep]?.description || "current step";
    const approved = await ctx.ui.confirm(
      "Plan Mode",
      `Execute ${event.toolName}?  (${current})`
    );
    if (!approved) {
      return { block: true, reason: "Plan mode requires approval" };
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    const candidates = [".specify/scratch/PLAN.md", "PLAN.md"];
    for (const p of candidates) {
      try {
        await fs.access(p);
        planState.planFile = p;
        ctx.ui.notify(`Previous plan found at ${p}. Use /plan status to review.`, "info");
        return;
      } catch {}
    }
  });
}
