# Neuro-Symbolic Agent Harness Audit: Pi Coding Agent (v0.81.1)

## 1. Executive Summary

Pi achieves **moderate neuro-symbolic maturity at the tool-call boundary** (TypeBox schema validation + coercion before every execution) but **has no system-level symbolic layer beneath it**. There is no guard on how many tool calls can execute, no domain-invariant enforcement beyond per-tool JSON schemas, no re-validation after extension hooks mutate validated arguments, and no bound on the agent loop. The harness trusts the probabilistic layer to self-regulate after parse errors rather than imposing deterministic ceilings.

## 2. Deficiency Matrix

| # | Component | File | Risk | Failure Mode |
|---|-----------|------|------|-------------|
| 1 | **Agent loop** | `agent-loop.js:85` | **HIGH** | Unbounded Loops |
| 2 | **beforeToolCall hook** | `agent-loop.js:405-426` | **HIGH** | State Mutation |
| 3 | **Streaming JSON parser** | `json-parse.js:90-112` | **MED** | I/O Deserialization |
| 4 | **JsonRepair** | `json-parse.js:28-70` | **MED** | I/O Deserialization |
| 5 | **Agent state** | `agent.js:26-49` | **MED** | State Mutation |
| 6 | **No domain invariants** | All layers | **HIGH** | Semantic Blind Spots |
| 7 | **primitives/ schemas** | `~/.pi/agent/primitives/` | **LOW** | Semantic Blind Spots |
| 8 | **Session integrity** | `session-manager.js` | **LOW** | State Mutation |
| 9 | **Extension message mutation** | `agent-session.js:473-485` | **MED** | I/O Deserialization |
| 10 | **Retry-only bounding** | `agent-session.js:388-400` | **MED** | Unbounded Loops |

### Finding 1: Unbounded `while(true)` Agent Loop (HIGH)

**Location:** `agent-loop.js:85`

```javascript
while (true) {           // ← OUTER: no counter, no bound
    let hasMoreToolCalls = true;
    while (hasMoreToolCalls || pendingMessages.length > 0) {  // ← INNER: no counter
        // ... stream response, execute tool calls, loop
    }
    const followUpMessages = (await config.getFollowUpMessages?.()) || [];
    if (followUpMessages.length > 0) {
        pendingMessages = followUpMessages;
        continue;        // ← restarts inner loop
    }
    break;
}
```

The only termination mechanisms are: AbortSignal (user hits Escape), model returning no tool calls, `shouldStopAfterTurn` extension hook (not set by default), and empty message queues. There is no `MAX_TURNS`, no cumulative token budget check within the loop, no iteration counter. An adversarial or malfunctioning model emitting tool calls repeatedly, or an extension continuously pushing follow-up messages, can loop indefinitely.

**Evidence:** Lines 85 and 88 contain `while(true)` with no guard variable declared, incremented, or checked anywhere in the function.

### Finding 2: No Re-validation After `beforeToolCall` Mutation (HIGH)

**Location:** `agent-loop.js:405-426`

```javascript
const validatedArgs = validateToolArguments(tool, preparedToolCall);  // ← validation
if (config.beforeToolCall) {
    const beforeResult = await config.beforeToolCall({
        assistantMessage, toolCall, args: validatedArgs,         // ← mutable object passed
        context: currentContext,
    }, signal);
    if (beforeResult?.block) { /* ... */ }
}
// validatedArgs goes directly to execution — no re-validation after hook
```

The `beforeToolCall` hook receives `args` (the validated arguments object) as a mutable reference. Extensions can modify it in place. No re-validation occurs after the hook returns. The extension types declarations (`types.d.ts`) explicitly document the `tool_call` event's `input` as mutable. This is a bypass vector: a buggy or malicious extension can mutate validated args into values that violate the tool's TypeBox schema, and the mutated values will be executed.

**Evidence:** `agent-session.js:214-234` installs `_installAgentToolHooks` which passes `args` (validated in `agent-loop.js:404`) directly to `runner.emitToolCall()` and the result is used without calling `validateToolArguments()` again.

### Finding 3: `parseStreamingJson` Silent `{}` Fallback (MED)

**Location:** `json-parse.js:90-112`

```javascript
export function parseStreamingJson(partialJson) {
    if (!partialJson || partialJson.trim() === "") { return {}; }
    try { return parseJsonWithRepair(partialJson); }
    catch {
        try { const result = partialParse(partialJson); return (result ?? {}); }
        catch {
            try { const result = partialParse(repairJson(partialJson)); return (result ?? {}); }
            catch { return {}; }   // ← NEVER THROWS
        }
    }
}
```

A structurally malformed tool call (e.g., truncated JSON with missing braces) silently resolves to `{}`. The downstream TypeBox validation catches this for tools with required fields, but tools with entirely optional parameters (rare but possible for extension-registered tools) could receive an empty object that passes schema validation and executes with unintended defaults.

### Finding 4: `repairJson` — String-Level Only (MED)

**Location:** `json-parse.js:28-70`

The repair function only handles in-string corruptions (control characters, invalid escape sequences). It is a character-by-character state machine tracking `inString` booleans. It does not handle: missing closing braces, extra commas, unquoted keys, or truncated arrays. Non-repairable structural JSON falls through to `partial-json` (which can handle incompleteness but not all malformations) and then to the silent `{}` fallback.

### Finding 5: Mutable Agent State — No Transition Guards (MED)

**Location:** `agent.js:26-49`

```javascript
function createMutableAgentState(initialState) {
    return {
        systemPrompt: initialState?.systemPrompt ?? "",
        model: initialState?.model ?? DEFAULT_MODEL,
        thinkingLevel: initialState?.thinkingLevel ?? "off",
        // tools and messages have get/set that clone-on-assign
        isStreaming: false,           // ← directly mutable
        streamingMessage: undefined,  // ← directly mutable
        pendingToolCalls: new Set(),  // ← directly mutable
        errorMessage: undefined,      // ← directly mutable
    };
}
```

Only `tools` and `messages` have getter/setter protection. All other fields are directly mutable. There is no state machine to assert invariants like "`pendingToolCalls` must be empty when `isStreaming` is false." Extensions can write to `agent.state.systemPrompt` directly, bypassing the session-level rebuild logic.

### Finding 6: No Domain Invariant Enforcement (HIGH)

**Location:** Entire harness

No layer enforces domain invariants:

- **No tool preconditions**: `bash` does not validate that the working directory exists before spawning (it checks at executor level, not at agent level). No tool can declare inter-tool invariants ("read must precede write to same path").
- **No state transition rules**: Nothing prevents the agent from calling `write` on a file it hasn't `read` first, or `bash` on a directory it hasn't `ls`'d.
- **No contradiction detection**: The harness cannot detect that the model proposes logically contradictory operations (e.g., writing to `/dev/null` and then reading from it).
- **No composition validation**: If tool A returns an error for path X and tool B is about to operate on path X, there is no inter-tool check.

The entire "semantic" layer is delegated to the LLM's context window and the TypeBox per-tool parameter schemas. The `lattice.md` spatial protocol is prose documentation, never parsed or enforced by code. The `primitives/*.schema.json` files are never loaded at runtime — they are consumed only by prompt templates.

### Finding 7: Unused Runtime Schema Primitives (LOW)

`~/.pi/agent/primitives/` contains nine `.schema.json` files (ProjectContext, Glossary, ADR, Spec, DecisionTree, ReviewResult, CodingStandard, ReviewPolicy, Check). These are referenced by prompt templates via the lattice index, but **zero code paths load, parse, or validate against them at runtime**. They provide structured typing for LLM outputs with no enforcement. This is a missed opportunity — the Check schema (`check.schema.json`) is documented as serving "all code emission" but is only ever read as contextual prose by the model.

### Finding 8: No Cryptographic Integrity for Sessions (LOW)

`session-manager.js` appends each message as JSONL to `~/.pi/agent/sessions/<hash>.jsonl`. There are no checksums, no digital signatures, no HMAC. Tamper detection at the storage layer is impossible without external auditing.

### Finding 9: Extension `message_end` Mutation (MED)

**Location:** `agent-session.js:473-485`

```javascript
const replacement = await this._extensionRunner.emitMessageEnd(extensionEvent);
if (replacement) {
    this._replaceMessageInPlace(event.message, normalized);
}
```

Extensions can replace any message in-place on `message_end`, including messages that have already been through tool execution. The replacement undergoes basic role/content normalization but no schema re-validation against the message format that will be sent to the LLM in the next turn.

### Finding 10: Retry-Only Bounding, Not Loop Bounding (MED)

**Location:** `agent-session.js:388-400`

```javascript
_willRetryAfterAgentEnd(event) {
    const settings = this.settingsManager.getRetrySettings();
    if (!settings.enabled || this._retryAttempt >= settings.maxRetries) { return false; }
    // ...
}
```

The only system-level iteration counter is the retry mechanism (default: max 3). Retries only trigger on retryable errors (network, overload). Normal tool-call loops, steering/follow-up cycles, and compaction-driven continuations have no counter. The retry counter resets on any successful assistant response, so `fail -> retry -> succeed -> fail -> retry -> ...` can iterate unboundedly.

## 3. Critical Remediation Steps

### Priority 1: Harden the Loop (FM4)

- **Add `MAX_TOOL_CALL_ITERATIONS`** (e.g., 50) to `runLoop()` in `agent-loop.js`. Increment a counter per turn; force `agent_end` when exceeded.
- **Add cumulative token budget check**: track `totalTokens` across all LLM calls within one `runLoop` invocation and terminate when exceeding a configurable ceiling.
- **Expose these limits as configuration** (e.g., `settings.json`) so advanced users can tune them.

### Priority 2: Re-validate After `beforeToolCall` (FM2)

- **Clone `validatedArgs` before passing to `beforeToolCall`**, or **re-run `validateToolArguments()`** after the hook returns and before execution.
- Alternatively, make the hook contract explicit: `input` is read-only; extensions that need to modify arguments must return a replacement through a structured return value that gets re-validated.

### Priority 3: Add Domain Invariant Layer (FM3)

- **Load `primitives/*.schema.json` at runtime.** Validate LLM outputs that claim to produce structured data (e.g., specs, ADRs, review results) against their declared schemas before passing them to write tools.
- **Add inter-tool precondition hooks.** Allow constraints like "`write(path)` requires `read(path)` in the same turn" — initially as optional checks, with an escape hatch for intentional deviation.
- **Formalize `lattice.md` into a machine-readable manifest** (`lattice.json`) that the harness loads and validates on startup — directory boundaries, naming conventions, extension criteria.

### Priority 4: Harden JSON Parsing (FM1)

- **`parseStreamingJson` should throw on final (non-streaming) parse failures** instead of returning `{}`. Distinguish between streaming partials (where `{}` is acceptable) and finalized tool-call arguments (where structural failure should error).
- **Add structural repair to `repairJson`**: brace counting, trailing comma stripping, unquoted key quoting — or integrate a more robust repair library.

### Priority 5: State Machine Invariants (FM2)

- **Add `assert` guards in `processEvents()`** for critical invariants: `pendingToolCalls` must be empty when `agent_end` fires; `isStreaming` must be false when `agent_end` fires; `streamingMessage` must be undefined.
- **Make all `_state` fields private** with setter guards, not just `tools` and `messages`.

---

*Evidence base: `agent-loop.js` (549 lines), `validation.js` (269 lines), `json-parse.js` (113 lines), `agent.js` (413 lines), `agent-session.js` (2679 lines), `lattice.md` (176 lines), `bash.js` (361 lines). All files read in full from compiled dist under `@earendil-works/pi-coding-agent` v0.81.1.*
