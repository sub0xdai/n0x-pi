---
name: bridge-recon
description: Recon and fund-path probing for cross-chain swap and bridge front-ends. Use when asked to map a bridge or swap app's attack surface, hunt for a bridge or swap exploit, probe a deposit/order flow, or assess whether a cross-chain swap front-end is exploitable. Triggers on "recon this bridge", "recon this swap app", "attack surface of this swap", "find a bridge exploit", "is this swap exploitable", "probe the deposit flow", "can I steal from this bridge", or a swap/bridge URL plus a request to find bugs.
argument-hint: "Target URL or repo, and any scope or rules of engagement"
---

# Bridge Recon

Attack-surface mapping and fund-path probing for cross-chain swap and bridge front-ends.

Read the wiki before acting: `/home/m0xu/1-projects/security/red/wiki/`
Start at `README.md`, then `GLOSSARY.md`, then the numbered pages.
The wiki teaches the domain. This skill is the operational procedure.

## Non-negotiables

These override everything else in this skill and are not subject to judgement calls mid-task.

1. **Write probes, never unit tests.** A unit test asserts a property of code you control.
   Here you control nothing. A probe issues a live request and reports what came back.
   The transcript is the artefact.
2. **Prove the probe changed the request.** Print the value you actually sent, and include a
   control case whose expected outcome is a definite rejection. If the control passes, your
   mutation pipeline is broken, not the target. A uniform result matrix means nothing varied.
3. **Your own objects only.** Create and read your own orders. Never reach for another
   user's resource. Never enumerate what you do not own.
4. **State the boundary of what you sent.** Passive only, or GET only, or the product's own
   guest flow with no funds. Write the truth into the findings file as you go.
5. **Stop at the stop line.** See "The stop line" below.

## The stop line

Stop and record when the next step would take value, deny service at scale, or touch
infrastructure you are not authorised to touch.

Never do any of these:

- Fund an order to observe payout.
- Aim SSRF at private ranges, internal addresses, or cloud metadata endpoints.
  Use the RFC 5737 documentation ranges `192.0.2.1`, `198.51.100.1`, `203.0.113.1` as canaries.
- Test against another user's order or wallet.
- Run sustained load to find a rate limit. Use fast-failing payloads instead.
- Attack the counterparty provider. It is a different company and out of scope.

## Procedure

### Phase 1: Establish the architecture before anything else

Answer one question first: **does the platform custody funds, or does the user deposit
directly to a provider?**

If there is no custody, there is no pool to drain and the engagement is a search for
misdirection, not for a drain. Say so early. It reframes every later finding and prevents
a week of chasing the wrong class.

Evidence: the docs, the client bundle, whether a quote and an order are separate calls,
whether a deposit address is returned for the user to fund.

### Phase 2: Map the layers

Read the client bundle and extract:

1. Every API path.
2. Which paths attach an `Authorization` header, and which do not.
3. Every request body shape, so field names stop being guesses.
4. Which values the client generates itself (`randomUUID`, nonces, timestamps).
5. Every third-party script origin.

The bundle is the map of the whole stack and this extraction is the highest-yield hour of
the engagement. Do not guess field names; they differ per route on the same platform and
guessing them burns the most time.

### Phase 3: The display path

The deposit address is the fund-safety boundary on any manual-deposit product.
Establish how the address reaches the screen and what protects that path.

```bash
curl -sI https://TARGET/order-page | grep -iE 'content-security|x-frame|x-content-type|referrer'
grep -c 'integrity=' page.html
grep -oE '(src|href)="https?://[^"]+"' page.html | sort -u
grep -oE '.{160}(depositAddress|deposit_address).{80}' bundle.js
```

Report absence of CSP, absence of subresource integrity, unpinned third-party scripts on
the order page, and a direct passthrough from API response to DOM.
Then state the preconditions in full rather than calling it exploitable.

### Phase 4: Fund-path probing

Work down the list. For each, either close it with evidence or escalate it.

- **Order identity.** Read by identifier alone; read with a wrong second value; check
  whether a sibling route exposes the same object. Compute identifier entropy.
- **CORS.** Arbitrary `Origin` on the read routes, and an `OPTIONS` preflight.
  `Access-Control-Allow-Origin` is the only header that counts.
- **Claim key.** Does create have idempotency. Vary one distinguishing field while holding
  everything else fixed. Reformat the amount (`7.1` versus `7.10`).
- **Chain validation.** A valid address for the wrong chain.
- **Type confusion.** Omitted, empty, null, array, object, number, and long string, per field.
- **Signature verification.** Establish the token's segment count, then flip, strip,
  transplant, and mutate payload with a stale signature.
- **SSRF by timing.** An absolute URL as a path or parameter, against a documentation-range
  canary, compared against a baseline.
- **Traversal and route confusion.** Encoded and unencoded, and compare error shapes.
- **Numeric handling.** `0`, `-1`, `1e309`, `NaN`, `Infinity`, 21-digit integers.
- **Rate limiting.** Fast-failing payloads, report the index of the first 429 and whether
  `Retry-After` is present.

Full payloads and traps for each: `/home/m0xu/1-projects/security/red/wiki/06-probing-methodology.md`

### Phase 5: Evaluate the economics

Before writing anything up, answer:

- What does the platform custody or control. Usually nothing.
- What is the total value in play, and who owns it.
- Is there a security contact or a bounty programme.
- Which finding can an attacker turn into value for themselves.

A finding that cannot be turned into value is a hardening note and must be labelled as one.
Inflating it destroys the report's credibility.

### Phase 6: Write it up

Required artefacts, in the target directory:

- **Findings file.** One section per finding, each with its own evidence, plus a
  **closed-lead table** in the form `| Lead | Method | Result |`. A closed lead is a result.
- **Raw artefacts.** Saved responses, quote samples, order records.
- **The probes.** One small program or script per probe cluster, runnable, so any claim can
  be repeated.
- **A disclosure note.** What was left on the target, and what was deliberately not done.

Record any revision of your own earlier claims explicitly.
Two downward revisions are worth more than two inflated findings, and the reader needs to
know the difference.

## Severity discipline

For a denial bug, three numbers are required before a severity exists: durability, cost to
the attacker, and whether rate limiting bounds it.
Without all three it is a hypothesis, not a finding.

For a read-only bug, three questions: is the identifier guessable, is it the only
credential, and can a browser reach it cross-origin.
Answer them in that order and let the answers set the severity.

## Common failure modes

| Failure | Cost |
|---|---|
| Reporting before measuring surrounding conditions | Two findings had to be revised downward on the DarkSwap engagement |
| Assuming a token has three segments | Fifteen probes proved nothing and looked like findings |
| Paced probing when testing a burst limiter | Wrongly concluded there was no rate limit |
| Guessing field names instead of reading the bundle | Consumed most of the first session |
| Chasing the provider's API | Out of scope, and it is not your target |
| Calling a missing CSP a vulnerability | Report dismissed |

## Reference

Operational payloads: `/home/m0xu/1-projects/security/red/wiki/06-probing-methodology.md`

Domain knowledge, in reading order:

- `/home/m0xu/1-projects/security/red/wiki/01-bridge-mechanics.md`
- `/home/m0xu/1-projects/security/red/wiki/02-attack-surface-layers.md`
- `/home/m0xu/1-projects/security/red/wiki/03-the-display-path.md`
- `/home/m0xu/1-projects/security/red/wiki/04-order-identity-and-capabilities.md`
- `/home/m0xu/1-projects/security/red/wiki/05-the-claim-key-collision.md`
- `/home/m0xu/1-projects/security/red/wiki/07-darkswap-case-study.md`
