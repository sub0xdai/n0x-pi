/**
 * jev-sieve.check.ts - the one runnable check for the sieve's pure logic.
 *
 *   node ~/.pi/jev-sieve.check.ts
 *
 * It lives here rather than in extensions/ so pi never loads it as an extension.
 * Node strips the types itself; no test framework, no dependencies.
 */
import assert from "node:assert/strict";
import {
  MODEL,
  STATE_SCHEMA,
  QUESTION_ID,
  bandFor,
  buildBatches,
  buildSpec,
  decide,
  applySieve,
  recallPath,
  splitBlocks,
  splitToFit,
  targetNamedInTask,
  type Block,
  type Judged,
  type Request,
} from "./agent/extensions/jev-sieve.ts";

// splitBlocks numbers from line 1 and drops blank blocks.
const blocks = splitBlocks("a\nb\nc\nd\ne", 2);
assert.deepEqual(
  blocks.map((b) => [b.id, b.from, b.to]),
  [["b0", 1, 2], ["b1", 3, 4], ["b2", 5, 5]],
);
assert.deepEqual(
  splitBlocks("a\n\n\n\n\nb", 2).map((b) => [b.from, b.to]),
  [[1, 2], [5, 6]],
  "a whitespace-only block is dropped",
);
assert.equal(splitBlocks("a\nb", 0).length, 0, "a zero block size is not a crash");

// bandFor keeps the uncertain middle and holds the documented 0.10 boundary
// against float representation error.
assert.equal(bandFor(0.09, 0.3, 0.2), "no");
assert.equal(bandFor(0.1, 0.3, 0.2), "no", "0.3 - 0.2 is 0.09999999999999998");
assert.equal(bandFor(0.2, 0.3, 0.2), "uncertain");
assert.equal(bandFor(0.5, 0.3, 0.2), "yes");

// An uncertain or needed block is never hidden.
assert.equal(decide({ block: blocks[0], noul: 0.2, band: "uncertain" }).kind, "keep");
assert.equal(decide({ block: blocks[0], noul: 0.5, band: "yes" }).kind, "keep");
assert.equal(decide({ block: blocks[0], noul: 0.1, band: "no" }).kind, "hide");

// namedInTask is the deterministic half of "was this asked for on purpose".
assert.equal(
  targetNamedInTask("sed -n '1,5p' crates/router/src/exchange_api.rs", "fix exchange_api.rs"),
  true,
);
assert.equal(targetNamedInTask("/repo/src/journal_service.rs", "read the spec"), false);
assert.equal(targetNamedInTask("", "fix anything"), false, "an empty target names nothing");

// recallPath finds a replaced block being read back, by read or by bash.
assert.equal(recallPath("/home/m0xu/.cache/jev/blocks/s1-b0-1-25.txt"), "s1-b0-1-25.txt");
assert.equal(recallPath("cat /home/m0xu/.cache/jev/blocks/s1-b0-1-25.txt"), "s1-b0-1-25.txt");
assert.equal(recallPath("/home/m0xu/.cache/jev/sieve.jsonl"), null);
assert.equal(recallPath("/tmp/unrelated.txt"), null);

// The instrument is pinned: versioned state, a pinned model, and one question per
// block that names its own block path. The template holds still; only the
// referent moves. A question that does not name its own block gets answered about
// no block in particular, which is what flattened the v1 readings.
const request: Request = { tool: "read", target: "/repo/exchange_api.rs", namedInTask: true };
const spec = JSON.parse(buildSpec("fix exchange_api.rs", blocks, request));
assert.equal(spec.state.schema, STATE_SCHEMA);
assert.equal(spec.state.question, QUESTION_ID);
assert.equal(spec.model, MODEL, "the model version is pinned, not jev-latest");
assert.equal(spec.state.request.namedInTask, true);
assert.deepEqual(Object.keys(spec.questions), ["b0", "b1", "b2"]);
assert.equal(spec.questions.b0.type, "noul");
assert.ok(
  spec.questions.b0.instructions.includes("`blocks[0].text`"),
  "question 0 names block 0",
);
assert.ok(
  spec.questions.b2.instructions.includes("`blocks[2].text`"),
  "question 2 names block 2",
);
assert.notEqual(
  spec.questions.b0.instructions,
  spec.questions.b2.instructions,
  "each question names its own block",
);
assert.equal(
  spec.questions.b0.instructions.split("blocks[")[0],
  spec.questions.b2.instructions.split("blocks[")[0],
  "every block is asked the same template",
);
assert.ok(
  !spec.questions.b0.instructions.includes("fix exchange_api.rs"),
  "no task text in the question",
);

// Every block survives into exactly one pass, and a single unsliceable line
// travels alone instead of looping.
const many: Block[] = Array.from({ length: 20 }, (_, i) => ({
  id: `b${i}`,
  from: i * 25 + 1,
  to: i * 25 + 25,
  text: "x".repeat(500),
}));
const passes = buildBatches("t", many, request, 4000);
const ids = passes.flatMap((p) => p.blocks.map((b) => b.id));
assert.equal(new Set(ids).size, ids.length, "no block is judged twice");
assert.equal(ids.length, many.length, "every block is judged");
assert.equal(splitToFit({ id: "b0", from: 1, to: 1, text: "y".repeat(5000) }, 1000).length, 1);
assert.ok(passes.length > 1, "this fixture splits into several passes");

// A question's named path is the position its own block holds in that pass's own
// state array. A split into several passes is where that alignment can drift, so
// the fixture is chosen to split.
const drift = passes.flatMap((pass) => {
  const parsed = JSON.parse(pass.spec);
  return pass.blocks.flatMap((block, index) => {
    const named = parsed.questions[block.id].instructions.includes(`\`blocks[${index}].text\``);
    return named && parsed.state.blocks[index].id === block.id ? [] : [block.id];
  });
});
assert.deepEqual(drift, [], "each pass's questions name their own positions in that pass");

// A hidden block is replaced by a stub naming the exact range to read back, and
// everything outside it is left verbatim.
const judged: Judged = {
  block: { id: "b0", from: 1, to: 2, text: "l1\nl2" },
  noul: 0.05,
  band: "no",
};
const sieved = applySieve(
  "l1\nl2\nl3",
  [decide(judged)],
  new Map([["b0", "/cache/x.txt"]]),
  "bash foo",
);
assert.ok(sieved.includes("offset=1 limit=2"), "the stub names the line range");
assert.ok(sieved.includes("l3") && !sieved.includes("l2"), "only the hidden range is replaced");

console.log("jev-sieve: 35 assertions pass");
