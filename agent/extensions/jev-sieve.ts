/**
 * jev-sieve.ts - Jev-judged context sieve for large tool results.
 *
 * Every large read/bash/grep result is judged block by block before it enters
 * context. Blocks the judge is confident are irrelevant to the current task are
 * replaced with a short stub naming a file that holds the full text. Nothing is
 * lost: the agent can read the file back, including with an offset and limit.
 *
 * Why this surface: context is the one resource a judgment can actually save.
 * See ~/.pi/typesafe-jev-assessment.md section 8.3 for the method and the
 * projects it is taken from.
 *
 * Discipline, taken from prism-liquidity-agent's three-commit arc:
 *   - shadow first: log the decision, change nothing, calibrate later
 *   - bounded action: hide a block, never drop the result or refuse the tool
 *   - fail open: no key, timeout, or parse failure leaves the result untouched
 *   - never resolve uncertainty: an uncertain block is kept verbatim
 *
 * Two safety rules are not configurable, following winnow:
 *   - a result flagged as an error is never altered
 *   - a block whose probability is uncertain is kept
 *
 * Modes (JEV_SIEVE):
 *   off     do nothing
 *   shadow  judge and log, never modify                                  (default)
 *   on      judge and replace confident-irrelevant blocks with a stub
 *
 * Tuning (env): JEV_SIEVE_MIN_CHARS, JEV_SIEVE_BLOCK_LINES,
 * JEV_SIEVE_THRESHOLD, JEV_SIEVE_MARGIN, JEV_SIEVE_TOOLS,
 * JEV_SIEVE_MAX_BATCH_CHARS, JEV_SIEVE_QUEUE, JEV_SIEVE_TASK_CHARS,
 * JEV_SH, JEV_CACHE_DIR.
 *
 * Two shapes that used to lose data:
 *   - A burst of parallel results is queued, not dropped. pi runs sibling tool
 *     calls from one assistant message concurrently, so two large reads land at
 *     once. They run in arrival order, one Jev call at a time. The line is
 *     bounded by JEV_SIEVE_QUEUE (default 8) and overflow is logged as
 *     queue-full rather than vanishing.
 *   - A document too large for one request is judged in several passes, and a
 *     block that alone exceeds the budget is sliced by lines. A giant result is
 *     therefore never handed back to the agent unjudged. The one exception is a
 *     single line longer than the budget, which cannot be sliced without losing
 *     the line range in the stub; it travels alone and fails open.
 *
 * The band thresholds default to winnow's calibrated drop point: a block is
 * hidden only below 0.10, and everything from 0.10 to 0.50 is kept because it is
 * uncertain. Raise the drop point only with a replay, per section 8.3.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** Treat an empty env var as unset. `Number("")` is 0, which would silently
 *  turn an empty tuning var into the most aggressive setting. */
function envStr(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

function envNum(name: string, fallback: number): number {
  const parsed = Number(envStr(name, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}

const HOME = homedir();
const JEV_SH = envStr("JEV_SH", join(HOME, "dotfiles/scripts/jev.sh"));
const CACHE_DIR = envStr("JEV_CACHE_DIR", join(HOME, ".cache/jev"));
const BLOCK_CACHE = join(CACHE_DIR, "blocks");
const LOG_FILE = join(CACHE_DIR, "sieve.jsonl");

const MODE = envStr("JEV_SIEVE", "shadow");
const MIN_CHARS = envNum("JEV_SIEVE_MIN_CHARS", 1500);
const BLOCK_LINES = envNum("JEV_SIEVE_BLOCK_LINES", 25);
const THRESHOLD = envNum("JEV_SIEVE_THRESHOLD", 0.3);
const MARGIN = envNum("JEV_SIEVE_MARGIN", 0.2);
const TASK_CHARS = envNum("JEV_SIEVE_TASK_CHARS", 4000);
const MAX_BATCH_CHARS = envNum("JEV_SIEVE_MAX_BATCH_CHARS", 100_000);
const MAX_QUEUE = envNum("JEV_SIEVE_QUEUE", 8);

/** Room for the task, the source, the question wrappers, and JSON punctuation. */
const SCAFFOLD_CHARS = 2000;
const BLOCK_OVERHEAD_CHARS = 320;
const TOOLS = envStr("JEV_SIEVE_TOOLS", "read,bash,grep,ffgrep,fffind")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const JEV_TIMEOUT_MS = 20_000;

export type Band = "yes" | "no" | "uncertain";
export type SieveMode = "off" | "shadow" | "on";

export interface Block {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

/** A verdict for one block, as returned by the script's local banding. */
export interface Judged {
  readonly block: Block;
  readonly noul: number;
  readonly band: Band;
}

/** What the sieve decided to do with one block. No booleans gate the fields. */
export type Action =
  | { readonly kind: "hide"; readonly judged: Judged }
  | { readonly kind: "keep"; readonly judged: Judged; readonly why: "needed" | "uncertain" };

/** The script's envelope. Parsed at the boundary into a closed set. */
export type Envelope =
  | { readonly status: "ok"; readonly verdicts: Record<string, { band?: string; noul?: number }> }
  | { readonly status: "disabled" }
  | { readonly status: "error"; readonly reason: string };

/** Split text into fixed-size line blocks, numbered from line 1. */
export function splitBlocks(text: string, linesPerBlock: number): Block[] {
  if (!Number.isFinite(linesPerBlock) || linesPerBlock < 1) return [];
  const lines = text.split("\n");
  const blocks: Block[] = [];
  for (let start = 0; start < lines.length; start += linesPerBlock) {
    const slice = lines.slice(start, start + linesPerBlock);
    if (slice.join("").trim() === "") continue;
    blocks.push({
      id: `b${blocks.length}`,
      from: start + 1,
      to: start + slice.length,
      text: slice.join("\n"),
    });
  }
  return blocks;
}

/**
 * Keep a block only when the judge is confident it is not needed. Anything
 * uncertain is kept, which is the rule winnow hard-codes and makes the drop
 * threshold the only tunable in the path.
 */
export function decide(judged: Judged): Action {
  if (judged.band === "no") return { kind: "hide", judged };
  if (judged.band === "uncertain") return { kind: "keep", judged, why: "uncertain" };
  return { kind: "keep", judged, why: "needed" };
}

/** Accept either the band we asked for or a bare probability, capped at a keep. */
export function verdictFor(
  envelope: Envelope,
  blockId: string,
): { band: Band; noul: number } | null {
  if (envelope.status !== "ok") return null;
  const v = envelope.verdicts[blockId];
  if (!v) return null;
  const noul = typeof v.noul === "number" && Number.isFinite(v.noul) ? v.noul : null;
  if (noul === null) return null;
  if (v.band === "yes" || v.band === "no" || v.band === "uncertain") {
    return { band: v.band, noul };
  }
  return { band: "uncertain", noul };
}

/** Build the request body: one shared state, one path-referencing question per block.
 *  The path index is the position within this batch, which is why batches carry
 *  their own subset of blocks. */
export function buildSpec(
  task: string,
  blocks: readonly Block[],
  source: { readonly tool: string; readonly target: string },
): string {
  const questions: Record<string, unknown> = {};
  blocks.forEach((b, index) => {
    questions[b.id] = {
      type: "noul",
      instructions:
        `The agent is working on the task in \`task\`. Is the content of ` +
        `\`blocks[${index}].text\` needed to complete that task? ` +
        `Answer yes only if it carries information the task depends on.`,
    };
  });
  return JSON.stringify({
    state: { task, source, blocks: blocks.map((b) => ({ id: b.id, text: b.text })) },
    model: "jev-latest",
    questions,
  });
}

/** One request's worth of blocks. Passes run in order and are merged by id. */
export interface Batch {
  readonly blocks: readonly Block[];
  readonly spec: string;
}

/** Split a block in half by lines until it fits. A single line is returned as is:
 *  there is no safe way to slice it and still name a line range the agent can
 *  read back, and returning it unchanged is what makes this terminate. */
export function splitToFit(block: Block, maxChars: number): Block[] {
  if (block.text.length <= maxChars) return [block];
  const lines = block.text.split("\n");
  if (lines.length < 2) return [block];
  const mid = Math.ceil(lines.length / 2);
  const head: Block = {
    id: block.id,
    from: block.from,
    to: block.from + mid - 1,
    text: lines.slice(0, mid).join("\n"),
  };
  const tail: Block = {
    id: block.id,
    from: block.from + mid,
    to: block.to,
    text: lines.slice(mid).join("\n"),
  };
  return [...splitToFit(head, maxChars), ...splitToFit(tail, maxChars)];
}

/** Reassign ids in document order so every judgeable unit has a unique key. */
export function reindex(blocks: readonly Block[]): Block[] {
  return blocks.map((b, index) => ({ ...b, id: `b${index}` }));
}

/** Slice a document into as many requests as the budget needs, in order.
 *  Every block survives into exactly one batch, so nothing goes unjudged. */
export function buildBatches(
  task: string,
  blocks: readonly Block[],
  source: { readonly tool: string; readonly target: string },
  maxBatchChars: number,
): Batch[] {
  const budget = maxBatchChars - SCAFFOLD_CHARS - task.length - source.target.length;
  if (budget <= 0) return [];
  const expanded: Block[] = [];
  for (const block of blocks) expanded.push(...splitToFit(block, budget));
  const ordered = reindex(expanded);
  const batches: Batch[] = [];
  let current: Block[] = [];
  let used = 0;
  for (const block of ordered) {
    const cost = block.text.length + BLOCK_OVERHEAD_CHARS;
    if (current.length > 0 && used + cost > budget) {
      batches.push({ blocks: current, spec: buildSpec(task, current, source) });
      current = [];
      used = 0;
    }
    current.push(block);
    used += cost;
  }
  if (current.length > 0) {
    batches.push({ blocks: current, spec: buildSpec(task, current, source) });
  }
  return batches;
}

export function stubFor(block: Block, path: string, noul: number, source: string): string {
  const lines = block.to - block.from + 1;
  return (
    `[jev-sieve] ${source} lines ${block.from}-${block.to} (${lines} lines) hidden: ` +
    `judged unlikely to matter for the current task (needed ${noul.toFixed(2)}).\n` +
    `[jev-sieve] full text: read ${path} with offset=${block.from} limit=${lines}`
  );
}

/** Replace the hidden blocks with stubs, leaving kept blocks verbatim. */
export function applySieve(
  text: string,
  actions: readonly Action[],
  paths: ReadonlyMap<string, string>,
  source: string,
): string {
  const lines = text.split("\n");
  const hidden = new Map<number, { action: Action & { kind: "hide" }; path: string }>();
  for (const action of actions) {
    if (action.kind !== "hide") continue;
    const path = paths.get(action.judged.block.id);
    if (!path) continue;
    hidden.set(action.judged.block.from, { action, path });
  }
  const out: string[] = [];
  for (let n = 1; n <= lines.length; n++) {
    const hit = hidden.get(n);
    if (!hit) {
      out.push(lines[n - 1]);
      continue;
    }
    const { judged } = hit.action;
    out.push(stubFor(judged.block, hit.path, judged.noul, source));
    // Skip through the hidden range: the loop's own increment lands on to + 1.
    n = judged.block.to;
  }
  return out.join("\n");
}

function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { status?: unknown };
  if (v.status === "disabled") return true;
  if (v.status === "error") return true;
  return v.status === "ok" && typeof (value as { verdicts?: unknown }).verdicts === "object";
}

/** One call, all blocks, one round trip. Never throws: every failure returns null. */
export async function runJev(body: string): Promise<Envelope | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: Envelope | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(JEV_SH, ["--spec", "-"], { stdio: ["pipe", "pipe", "ignore"] });
    } catch {
      done(null);
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done(null);
    }, JEV_TIMEOUT_MS);
    const { stdin, stdout } = child;
    if (!stdin || !stdout) {
      clearTimeout(timer);
      done(null);
      return;
    }
    let out = "";
    // The child may exit before reading all of stdin, which raises EPIPE on
    // write. Unhandled, that takes the whole process down, so swallow it and
    // let close decide the outcome.
    stdin.on("error", () => {});
    stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });
    child.on("error", () => {
      clearTimeout(timer);
      done(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const parsed: unknown = JSON.parse(out);
        done(isEnvelope(parsed) ? parsed : null);
      } catch {
        done(null);
      }
    });
    try {
      stdin.end(body);
    } catch {}
  });
}

/** Recent user text, which is the closest thing to "the current task". */
export function recentTask(entries: readonly unknown[], maxChars: number): string {
  const parts: string[] = [];
  for (let i = entries.length - 1; i >= 0 && parts.join(" ").length < maxChars; i--) {
    const entry = entries[i] as {
      type?: string;
      message?: { role?: string; content?: unknown };
    };
    if (entry?.type !== "message" || entry.message?.role !== "user") continue;
    const content = entry.message.content;
    if (typeof content === "string") {
      parts.push(content);
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      const text = (item as { type?: string; text?: string })?.text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.reverse().join("\n").slice(-maxChars);
}

/** The single text block of a result, or null when the shape is not that simple. */
export function singleText(content: unknown): { text: string; index: number } | null {
  if (!Array.isArray(content)) return null;
  const texts: number[] = [];
  content.forEach((item, index) => {
    if ((item as { type?: string })?.type === "text") texts.push(index);
  });
  if (texts.length !== 1) return null;
  const index = texts[0];
  const text = (content[index] as { text?: string })?.text;
  if (typeof text !== "string") return null;
  return { text, index };
}

async function cacheBlocks(
  sessionId: string,
  actions: readonly Action[],
): Promise<Map<string, string>> {
  const paths = new Map<string, string>();
  const hidden = actions.filter((a): a is Action & { kind: "hide" } => a.kind === "hide");
  if (hidden.length === 0) return paths;
  await mkdir(BLOCK_CACHE, { recursive: true });
  for (const action of hidden) {
    const { block } = action.judged;
    const path = join(BLOCK_CACHE, `${sessionId}-${block.id}-${block.from}-${block.to}.txt`);
    await writeFile(path, block.text, "utf8");
    paths.set(block.id, path);
  }
  return paths;
}

async function log(entry: Record<string, unknown>): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {}
}

const MODES: readonly string[] = ["off", "shadow", "on"];
export const mode: SieveMode = (MODES.includes(MODE) ? MODE : "off") as SieveMode;

/** A bounded FIFO. Jobs run one at a time in arrival order, so a burst of
 *  parallel results is served rather than dropped, and the script's choke point
 *  is never stampeded. A full line returns null so the caller can log it. */
export interface Queue {
  readonly depth: () => number;
  run<T>(job: () => Promise<T>): Promise<T> | null;
}

export function createQueue(limit: number): Queue {
  let depth = 0;
  let tail: Promise<void> = Promise.resolve();
  return {
    depth: () => depth,
    run<T>(job: () => Promise<T>): Promise<T> | null {
      if (depth >= limit) return null;
      depth += 1;
      const settled = tail.then(job, job);
      // Both arms release the slot, so one failing job cannot wedge the line.
      tail = settled.then(
        () => {
          depth -= 1;
        },
        () => {
          depth -= 1;
        },
      );
      return settled;
    },
  };
}

export default function (pi: ExtensionAPI) {
  const queue = createQueue(MAX_QUEUE);

  pi.on("tool_result", async (event, ctx) => {
    if (mode === "off") return;
    if (event.isError) return;
    if (!TOOLS.includes(event.toolName)) return;

    const found = singleText(event.content);
    if (!found || found.text.length < MIN_CHARS) return;

    const blocks = splitBlocks(found.text, BLOCK_LINES);
    if (blocks.length < 2) return;

    const session = ctx.sessionManager.getSessionId();
    const task = recentTask(ctx.sessionManager.getBranch(), TASK_CHARS);
    const target = String(
      (event.input as { file_path?: string; path?: string; command?: string })?.file_path ??
        (event.input as { path?: string })?.path ??
        (event.input as { command?: string })?.command ??
        "",
    ).slice(0, 300);

    const batches = buildBatches(task, blocks, { tool: event.toolName, target }, MAX_BATCH_CHARS);
    if (batches.length === 0) {
      const result = "no-budget";
      await log({ ts: Date.now(), session, mode, tool: event.toolName, target, result });
      return;
    }

    // Every pass for one document runs in a single queue slot, so two documents
    // do not interleave their passes.
    const judged = await queue.run(async () => {
      const out: Judged[] = [];
      for (const batch of batches) {
        const envelope = await runJev(batch.spec);
        if (!envelope) continue;
        for (const block of batch.blocks) {
          const verdict = verdictFor(envelope, block.id);
          if (verdict) out.push({ block, noul: verdict.noul, band: verdict.band });
        }
      }
      return out;
    });

    if (judged === null) {
      await log({
        ts: Date.now(),
        session,
        mode,
        tool: event.toolName,
        target,
        result: "queue-full",
        pending: queue.depth(),
        blocks: blocks.length,
      });
      return;
    }
    if (judged.length === 0) {
      const result = "no-judgment";
      await log({ ts: Date.now(), session, mode, tool: event.toolName, target, result });
      return;
    }

    const actions: Action[] = judged.map(decide);
    const hides = actions.filter((a) => a.kind === "hide").length;
    await log({
      ts: Date.now(),
      session,
      mode,
      tool: event.toolName,
      target,
      chars: found.text.length,
      blocks: blocks.length,
      passes: batches.length,
      hidden: hides,
      verdicts: actions.map((a) => ({
        id: a.judged.block.id,
        from: a.judged.block.from,
        to: a.judged.block.to,
        noul: Number(a.judged.noul.toFixed(3)),
        band: a.judged.band,
      })),
    });

    if (mode !== "on" || hides === 0) return;

    let paths: Map<string, string>;
    try {
      paths = await cacheBlocks(session, actions);
    } catch {
      return;
    }
    const source = `${event.toolName}${target ? ` ${target}` : ""}`;
    const next = applySieve(found.text, actions, paths, source);
    if (next === found.text) return;

    const content = [...event.content];
    content[found.index] = { type: "text", text: next };
    return { content };
  });
}
