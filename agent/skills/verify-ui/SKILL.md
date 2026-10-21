---
name: verify-ui
description: Prove a UI change on the real surface with the kitesurf chrome-devtools MCP server. Opens the page, acts like a user, then reports a screenshot, console output, and network calls as the artifact. Use after any change to rendering, layout, forms, or client state, and whenever a claim about behavior in a browser needs evidence instead of inference.
---

# Verify UI - real-surface proof

Tests and a compile are proxies. This skill produces the artifact: what the page rendered, what
the console said, what went over the wire.

## Prerequisites

- The app is reachable: a dev server on a known URL, or a deployed URL.
- The kitesurf MCP server is connected. Its tools are the `mcp__kitesurf__*` family.

If the server is not running, say so and stop. Do not report a UI change as verified from code
reading. Starting the dev server is part of the work.

## Steps

1. **State the claim.** One sentence: what a user should now see or be able to do. This is what
   the artifact must show.
2. **Open the surface.** `mcp__kitesurf__new_page` with the URL. Note the `pageId`.
3. **Snapshot before acting.** `mcp__kitesurf__take_snapshot` and read the element `uid`s. Never
   guess a selector from memory.
4. **Act as the user.** `mcp__kitesurf__fill_form` for inputs, `mcp__kitesurf__click` for
   buttons, `mcp__kitesurf__press_key` for keys. Prefer one batched `fill_form` over many fills.
5. **Wait for the observable change.** `mcp__kitesurf__wait_for` on the text or state that proves
   the claim, rather than sleeping.
6. **Capture the evidence.**
   - `mcp__kitesurf__take_screenshot` to a file path, full page when layout is the claim.
   - `mcp__kitesurf__list_console_messages` filtered to `error` and `warn`.
   - `mcp__kitesurf__list_network_requests` filtered to `xhr` and `fetch`; inspect a failing one
     with `mcp__kitesurf__get_network_request`.
7. **Assert against the claim.** Name pass or fail. A console error, a 4xx/5xx, or a screenshot
   that does not show the change is a fail, not a caveat.
8. **Report.** Screenshot path, the console lines that matter, the request that proves or breaks
   the flow, and one line per step of what you did. Close the page when done.

## Rules

- One page, one claim, one artifact. Two claims get two passes.
- The screenshot is quoted by path, never described from memory.
- A blank page, a spinner, or a login wall is a finding to report, not a reason to fall back to
  reading the code.
- Deterministic repro: record the exact URL, viewport (`mcp__kitesurf__resize_page`), and any
  preconditions. Someone else must be able to repeat it.
- Emulate the reported conditions when the bug is device- or network-specific:
  `mcp__kitesurf__emulate` for viewport, color scheme, reduced motion, or throttling.

## When to skip

Skip only when the change cannot reach a browser: a build script, a server-side job, a CLI. Say
which surface you verified instead and quote its output.
