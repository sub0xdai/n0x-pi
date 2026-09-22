# TypeSafe / Jev - Preliminary Assessment

Scope: what Jev is, and where it plausibly attaches to `~/.pi/`.

Subject: TypeSafe System One models, `POST /v1/systemone`, model `jev-1.13.0`.
Source: docs.typesafe.ai (introduction, quickstart, primitives, system-one, state, confidence, patterns, models, api, sdk, use-case-map, model-jaggedness/jev-1.13), plus the framework integration pages in section 8.7, plus fourteen third-party projects in section 8, read at README and commit level.
Status: the sieve is live and nothing else is. A credential now exists at `~/.config/typesafe/credentials.env` (mode 600) and `~/dotfiles/scripts/jev.sh` is written, so 387 documents have been judged in shadow mode since 2026-09-18. Sections 5, 8.6 and the appendix carry statements made before that and the status line supersedes them. Section 9 records what the log shows. Every external number in section 8 is quoted from the project that measured it, not reproduced here.

## 1. What Jev is

One endpoint, `POST /v1/systemone`.
Send a `state` (string, object, or array) plus a map of typed `questions`.
Get back typed `answers` under the same keys.
No text generation, no parsing.

Three primitives:

| Type | Question | Returns |
|------|----------|---------|
| `Choice` | Which of these options? | `choice`, `probabilities`, `confidence` |
| `Score` | Which level? | `score`, `legend`, `probabilities`, `confidence` |
| `Noul` | Is this true? | `noul` (0 to 1) |

All three can be mixed in a single request.
Every question in a request sees the same state, is evaluated independently, and returns under the ID you chose.
Adding questions barely changes response time and costs only the question tokens.

Key numbers:

- Pricing for `jev-1.13.0`: $42 per Btok input, output free.
- That is **$0.042 per million input tokens**.
- Rate limits: 250,000 tokens/sec and 1,200 requests/min.
- Request budget: ~32,000 tokens shared between state and questions, roughly 150,000 characters of English.
- Errors: 401 unauthorized, 422 validation, 429 rate limit, 529 overloaded. SDKs retry 429/529 with backoff and honor `retry-after`.
- SDKs: Python and JavaScript/TypeScript, plus raw HTTP from any language.

Two properties make the answers composable:

- Every answer is constrained to the options you supplied. The model returns a probability distribution over your options, never a value outside them.
- Every answer is independent. One question's answer is not hidden context for another.

### Confidence

`Choice` and `Score` answers carry a `confidence` from 0 to 1, derived from the shape of the probability distribution.
`Noul` carries no separate confidence; the probability itself is the signal.
Documented guidance is three ranges: high confidence acts automatically, medium proceeds with caution, low does not act.
The documented floor for "genuinely uncertain" is 0.5, and thresholds are meant to scale with the stakes of the action.

### Not verified

- The 70-500 ms latency figure does not appear anywhere on the site as far as I could find. Third-party measurements spread over an order of magnitude: 150-500 ms per call (`jkudish/jev-mcp`), about 0.6 s per turn including local policy work (`jev-codex-router`), and 0.5-2.5 s plus enforced pacing for one four-question batch against a larger state (`prism-liquidity-agent`, stated in its source comments). The spread tracks state size and batch size, so quote a range and name the case. See section 8.3. Nothing is measured on this machine.
- Whether `Noul` is a distinct primitive specifically to avoid a boolean plus an optional reason string is my reading, not a documented claim. The practical effect is the same either way.

## 2. Why it maps onto this tree

`~/.pi/agent/primitives/` already holds nine `.schema.json` files, and `agent/lattice.md` already declares the extension litmus test.
Jev produces exactly the typed values those primitives describe.
A `Noul` gate around `write`/`edit`/`bash` is the same shape as `check.schema.json`.
A `Choice` over skill names is the same shape as `decision-tree.schema.json`.
The fit is not incidental.

It also matches the constructive data modeling rule already enforced here: a `Noul` is a probability, not `isJailbreak: boolean` plus an optional `reason?: string`.

## 3. Use case mapping

| Idea | Concrete hook in this tree | Verdict |
|------|---------------------------|---------|
| Model router | `agent/npm/node_modules/@yeliu84/pi-model-router/extensions/routing.ts:389-476`, `runClassifier()` prompts gemini-2.5-flash for two text lines and does `tierLine.toLowerCase().startsWith('tier:')` | **Strongest fit, but not as a tier picker.** Ask semantic properties of the task directly (`Choice` over "does this need repository-wide reasoning", "does it need sustained multi-step tool use") and keep the tier rule in code. Asking for the tier makes the model infer both what kind of task this is and how the metrics trade off, which is the anti-pattern jev-tip.md names. Cheaper at $0.042 vs ~$0.30 per Mtok input, and the classifier can no longer return unparseable text. |
| Agent guardrail | `agent/extensions/plan-mode.ts:144-157`, `pi.on("tool_call")`, currently a human confirm on every `write`/`edit`/`bash` | Good fit as an **additional** signal, never as a replacement. This is a trust boundary; keep the human confirm. Section 8.3 has the worked version: shadow first, then a bounded action - halve, never veto. |
| Skill picker | 26 skill directories under `agent/skills/` plus package skills, selected today by in-context description matching | Strong fit. One `Choice` over skill names with an `other` option. The `skill_suggestion` cookbook does the two-stage version: rank all, then judge the top few with full text. |
| Writing linter | `agent/skills/ste-writing/` with `~/dotfiles/scripts/ste_lint.py`, plus `humanizer` and `/ste-writing` | Fit, but `ste_lint.py` is mechanical. Jev adds the semantic layer only, not the rule matching. |
| Citation check | The emission protocol plus `primitives/check.schema.json` | Good fit. `Noul` over "does the source support the claim" is exactly the documented shape. |
| Semantic search / reranker | No reranking layer exists today | New capability, not a replacement. |
| Ticket triage | Nothing in the tree | No current hook. |
| Corpus map-reduce | Nothing in the tree | No current hook. |
| Live UI | `agent/extensions/herdr-agent-state.ts`, `notifications.ts`, and the editor status row `@tungthedev/pi-extensions` renders | Plausible for footer state, but only if a small-state call proves fast enough. The measured third-party range is 150 ms to 2.5 s, tracking state size and batch size. See section 8.3. |
| RAG filter | No RAG pipeline here | N/A. |

### 3.1 Constraints the model publishes about itself

`jev-1.13` ships a jaggedness list (`docs.typesafe.ai/model-jaggedness/jev-1.13`, reviewed 2026-09-17).
Several entries rule a design out before it is built, so they belong above the hook mapping rather than after it.
The page's own "Instead" column is the operative part, and these are its consequences here.

| Published failure mode | Consequence in this tree |
|---|---|
| **Indirection.** A property of a property, or several hops, costs accuracy. The remedy given is to identify the relevant parts of state **by name**. | A question must name its own subject by state path. |
| The same entry's remedy applies to pinning. | Pinning an instrument does not mean byte-identical questions. The template holds still and the referent moves. Counter-example measured in section 9. |
| **Structural invariants.** The model is "extremely consistent", so semantically similar inputs get quantitatively similar outputs. | N identical questions produce N identical answers. Flat readings are documented behaviour, not a defect to debug. |
| **Math, counting, dates.** Not a calculator, does not count reliably, reads dates as text. | Anything a regex or parser can compute stays in code. Never ask for a count; ask one question per item and sum in code, which is what the docs' counting example does. |
| **Large state full of irrelevant detail.** Accuracy falls as unrelated content grows. | Batching a whole document plus the task into one request competes with context rot. Measure the cost of batching rather than assuming it is free. |
| **Literal reading.** It answers the question written, not the one intended. | Put boundary cases in `criteria`. When you catch yourself explaining what you meant, that explanation was the missing half of the instruction. |
| **Adversarial content.** State is data and is not treated as hostile. | Tool output is state. A sieve over file contents feeds the model text this repo does not control. |
| **Generation.** Not a text model. | Extraction is a `Choice` over candidates found in code, never a request for the value. |

Two confidence rules from the same page bear on anything that reads a threshold:

- A `Noul` carries no separate confidence, so the probability is the signal.
- A `Choice` or `Score` confidence is a margin from the threshold **actually used**, not a probability the answer is right, so changing a threshold silently re-scales every confidence reading.

Reading raw `noul` and banding locally, which `jev.sh` and the sieve both do, is insulated from the second rule.
It also makes the band the only thing a calibration tunes, which is why section 8.2 item 5 puts the number and not the classification at the centre.

## 4. The constraint that decides the design

`agent/lattice.md:49-72` states it directly: if a workflow can be expressed as a Bash script invoked through the native `bash` tool, writing a TypeScript extension for it is an architectural failure.

A Jev call is a stateless HTTP round trip.
That is not a persistent transport protocol, so it does not earn extension criterion 3.

Correct placement:

- One execution-plane script, e.g. `~/dotfiles/scripts/jev.sh`, wrapping `POST /v1/systemone`. All ten ideas call it.
- Extensions only where lifecycle interception is genuinely required. `plan-mode.ts` already qualifies. It should `bash` out to the script, not embed an HTTP client.
- Skills and prompts call the script directly.

Ten extensions for ten ideas violates the litmus test ten times.
One script plus existing hooks covers it.

## 5. Blockers

1. **~~No credentials.~~ Cleared 2026-09-18.** The key lives at `~/.config/typesafe/credentials.env`, mode 600, outside the repo, never in argv. `agent/auth.json` is not where it goes, and still holds `deepseek`, `google`, `openrouter`.
2. **The cheapest win is not free.** `classifierModel` in `agent/model-router.json` is a configuration value, but `runClassifier()` speaks the pi model stream protocol, not the TypeSafe HTTP protocol. It needs a code change inside an installed package, which `pi install`/`remove` will overwrite.
3. **Latency is still unverified locally, and the range is wide.** External measurements run from 150 ms to 2.5 s depending on state size and batch size, with 0.5-2.5 s reported for a four-question batch against a larger state. The 9 Hz decision loop in OneVOneJev is the other end of that range and must use a deliberately small state. A 227 ms median is quoted elsewhere, but it is not on the vendor's page or Pydantic's and stays third-party. So the live-UI idea is viable only in the small-state case, and that is the case to measure before any footer work starts. See sections 8.3 and 8.7.
4. **Rate limits are shared across all callers.** 1,200 req/min is generous for personal use, but a per-keystroke linter would consume it quickly. Batch questions into one request instead. Every external project that fans out - winnow, jev-ultrafast, OneVOneJev - batches into a single request. Treat batching as the required call shape, not an optimization on top of it. prism paces at about 30 req/min through a single choke point because the quota is unpublished, which is a better default than trusting 1,200/min.

## 6. Suggested order

Superseded by section 8.6, which keeps this order and adds what the external projects show the script has to do.

1. Get an API key, write `~/dotfiles/scripts/jev.sh`, and ask one `Choice` question end to end. Prove the round trip and measure real latency.
2. Swap the model router classifier, as a local patch that will be clobbered on reinstall.
3. Skill picker, since it is a `Choice` over a list already maintained here.
4. Guardrail as a second gate in `plan-mode.ts`, behind the existing human confirm.

## 7. Deliberately skipped

- Any new extension on the ten ideas in section 3. The litmus test forbids it. Section 8.4 finds one hook that would pass the test, and it is a separate, larger piece of work.
- RAG filter and corpus map-reduce. Nothing in the tree to attach them to.
- Live UI, until latency is measured.

## 8. External use cases

Fourteen projects, reviewed 2026-09-17.
Every repository exists and was read at README level; where the README was silent, the commit history was checked.
Nothing here was executed.

Three corrections to the list of fourteen as it circulated:

- `andrelandgraf/typesafe-on-neon` is now `andrelandgraf/safer-with-jev`.
- `lahfir/agent-desktop` is not a Jev project.
  It is a general accessibility-tree computer-use agent from February 2026.
  The Jev loop is on the `feat/jev-desktop-loop` branch and a recent commit, absent from the README.
- `irfndi/prism-liquidity-agent` has no Jev mention in its README, but it is the most careful integration in the set and the only one that publishes a calibration protocol.
  Three commits on 2026-09-17, in dependency order: `3a26edc` shadow-only judgments plus a pacing gate, `71977a5` the endpoint fix, `22c67bd` the paper-only soft gate.
  `engine/jev-service.ts`, `engine/jev-gate.ts`, and two test files carry it. See section 8.3.

One description error: `devagrawal09/jev-review` screens test coverage, not test risks.

### 8.1 The common shape

All fourteen allocate a scarce resource using a cheap, calibrated, typed judgment.

| Project | Resource being allocated |
|---------|--------------------------|
| jev-ultrafast | browser round trips |
| typesafe-mcp, jev-mcp | agent tool calls |
| semdecide | shell and CI branching |
| jev-codex-router, safer-with-jev | model spend |
| winnow | context window |
| jev-review | reviewer attention and heavy model calls |
| blink | filesystem walk budget |
| neo4jev | graph traversal budget |
| agent-desktop | desktop action attempts |
| typesafe-ai-playground | primitive coverage, one command per feature |
| prism-liquidity-agent | trading risk exposure |
| OneVOneJev | per-tick reaction time |

That table is the argument for section 3's ranking.
A router is the purest instance of the shape, not a sibling of it.

### 8.2 What the ecosystem does that this tree should copy

1. **Fan out into one request.**
   jev-ultrafast asks the operation plus every compatible target head in one round trip, then executes only the compatible one.
   OneVOneJev fans out six heads - move, yaw, pitch, ADS, fire, jump - at ~9 Hz.
   winnow fans out one question per ~25-line block, a hundred questions in one call.
   jev-review opens with a Noul risk matrix over five dimensions.
   This is the mechanism behind the throughput numbers, not a layer on top of them.
   Consequence for section 4: the script must take a batch of questions, not one.
   A one-question-per-process shape pays process startup on every ask.

2. **Ask speculatively.**
   The target questions in jev-ultrafast are documented as speculative; an unused answer costs question tokens only.
   Ask for every branch the local code might take, then discard.

3. **Fail open.**
   jev-codex-router: "any Jev error keeps the turn alive".
   OneVOneJev: a deterministic heuristic behind the same action interface, so matches never stall.
   prism: "advisory and fail-open, unknown signals never block".
   No project in the list gates on Jev being present.
   This generalizes section 3's guardrail verdict: keep the human confirm, and never let the model's absence stop the turn.

4. **Keep the uncertain middle.**
   winnow holds two thresholds and keeps the uncertain band verbatim.
   semdecide "does not silently force borderline results into true or false" and exposes `--uncertainty-margin`.
   jev-codex-router does not downgrade below its 0.5 gate.
   prism halves exposure rather than vetoing, and runs in shadow first.
   The outcome is three-way - act, keep, abstain - and the middle is a decision to make explicitly, not to round off.

5. **Calibrate the threshold locally.**
   winnow's 0.1 drop threshold came from hand-labeled replay, and its README says to raise it only with your own evidence.
   jev-codex-router's 0.5 gate is backed by a finding that matters here: falling back to the frontier model below the gate eats about 80% of the savings.
   The gate value, not the classification, dominates the outcome.
   Section 1's "thresholds scale with stakes" is right, and the number has to come from a replay of this tree's own turns rather than a default.
   Section 8.3 has the only worked example of that replay in the set.

6. **Keep policy in code.**
   jev-review keeps orchestration in code and applies thresholds in code, using Jev only for bounded judgments at fixed stages.
   blink spends the returned probability splitting a fixed walker budget.
   The judgment informs an allocation the caller makes.

7. **A judgment is a prompt, not a proof.**
   jev-review states it: "Findings are review prompts, not proof of a defect".
   typesafe-ai-playground prints the raw Noul value "without rounding or thresholding".
   Do not let an answer stand in for the check it is ranking.

### 8.3 Prism's method, the reference for calibration

`irfndi/prism-liquidity-agent` is the one to copy the method from.
Its Jev work is three commits inside one day, and the order is the point.

| Time (2026-09-17) | Commit | What it added |
|-------------------|--------|---------------|
| 02:12 | `3a26edc` | shadow-only consults, four judgments, pacing gate |
| 02:22 | `71977a5` | fix: the bare host 404s every consult without `/v1/systemone` |
| 05:13 | `22c67bd` | paper-only soft gate, flag default OFF |

Shadow, then calibrate, then a bounded gate - the same discipline section 3 asks for on the guardrail, carried through in three hours.

**Shadow first, and paired with the gate it shadows.**
`engine/jev-service.ts` opens with the contract: four narrow judgments, one per existing heuristic gate, each with "a deterministic fallback that the engine keeps using; Jev output is logged alongside the fallback for calibration and NEVER drives ENTER/EXIT".
The four are `depositPick` (Choice spot|curve|bidask), `toxicFlow` (Noul), `recoveryHold` (Noul), and `regimeStress` (Noul).
That shape beats a free-floating "is this good" question, because each judgment is paired with the deterministic gate it shadows, so a disagreement is measurable and the fallback already exists.

**Calibrate on a labeled replay, tuned on one split and validated on another.**
The shadow commit reports 374 ENTER candidates with realized labels: baseline -$180.55 at PF 0.301, versus a `toxic < 0.20` filter at -$22.79 and PF 0.760, keeping 145 of 176 winners.
The gate commit reports A-tune to B-validate over 180 consults on split B: PF 3.53 against a base of 1.74.
Both stages are stated in the commit message and repeated in the source comment beside the threshold constant.
Nothing else in the fourteen publishes a protocol this concrete.

**Shape the action as bounded, not binary.**
The gate halves position size and never vetoes, is floored at `ENTRY_SIZE_FLOOR_USD`, is flag-gated default OFF, is paper-only, and applies to the normal lane only.
The commit message says it in four words: "halve, never veto".

**Do not let a gate change an earlier predicate's input.**
The expected-profit check runs on the full size first and the halve applies after, with the source comment giving the reason: profit math must not see a halved size that passes costs the full size would fail.
A gate placed upstream of a check silently rewrites that check.

**Pace against an unpublished quota.**
`engine/jev-gate.ts` routes all Jev traffic through one process-wide choke point: a 2 s minimum interval plus an escalating 429 breaker (1, 2, 4, ... 60 min) that fails fast with a synthetic 429 so "a ban can never be refreshed by retry loops".
2 s is about 30 requests/min against a documented 1,200/min ceiling, and the file gives the reason in capitals: "quota is UNKNOWN per docs".
Treat the documented limit as unusable until measured, and give the script one choke point rather than per-caller pacing.

**Batch, then pace.**
All four judgments travel in a single `systemOne` call, which is what keeps the 2 s interval affordable.

**Postscript on the type shape.**
`JevJudgments` is `ok: boolean` plus `failure: string | null` plus five nullable fields.
That is the boolean-gate and string-error shape the constructive modeling rule forbids.
If `jev.sh` mirrors this pipeline, use a tagged union instead and keep the failure classes prism already names - `disabled`, `error`, `timeout`, `rate_limited`, `invalid` - as the variants.

### 8.4 The hook section 3 missed

Section 3 maps a guardrail onto `pi.on("tool_call")` and finds no home for context work.
winnow's shape is the missing half, and pi supports it: `pi.on("tool_result")` fires after tool execution and before the result enters context, handlers chain like middleware, and they can replace the content.
`pi.on("context")` filters messages before each model call.
Both are documented in `docs/extensions.md`.

So context work on the `read`, `bash`, and `grep` results this tree already produces is lifecycle interception, litmus criterion 1, not a new capability.
It is the second candidate after the router and it is a larger piece of work, so it does not displace it.

blink stays in the "new capability" bucket: `fffind` and `ffgrep` are lexical and frecency-ranked, and a probability-ranked path walk answers a different question.
Section 3's verdict for semantic search is unchanged.

### 8.5 The litmus test holds

Nothing in the fourteen changes section 4.

- Four projects put the judgment in a plain CLI: semdecide, blink, neo4jev, typesafe-ai-playground.
- winnow owns a harness hook because it needs `PostToolUse` and the resident server that makes the hook cheap.
- jev-codex-router deliberately avoids forking, registering through a generic provider plus a curated model so that router updates never clobber it.

"Ten extensions for ten ideas" remains the wrong answer.
The ecosystem is scripts plus hooks, and the hooks exist only where a harness event had to be intercepted.

### 8.6 Revised order

Status 2026-09-22: item 1 is done, and item 5 shipped before items 2 and 3, which is the inversion item 5 was written to prevent. Item 5's own gate - "only if steps 2 and 3 show the judgments are worth trusting" - was not met. Section 9 has the measurements.

1. Get a key, then write `~/dotfiles/scripts/jev.sh`.
   Batch questions into one request, emit a stable JSON envelope, expose threshold and uncertain-band flags, and fail open with the failure distinguishable from a verdict.
   semdecide's `--json` shape is the one to copy: `verdict`, `probability`, `confidence`, `threshold`, `model`, `usage`.
   Read the key from an env file outside the repo, mode 600, as semdecide and winnow both do.
   Give it a 2 s choke point and a 429 breaker from the start, following section 8.3, rather than trusting the documented 1,200/min.
   Measure one round trip and a batch of four against a realistic state, since section 8.3 shows the batch case is the slow one.
2. Swap the router classifier's judgment, not its policy.
   `runClassifier()` gets semantic-property questions asked directly, and the tier
   rule stays in code beside the deterministic facts already in `model-router.json`.
   Do not ask for the tier. A `Choice{high, medium, low}` over task text plus model
   metrics makes the model recover the decision model for you: which kind of task
   this is, and how latency and retry rate trade against it. jev-tip.md names that
   as the mistake, and section 8.2 item 6 already says to keep policy in code, so
   this step previously contradicted it.
   Still the cheapest win, and still a patch that a reinstall clobbers.
   Calibrate the combination rule, not the classification, against a labeled replay
   of this tree's own turns instead of starting at 0.5, using the tune-then-validate
   split in section 8.3.
3. Skill picker.
   Latency is not the constraint here, because the same shape already runs at 9 Hz elsewhere.
4. Guardrail as a second gate behind the human confirm in `plan-mode.ts`.
5. Context GC on `tool_result`, only if steps 2 and 3 show the judgments are worth trusting.

### 8.7 The framework layer, and a second-hand summary that got the names wrong

Framework support landed between 2026-09-17 and 2026-09-20, after section 8 was compiled.
A second-hand summary of it circulates with two class names that do not exist, so this section records what the vendor and framework pages actually say.

| Thing | The summary's version | The source's version |
|---|---|---|
| LangChain middleware | `ModelRoutingMiddleware`, `ToolRiskGatingMiddleware` | `ModelRouterMiddleware` and `AutoModeMiddleware`. Neither name in the summary exists. |
| LangChain package | `langchain-typesafe[experimental]` | Correct, and alpha: `0.0.1a1`-`0.0.1a3`, MIT, 2026-09-17 to 09-20. |
| Model routing granularity | "swaps the primary model before execution" | Classifies the latest human message **once per agent run**, and stores the whole `ChoiceAnswer` in agent state. Per run, not per turn. |
| Tool risk gating | "injects an error and blocks execution" | True as `AutoModeMiddleware`, and the default is a **veto**: a call at or above the risk threshold returns an error `ToolMessage`. It applies only to tools listed explicitly by name. |
| Pydantic AI | `TypeSafeModel` | Correct. Each `output_type` field becomes one question in one request, and `provider_details['confidence']` is a margin from the threshold in use, not a probability the answer is right. |
| Vercel | "an experimental evaluation interface" | `experimental_evaluate` in AI SDK 7+, or the TypeSafe-compatible base URL `https://ai-gateway.vercel.sh/typesafe` with `POST /typesafe/v1/systemone`, sharing the vendor's request, response and error shapes. |
| `SkillsMiddleware` | presented as part of the TypeSafe package | Not in the package docs. The `SkillsMiddleware` in LangChain's own documentation belongs to `deepagents`. Unverified. |
| 227 ms median latency | quoted as a vendor benchmark | Not on the Pydantic page. Third-party only, so section 1 and section 5 item 3 stand. |

Two things to take from the framework layer, one to refuse, and one to defer.

- **Take the explicit tool allowlist.** `AutoModeMiddleware` gates only the tools it is handed by name, which is a better shape than gating everything. It can be copied into any `tool_call` gate here without copying the verdict.
- **Take `FallbackModel(fallback_on=...)`.** It reads the response, so the cheap model answers what it can and an LLM takes the rest. That is the mechanism behind section 8.2 item 4, with the standing caveat from `jev-codex-router` that a bar set too high eats most of the savings.
- **Refuse the veto default.** The doctrine here, taken from prism, is "halve, never veto" plus fail-open. A framework that blocks the turn by default imports a failure mode this tree already rejected, on a judgment with no local calibration.
- **Defer the AI Gateway base URL.** `jev.sh` reads `JEV_ENDPOINT`, so pointing at Gateway is a swap with no code change. It also inserts a billing middleman into a working integration, which waits until unified spend or tracing is worth more than that.

## 9. What the sieve measured

The sieve is the one Jev integration that runs, so it is the only place with local evidence.
`~/.cache/jev/sieve.jsonl` holds 387 judged documents and 1,938 block verdicts across two instrument generations, all in shadow mode, every document batched into a single pass.
The input total is 1.43 M characters, about 1.5 cents at $0.042 per million input tokens.

| | Earlier (asked by state path) | Later (asked by question key) |
|---|---|---|
| Documents / blocks | 119 / 540 | 268 / 1,394 |
| `noul` range | 0.04 - 0.93 | 0.12 - 0.55 |
| Standard deviation within one document | 0.063 | **0.008** |
| Blocks at or below the 0.10 hide line | 29 | **0** |
| Bands | 29 no / 352 uncertain / 159 yes | 0 no / 1,380 uncertain / 14 yes |

The later question referred to "the state block whose id is this question's key".
Question ids are the caller's handle and are not sent to the model, so all N sibling questions arrived identical.
Section 3.1 predicts the result twice over: indirection costs accuracy, and semantically similar inputs get quantitatively similar answers.

The later instrument therefore measured the document, not the block, while the decision it drove is per block.
`on` mode would have hidden nothing, because nothing reached the band, and lowering the threshold to compensate would have hidden roughly half the blocks on a signal with no separation.
The question id is now `sieve.noul.v2` and the text names `blocks[i].text` again.
The threshold stays where it is until a labeled replay exists.

Three consequences worth keeping.

1. **The instrument version belongs in the log.** The earlier generation recorded no question id at all, and the later one recorded `sieve.noul.v1` while its question text had already changed. Both are why the id now bumps on any wording change.
2. **A calibration cannot survive an instrument change.** Bumping the question invalidates every reading taken before it, including the readings that argued for the bump. That is the point of the field, not a side effect.
3. **Shadow earns the same labels as `on` and risks nothing.** A recall is the only free label the harness has, and it is biased: a hide the agent never notices leaves no record. So the read-back rate is a lower bound on false negatives, not an estimate.

Two changes follow from that and are now in place.

- **Shadow caches the candidate blocks.** Both modes write the text of every block the band marked `no`; only the replacement is `on`-only. Shadow therefore builds a labeling dataset without ever mutating context, which is what breaks the circularity of "labels need `on`, `on` needs labels".
- **`jev_sieve_report.sh` is a gate, not a report.** It groups by instrument version and prints a verdict: `NOT READY` when there is nothing cached or too few candidates, `READY TO LABEL` when the sample is large enough, and `QUALIFIED` versus `NOT QUALIFIED` once `on`-mode read-backs exist, against a Wilson one-sided 95% upper bound on the false-negative rate. `--samples` prints the labeling worklist, joined to the instrument version, `namedInTask`, and the reading, so a hand label can be stratified by the field that predicts it.

## Appendix: reference shapes

Choice question and answer, from the docs:

```json
{
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this",
      "criteria": {
        "billing": "Payment or subscription issues",
        "technical": "Bugs or integration problems",
        "sales": "Pricing or account questions"
      }
    }
  }
}
```

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "technical",
      "probabilities": { "billing": 0.02, "technical": 0.96, "sales": 0.02 },
      "confidence": 0.94
    }
  }
}
```

The second block is illustrative. Shapes are from the API reference; the exact numbers are made up to show the form.

## Appendix: documents read

- `https://docs.typesafe.ai/introduction`
- `https://docs.typesafe.ai/introduction/quickstart`
- `https://docs.typesafe.ai/concepts/system-one`
- `https://docs.typesafe.ai/concepts/state`
- `https://docs.typesafe.ai/concepts/use-case-map`
- `https://docs.typesafe.ai/primitives`
- `https://docs.typesafe.ai/confidence`
- `https://docs.typesafe.ai/patterns`
- `https://docs.typesafe.ai/patterns/fan-out`
- `https://docs.typesafe.ai/patterns/intent-routing`
- `https://docs.typesafe.ai/patterns/confidence-routing`
- `https://docs.typesafe.ai/models`
- `https://docs.typesafe.ai/api`
- `https://docs.typesafe.ai/sdk`
- `https://docs.typesafe.ai/model-jaggedness/jev-1.13`

Framework pages read 2026-09-22, for section 8.7:

- `https://pypi.org/project/langchain-typesafe/`
- `https://pydantic.dev/docs/ai/models/typesafe/`
- `https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe`

Surfaced in search and consistent with those, but not read in full: the `langchain-typesafe` release notes, `ai-sdk.dev/docs/ai-sdk-core/evaluation`, `vercel.com/docs/ai-gateway/modalities/evaluation`, and a third-party summary carrying the 227 ms figure and the two wrong middleware names.

Local files read: `agent/lattice.md`, `agent/settings.json`, `agent/model-router.json`, `agent/extensions/plan-mode.ts`, `agent/extensions/notifications.ts`, `agent/scripts/__check.sh`, `agent/npm/node_modules/@yeliu84/pi-model-router/extensions/routing.ts`, `agent/git/github.com/eko24ive/pi-ask/skills/ask-user/SKILL.md`, `neuro-symbolic-audit.md`, `README.md`.

Added when section 8 was compiled: `agent/primitives/` (nine `.schema.json` files), `agent/auth.json`, the extension event list and the `tool_result` and `context` handler contracts in `pi-coding-agent/docs/extensions.md`, and `~/dotfiles/scripts/`, which then held no `jev.sh` and has held one since 2026-09-18.

Added after the sieve shipped: `~/.pi/jev-tip.md`, whose metrology argument drives section 8.6 item 2. It holds that the instrument is the tuple (model, state representation, question), that those must be pinned before any reading is comparable, and that a judgment can be correct relative to a bad representation while the decision built on it is wrong. The sieve's versioned state and its recall label follow from that.

Added when section 9 was compiled: `~/.cache/jev/sieve.jsonl` (read as data), `~/dotfiles/scripts/jev_sieve_report.sh`, `agent/extensions/jev-sieve.ts` at `HEAD` and in the working tree, `agent/skills/typesafe-ai/SKILL.md` (TypeSafe's own agent skill, restored verbatim, whose load-bearing line is "Question IDs are for code and are not sent to the model"), `~/dotfiles/scripts/jev.sh`, and `~/dotfiles/scripts/vox_jev.sh`.

Two runnable checks sit at the repo root, outside `agent/extensions/` so pi never loads them: `jev-sieve.check.ts` for the pure logic (35 assertions) and `jev-sieve.e2e.check.ts` for the impure half (10 assertions, against a stub `JEV_SH` in a temp directory). The second exists because the invariant it guards fails silently: if shadow stops caching, the gate above blames a flat instrument instead of a cache gate.

### Appendix: external repositories read

Read at README level, with commit history checked where the README was silent.
None was executed, so every number attributed to them is quoted rather than reproduced.

- `browser-use/jev-ultrafast`
- `itsmostafa/typesafe-mcp`
- `jkudish/jev-mcp`
- `sharziki/semdecide`
- `0xNatoshi/jev-codex-router`
- `GhalebDweikat/winnow`
- `devagrawal09/jev-review`
- `ellipsis-dev/blink`
- `jexp/neo4jev`
- `lahfir/agent-desktop`
- `markjaquith/typesafe-ai-playground`
- `irfndi/prism-liquidity-agent`
- `emrickgarrett/OneVOneJev`
- `andrelandgraf/safer-with-jev`

Read below README level: `irfndi/prism-liquidity-agent` at `engine/jev-service.ts`, `engine/jev-gate.ts`, `bench/jev-service.test.ts`, and commits `3a26edc`, `71977a5`, `22c67bd`, because it is the only one of the fourteen carrying a calibration protocol worth copying.
