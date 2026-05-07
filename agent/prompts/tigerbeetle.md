---
description: TigerBeetle engineering philosophy — safety, determinism, and zero-cost abstraction applied to all code paths
---

You are coding under TigerBeetle's architectural philosophy. These are
not suggestions. They are the standard.

## Safety Above All Else

1. **Assertion density ≥ 2 per function.** Assert preconditions before
   mutation. Assert postconditions after. Assert invariants at every
   boundary. If you can't assert it, you don't understand it.

2. **No `.unwrap()` in production code paths.** Every fallible
   operation must be handled or explicitly propagated. A panic is
   acceptable only for programmer error (invariant violation), never
   for runtime data.

3. **Typed errors, not strings.** Error types must be enumerated.
   Never return `Result<(), &str>` or equivalent. The caller must be
   able to match on the error variant.

4. **Pair-assert before write AND after read.** After writing data,
   immediately read it back and assert it matches what you wrote.
   Hardware lies. File systems lie. Databases lie.

## Mechanical Sympathy

5. **No dynamic allocation on the hot path.** Allocate once at
   initialization. The critical path must be allocation-free.

6. **Batching over individual operations.** If you process N items,
   process them in a batch. One network round-trip, one filesystem
   sync, one lock acquisition.

7. **Control plane / data plane separation.** O(1) decisions must
   live outside O(N) loops. Never mix metadata computation with
   record processing.

## Code Discipline

8. **Function length ≤ 70 lines.** Hard limit. If a function exceeds
   this, extract a helper. No exceptions for "complex" logic —
   complexity is exactly what benefits from decomposition.

9. **Line width ≤ 100 columns.** Format aggressively. If a line wraps,
   restructure it.

10. **Zero technical debt.** No `// TODO`, no `// FIXME`, no deprecated
    code left in tree, no commented-out blocks. Ship it clean or don't
    ship it.

11. **Units in variable names.** `latency_ms`, `timeout_sec`,
    `max_retries`, `buffer_bytes`. Never `latency`, `timeout`,
    `max`, `buffer`.

## Architecture

12. **Single source of truth.** Data lives in exactly one place.
    Derived state is computed on read, never stored.

13. **Explicit boundaries.** Every module declares its public surface.
    Internal state is never leaked across module boundaries.

14. **Design for determinism.** Given the same inputs and the same
    state, produce the same outputs. Seed randomness. Log seeds.
    Reproduce bugs from a git commit + seed.

## When in Doubt

- Simplify. The correct answer is usually fewer lines.
- Remove, don't add. A deleted line can't cause a bug.
- If you can't explain the invariant in one sentence, the code is
  wrong.
