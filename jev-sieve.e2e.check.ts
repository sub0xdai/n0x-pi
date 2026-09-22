/**
 * jev-sieve.e2e.check.ts - the one runnable check for the sieve's impure half.
 *
 *   node ~/.pi/jev-sieve.e2e.check.ts
 *
 * jev-sieve.check.ts covers the pure logic. This covers the part that touches the
 * filesystem and a subprocess, and it exists for one invariant: shadow mode must
 * cache the block text of every hide candidate while leaving the content alone. If
 * that breaks, shadow silently stops producing a dataset and the calibration gate
 * blames a flat instrument instead of a cache gate, which is a misleading diagnosis
 * rather than a visible failure.
 *
 * Node strips the types itself. JEV_SH points at a stub, so there is no network and
 * no API key. Everything lives in a temp directory and is removed at the end.
 */
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "jev-sieve-e2e-"));
const cacheDir = join(root, "cache");
const stub = join(root, "jev-stub.sh");

// A judge that marks every block `no`. The noul is what the extension bands on, so
// 0.05 lands under the 0.10 hide line without any envelope band in the way.
writeFileSync(
  stub,
  `#!/bin/sh
read -r body
q=$(printf '%s' "$body" | jq -c '
  [.questions | keys[] | {key: ., value: {type: "noul", noul: 0.05}}]
  | from_entries')
printf '{"schema_version":"1","status":"ok","model":"jev-1.13.0","answers":%s,"verdicts":%s}' \
  "$q" "$q"
`,
);
chmodSync(stub, 0o755);

process.env.JEV_CACHE_DIR = cacheDir;
process.env.JEV_SIEVE_LOG = join(cacheDir, "sieve.jsonl");
process.env.JEV_SH = stub;
process.env.JEV_SIEVE = "shadow";
process.env.JEV_SIEVE_MIN_CHARS = "50";
process.env.JEV_SIEVE_QUEUE = "1";

const mod = await import("./agent/extensions/jev-sieve.ts");

let handler: ((event: unknown, ctx: unknown) => Promise<unknown>) | undefined;
mod.default({ on: (name: string, fn: never) => {
  if (name === "tool_result") handler = fn as never;
} });
assert.ok(handler, "the extension registers a tool_result handler");

const text = Array.from({ length: 60 }, (_, i) => `line ${i} of the result`).join("\n");
const event = {
  toolName: "read",
  isError: false,
  input: { file_path: "/repo/src/exchange_api.rs" },
  content: [{ type: "text", text }],
};
const ctx = {
  sessionManager: {
    getSessionId: () => "s1",
    getBranch: () => [
      { type: "message", message: { role: "user", content: "fix exchange_api.rs" } },
    ],
  },
};

const returned = await handler(event, ctx);

// The shadow invariant, both halves. Nothing is returned, so the content the agent
// sees is byte-identical to what the tool produced, and the text is on disk anyway.
assert.equal(returned, undefined, "shadow must not modify the tool result");
assert.equal(
  (event.content[0] as { text: string }).text,
  text,
  "shadow leaves the content in place",
);

const cached = readdirSync(join(cacheDir, "blocks"));
assert.equal(cached.length, 3, "every hide candidate is cached, one file per block");

const entry = JSON.parse(readFileSync(process.env.JEV_SIEVE_LOG, "utf8").trim());
assert.equal(entry.mode, "shadow");
assert.equal(entry.question, mod.QUESTION_ID, "the log records the instrument version");
assert.equal(entry.hidden, 3, "hidden counts the candidates, and shadow replaces none");
assert.equal(entry.verdicts.length, 3);
assert.ok(
  entry.verdicts.every((v: { band: string }) => v.band === "no"),
  "the stub judge put every block in the hide band",
);

// The gate reads exactly these files, so a candidate that is not cached is a
// candidate the labeler cannot see.
const first = readFileSync(join(cacheDir, "blocks", cached[0]), "utf8");
assert.ok(first.startsWith("line "), "the cached text is the block text");

rmSync(root, { recursive: true, force: true });
console.log("jev-sieve e2e: 10 assertions pass");
