# jev-sieve design record

The comments that lived in `~/.pi/agent/extensions/jev-sieve.ts`, kept verbatim and in
source order after TB-17 banned comments in code. The calibrated constants (the 0.10 hide
threshold, the instrument tuple, the question template) and the reasons behind them are here
rather than in the source.

jev-sieve.ts - Jev-judged context sieve for large tool results.

Every large read/bash/grep result is judged block by block before it enters context. Blocks the judge is confident are irrelevant to the current task are replaced with a short stub naming a file that holds the full text. Nothing is lost: the agent can read the file back, including with an offset and limit.

Why this surface: context is the one resource a judgment can actually save. See ~/.pi/typesafe-jev-assessment.md section 8.3 for the method and the projects it is taken from.

Discipline, taken from prism-liquidity-agent's three-commit arc:

- shadow first: log the decision, change nothing, calibrate later

- bounded action: hide a block, never drop the result or refuse the tool

- fail open: no key, timeout, or parse failure leaves the result untouched

- never resolve uncertainty: an uncertain block is kept verbatim

Two safety rules are not configurable, following winnow:

- a result flagged as an error is never altered

- a block whose probability is uncertain is kept

Modes (JEV_SIEVE): `off` does nothing (the default since 2026-09-23), `shadow` judges and logs without modifying, `on` additionally replaces confident-irrelevant blocks with a stub.

Tuning (env): JEV_SIEVE_MIN_CHARS, JEV_SIEVE_BLOCK_LINES, JEV_SIEVE_THRESHOLD, JEV_SIEVE_MARGIN, JEV_SIEVE_TOOLS, JEV_SIEVE_MAX_BATCH_CHARS, JEV_SIEVE_QUEUE, JEV_SIEVE_TASK_CHARS, JEV_SIEVE_MODEL, JEV_SIEVE_DENY, JEV_SIEVE_RETENTION_DAYS, JEV_SH, JEV_CACHE_DIR.

Learning loop. The log at `$JEV_CACHE_DIR/sieve.jsonl` holds two entry kinds:

- decision: every judgment, carrying the instrument versions that produced it.
- recall: the agent reading a replaced block back out of the cache.

A recall is the one free ground-truth label available inside the harness: it means the hide was wrong. Both modes write the block text for every block the band marked `no`, so shadow builds the dataset the threshold gets calibrated on. Only `on` names a stub, so only `on` can produce a recall, and a shadow sample has to be labeled by hand. `~/dotfiles/scripts/jev_sieve_report.sh` is the gate over both: it reads the samples and the labels and prints a verdict.

Two shapes that used to lose data:

- A burst of parallel results is queued, not dropped. pi runs sibling tool calls from one assistant message concurrently, so two large reads land at once. They run in arrival order, one Jev call at a time. The line is bounded by JEV_SIEVE_QUEUE (default 8) and overflow is logged as queue-full rather than vanishing.

- A document too large for one request is judged in several passes, and a block that alone exceeds the budget is sliced by lines. A giant result is therefore never handed back to the agent unjudged. The one exception is a single line longer than the budget, which cannot be sliced without losing the line range in the stub; it travels alone and fails open.

The band thresholds default to winnow's calibrated drop point: a block is hidden only when the probability it is needed falls to 0.10 or below, and everything from there to 0.50 is kept because it is uncertain. Lower this only with a replay of real decisions, per section 8.3. The band is computed here, not read from the script's envelope, so this is the single source of truth.

Treat an empty env var as unset. `Number("")` is 0, which would silently turn an empty tuning var into the most aggressive setting.

Room for the task, the source, the question wrappers, and JSON punctuation.

A judgment is only as good as the instrument that produced it, and the instrument is the tuple (model, state representation, question). These pin all three. Any change to the state shape, the question text, or the model is a deliberate bump, so judgments from before it are never silently averaged with judgments after it. See ~/.pi/jev-tip.md on qualifying the instrument.

Question history. v1 named the block by question key, which is the caller's handle and is never sent to the model, so every sibling question arrived identical and so did the answers. v2 names the block path.

Pinned, and overridable only to run the model-rollover A/B deliberately. `jev-latest` moves under the log, and the model is the one member of the instrument tuple a floating alias leaves unpinned.

A verdict for one block, as returned by the script's local banding.

What the sieve decided to do with one block. No booleans gate the fields.

The script's envelope. Parsed at the boundary into a closed set.

Split text into fixed-size line blocks, numbered from line 1.

Keep a block only when the judge is confident it is not needed. Anything uncertain is kept, which is the rule winnow hard-codes and makes the drop threshold the only tunable in the path.

Decimal probabilities meet a decimal threshold, so the boundary tests allow a hair of float representation error. 0.3 - 0.2 is 0.09999999999999998 in binary floating point, which otherwise pushes a noul of exactly 0.10 out of the hide band and makes the documented boundary untrue.

The band is derived here from the probability and never taken from the envelope's own band field. The script's default banding is not this extension's policy, and letting the envelope win made the sieve hide blocks that had a 55% chance of being needed. One source of truth: the constants above, which is also what shadow calibration tunes.

A usable verdict, or null when the envelope carries no probability for this block. The envelope's `band` is deliberately ignored; see bandFor.

What the agent asked for, which is the strongest deterministic evidence about whether the output matters. `namedInTask` states the one relationship between the request and the task that code can observe outright; the model still decides what to do with it.

True when the request names something the task also names. This is the deterministically observable half of "was this asked for on purpose", which the state previously left to be inferred from the task text alone. A whole result from a deliberately targeted read is the case that produced confident "not needed" answers on source the agent had explicitly asked for.

ponytail: substring test on basenames; loosen only if the recall labels show it missing.

A fixed template with one interpolated referent: the path of the block this question is about. The template holds still, so every reading comes from the same instrument. The referent moves, because a question that does not name its own block cannot be answered about that block.

Naming the path follows TypeSafe's own fan-out example (`items[i]`) and their guidance for indirection: identify the relevant parts of state by name. Measured cost of not doing it, over 1,278 judged blocks: within-document standard deviation 0.008, range 0.12-0.55, and no block ever reached the hide band. Nothing variable travels in the question except the referent, so the question text still does not change with the task.

Build the request body: one shared state, one path-referencing question per block. The path index is the position within this batch, which is why batches carry their own subset of blocks.

One request's worth of blocks. Passes run in order and are merged by id.

Split a block in half by lines until it fits. A single line is returned as is: there is no safe way to slice it and still name a line range the agent can read back, and returning it unchanged is what makes this terminate.

Reassign ids in document order so every judgeable unit has a unique key.

Slice a document into as many requests as the budget needs, in order. Every block survives into exactly one batch, so nothing goes unjudged.

Replace the hidden blocks with stubs, leaving kept blocks verbatim.

Skip through the hidden range: the loop's own increment lands on to + 1.

One call, all blocks, one round trip. Never throws: every failure returns null.

The child may exit before reading all of stdin, which raises EPIPE on write. Unhandled, that takes the whole process down, so swallow it and let close decide the outcome.

Recent user text, which is the closest thing to "the current task".

The single text block of a result, or null when the shape is not that simple.

The cache filename for a block the sieve replaced, or null when the target is not a read-back. The filename already carries session, block id, and line range, so a recall joins straight back to the decision that produced it.

ponytail: re-running the command also recovers the text, unlabeled; add if recall looks low.

A bounded FIFO. Jobs run one at a time in arrival order, so a burst of parallel results is served rather than dropped, and the script's choke point is never stampeded. A full line returns null so the caller can log it.

Both arms release the slot, so one failing job cannot wedge the line.

The label for an earlier decision, emitted before any early return: a recall is a wrong hide, and a recall is usually too short to clear MIN_CHARS.

Every pass for one document runs in a single queue slot, so two documents do not interleave their passes.

The block text is written in both modes. Shadow's job is to produce the dataset the threshold is calibrated on, and a judgment whose block text was never kept cannot be labeled after the fact. Only the mutation is `on`-only.

ponytail: samples never pruned; a superseded instrument's samples sit beside the current one.

## Hardening, 2026-09-23

Four changes after the security review, none of which the sieve's own logic needed.

Default off. `JEV_SIEVE` defaults to `off`, so the hook judges nothing and sends nothing until it is switched on per project. Shadow egresses the same bytes as `on`, so an egress-safe default is `off` or nothing.

Egress denylist. `egressFor` runs before any request is built and returns a tagged `allow` or `deny` carrying the rule that fired. A denied result is never sent, never cached, and never modified; it is logged once as `result: egress-denied` with the reason. Rules run over the path, then the content, then the task text: dotenv, credential, private-key, keystore, cloud, wallet, and docker-config paths; private-key blocks, AWS, GitHub, Slack and provider keys, JWTs, bearer headers, assigned secrets, connection strings, and basic-auth URLs in content; the same content rules over the task, because the task travels as state too. `JEV_SIEVE_DENY` appends comma-separated regexes and warns once on an invalid one. Over-broad is the safe direction here: a false deny costs context savings, a false allow leaks.

Data at rest. The cache directory and every cached block are created 0700 and 0600, `pruneBlocks` re-tightens the directory and deletes block text older than `JEV_SIEVE_RETENTION_DAYS` (14, 0 keeps forever) once per process, and a decision no longer logs the command or path, only the tool, `namedInTask`, size, block count, and the verdict vector. The log is metadata and the cached block is content, so only the content is pruned.

The credential leaves argv. `jev.sh` writes the bearer header into a 0600 mktemp file and hands it to curl with `--config`, so the key is not in the process list the way a `-H` argument is. A key containing a quote or a newline is rejected as `invalid` rather than silently mangled by the config format. `__check_jev_argv.sh` guards both halves at once: the header still arrives, and the key is absent from curl's argv.

The 4 cached candidates and the whole decision log were purged on the same day, and `~/.cache/jev` is now 0700 with 0600 files.

## The runnable checks

The pure logic lives in `jev-sieve.check.ts` and the impure half in `jev-sieve.e2e.check.ts`, both at the repo root so pi never loads them as extensions.

The e2e exists for one invariant: shadow must cache the block text of every hide candidate while leaving the content alone. If that breaks, shadow silently stops producing a dataset and the gate above blames a flat instrument instead of a broken cache write, which is a misleading diagnosis rather than a visible failure. It now also covers a denied result, which must cache nothing and be logged with its rule, and the 0700 and 0600 modes on the cache. It points `JEV_SH` at a stub, so it uses no network and no API key, and everything lives in a temp directory that is removed at the end.

The pure check pins the instrument: versioned state, a pinned model, and one question per block naming its own block path, because a question that does not name its own subject gets answered about no block in particular, which is what flattened the v1 readings. Banding keeps the uncertain middle and holds the documented 0.10 boundary against float representation error. `splitBlocks` numbers from line 1 and drops blank blocks. `namedInTask` is the deterministic half of "was this asked for on purpose". `recallPath` finds a replaced block being read back, by `read` or by `bash`. Every block survives into exactly one pass and a single unsliceable line travels alone instead of looping. A question's named path is its position in that pass's own state array, which is where a multi-pass split can drift, so the split fixture is chosen to split. A hidden block becomes a stub naming the exact range to read back, with everything outside it left verbatim. `egressFor` is covered by the cases in the section above.
