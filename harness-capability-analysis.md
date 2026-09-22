# Pi Harness Capability Analysis

Scope: can this harness run a background agent session that merges its context back into a live main session?

Subject: `@earendil-works/pi-coding-agent` (installed at `/home/m0xu/.npm-global/lib/node_modules/@earendil-works/pi-coding-agent`) and its agent core `@earendil-works/pi-agent-core`.

Method: source reading plus a runnable probe at `/tmp/pi-probe.mjs`.
The probe injects a fake stream function so it records the exact provider payload per turn with no network and no API key.
Result: 3/3 pass.

| # | Capability | Verdict |
|---|---|---|
| 1 | Session isolation | Partial |
| 2 | History mutation | Yes, with a snapshot boundary |
| 3 | Interrupt channels | Yes at turn granularity, no preemption |
| 4 | Cache behavior | Append-only merges keep the prefix |

## 1. Session isolation - PARTIAL

One `Agent` is one context window and it is hard serialized.
A second concurrent `prompt()` throws `"Agent is already processing"` (`pi-agent-core/dist/agent.js:226`, probe case 2).
There is no lane-level parallelism inside a single session.

Two independent context windows require two objects: either `createAgentSession()` twice in one process, or a child `pi --mode rpc` process.
Probe case 1 ran two agents at the same time with their own system prompt, own transcript, own message array, and own model, with no cross-talk.

Concurrency here is async-task style, promise interleaving on I/O, closer to `tokio` tasks than to parallel goroutines.
Everything shares one JS thread, so a CPU-bound background session will stall the main one.

Per-thread model selection works.
Set it with `createAgentSession({ model })` or `session.setModel()`.
A per-turn refresh re-reads model, thinking level, system prompt, and tools before every turn (`dist/core/agent-session.js:277-290`).

There is no built-in job queue and no pub/sub consumer.
`pi.events` is a bare `node:events` emitter (`dist/core/event-bus.js`): synchronous emit, no persistence, no backpressure, handler errors go to `console.error`.
The job queue is yours to write.

The designed multi-lane API exists but is a skeleton.
`AgentHarness` and `AgentLane` declare `createLane()`, `lanes()`, `LaneBusy`, `LaneSnapshot`, and `SuspendedOperation`, and every method rejects with `HarnessNotImplemented` (`pi-agent-core/dist/harness/agent-harness.js:109-194`).
Do not build on lanes yet.

A working precedent is already installed.
`@tungthedev/pi-extensions` boomerang spawns children as `pi --mode rpc --session-dir ~/.pi/subagents/sessions --model <X>` (`dist/src/subagents/subagents/attachment.js:26-40`).

## 2. History mutation - YES, WITH A SNAPSHOT BOUNDARY

The message history array is exposed and mutable.
`agent.state.messages` returns the live array from a getter, and the setter copies the top-level array (`pi-agent-core/dist/agent.js:37-44`).
Nothing locks it while streaming.

The catch is that the running loop works on a snapshot taken at run start (`createContextSnapshot()`, `pi-agent-core/dist/agent.js:283`).
Probe case 3 showed a mid-run `state.messages.push()` never reaches the provider payload, while it does land in the stored transcript.
That is wire/transcript divergence.
Raw array mutation is not a merge channel during an active run.

The real merge channels are:

- `agent.steer(msg)`, `session.steer()`, or `pi.sendMessage(..., { deliverAs: "steer" })`.
  Drained at turn boundaries (`pi-agent-core/dist/agent-loop.js:83,160`), pushed onto the live context, and emitted as `message_start`/`message_end` so `SessionManager` persists them (`dist/core/agent-session.js:381`).
- Idle injection with no turn trigger, which pushes to `state.messages` and appends the session entry in one step, keeping both stores consistent (`dist/core/agent-session.js:1090-1096`).
- `transformContext`, surfaced as the `context` extension event, which allows arbitrary non-append rewrites once per LLM call (`dist/core/sdk.js:227`).

Injected `custom`-role messages convert to `user` in place with order preserved (`dist/core/messages.js:89`).

Limit: merge granularity is the turn boundary.
An in-flight stream can be aborted, not amended.

## 3. Interrupt channels - YES AT TURN GRANULARITY, NO PREEMPTION

A background session can wake the main session with no user input.
`pi.sendMessage({...}, { triggerTurn: true })` or `pi.sendUserMessage()` starts a run immediately while the user sits at the editor prompt (`dist/core/agent-session.js:1084-1090`).
That is the priority signal.
The installed subagent package uses exactly this pattern: `parentIsStreaming ? { deliverAs: "steer" } : { triggerTurn: true }` (`dist/src/subagents/subagents/notifications.js:6`).

Mid-run delivery modes:

- `steer` lands before the next LLM call.
- `followUp` lands before the agent settles.
- `nextTurn` waits for the next user prompt.
- `abort()` is the only hard stop.

Cross-process transport is RPC line-delimited JSON with `steer`, `follow_up`, and `abort` inbound plus event notifications outbound (`docs/rpc.md:80-134`).
There is no WebSocket session broadcast.
`dist/client/remote-session.js` and `dist/server/create-harness.js` exist but ride the unimplemented harness.

Missing: priority levels.
There is one FIFO steer queue with `steeringMode: all | one-at-a-time`.
A background signal cannot jump ahead of an already-queued user steer, and it cannot interrupt an active stream.

## 4. Cache behavior - APPEND-ONLY MERGES KEEP THE PREFIX

The Anthropic path puts `cache_control` on the system block, the last tool, and the last user or tool_result block (`pi-ai/dist/api/anthropic-messages.js:747-771, 995-1015, 1047`).
That is a moving tail breakpoint, so appends are cache-friendly by construction.

Probe case 3 confirmed the behavior: turn 2's payload equals turn 1's prefix plus the assistant message plus the injected message, with an identical prefix and an unchanged system prompt.

Cache killers to avoid during a merge:

- Touching the system prompt or the tool set.
  Both are rebuilt every turn (`dist/core/agent-session.js:277-290`), so a single `setActiveTools()` on merge re-bills the whole prefix.
- Filtering or reordering inside the `context` event (`dist/core/sdk.js:227`).
- `before_provider_request` payload rewrites.
- Model switch per turn, and compaction.
  Both are full prefix resets.
- The 5 minute TTL.
  A background session that only wakes the main one after a long idle gap pays a full cache write anyway (`CACHE_TTL_MS`, `dist/core/cache-stats.js:5`).

Measurement is built in.
`detectCacheMiss()` plus TUI notices such as "Cache miss after model switch" and "Cache miss after Nm idle" (`dist/modes/interactive/interactive-mode.js:3110-3126`).
Enable `showCacheMissNotices` and the merge design gets a scoreboard.

## Verdict

Buildable today:

1. Main `AgentSession` plus N child sessions, either an RPC child process or an in-process `createAgentSession()`.
2. Merge by `steer` or `sendMessage`, append only, never a raw `state.messages` push during a run.
3. Wake the main session with `triggerTurn` while it is idle.
4. Never touch the system prompt, tool set, or model on merge.

Blocked or absent:

- Lanes are stubbed (`HarnessNotImplemented`).
- No job queue or scheduler.
- No mid-call preemption and no priority queues.

## Reproduce

```bash
node /tmp/pi-probe.mjs
```

Expected output:

```
1 concurrent isolated windows + per-window model: PASS
2 single agent rejects concurrent prompt: PASS
3 steer = append-only merge; raw push = divergence: PASS
```
