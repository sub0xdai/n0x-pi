# Security Audit Report — LoveByCartiana

**Target:** `/home/m0xu/1-projects/LoveByCartiana` (SvelteKit slime store)
**Run:** 1 (no prior runs)
**Date:** 2026-06-25
**Commit audited:** `d7a8a6d` (feat: dynamic catalog ingestion, admin CRUD, Polaris dashboard)

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 1 |
| MEDIUM   | 4 |
| LOW      | 1 |

The application is small and well-built in places that matter: parameterized
SQL everywhere (no injection), Stripe signature verification on the webhook,
atomic stock decrement inside a transaction with idempotency on
`stripe_session_id`, Zod validation at API boundaries, and SvelteKit's default
CSRF origin check active. The findings below are logic/config flaws, not
classic injection.

## Findings

### F-1 (HIGH) — DROP_ACTIVE kill switch bypass: admin "pause store" does not stop checkout

The admin dashboard `toggleStoreStatus` action updates the `drop_active` row in
the `settings` SQLite table and reports `drop_active: false` to the UI. But
`POST /api/create-checkout-session` gates on `isDropActive()`
(`src/lib/config/store.ts`), which reads the **`DROP_ACTIVE` environment
variable**, not the database setting. The two values are never reconciled.

**Attack:** An operator clicks "pause store" in the admin dashboard (e.g. when
stock is exhausted or during an incident). The dashboard confirms the store is
paused. Customers can still `POST /api/create-checkout-session` and pay — the
env var was never changed, only the DB row was. The operator's only recourse is
to redeploy with `DROP_ACTIVE=false`.

**Impact:** The explicit security boundary ("kill switch to pause the entire
store") is defeated. Orders and payments continue during a state the operator
believes is closed: fulfillment chaos, oversell risk, incident-response failure.
Per the rubric, defeating an explicit security boundary with real consequences
is HIGH.

**Fix:** Have `isDropActive()` read the `settings.drop_active` DB row (single
source of truth), or have the admin toggle rewrite the env-backed value. Until
then, the env var and the DB setting must be kept in sync manually and the
dashboard toggle is misleading.

### F-2 (MEDIUM) — Admin session cookie is the raw passcode (credential exposure)

`src/routes/(admin)/admin/+page.server.ts`:
```ts
cookies.set(COOKIE_NAME, ADMIN_PASSCODE, { ... httpOnly: true, sameSite: 'strict' ... });
```
The session token stored in the cookie **is** the admin passcode itself, not a
derived/random session id. `httpOnly` + `sameSite=strict` block JS reads, but
any non-JS exfiltration path (reverse-proxy access logs, request mirroring,
server-side cookie logging, backups) directly leaks the long-lived admin
credential. A session token should be a random, revocable value that is not
itself the password.

Combined with F-3 (weak default `admin123`, no rate limiting), any single
cookie leak = full admin takeover that persists until the env var is rotated.

**Fix:** Store a random session id in the cookie and validate it against a
server-side session record (or a HMAC of a secret + nonce). Never store the raw
credential as the session token.

### F-3 (MEDIUM) — No rate limiting / lockout on admin login + weak default passcode

The `/admin` login action compares the submitted passcode to `ADMIN_PASSCODE`
with `input !== ADMIN_PASSCODE` (non-constant-time) and has no rate limiting,
no failed-attempt lockout, and no captcha. The committed `.env` ships
`ADMIN_PASSCODE=admin123` (8 lowercase-alphanumeric chars), which is well within
brute-force range over an unthrottled endpoint.

**Attack:** `POST /admin` with candidate passcodes; ~2.8e14 combinations but
`admin123` is a dictionary word fragment that falls in the first few million of
any reasonable wordlist. Unthrottled network brute force succeeds in minutes on
a cable connection.

**Impact:** Full admin takeover — inventory CRUD, order deletion, store toggle,
and disclosure of every customer's email and order history
(`recentOrders` / `orders` table).

**Fix:** Constant-time compare, per-IP rate limit on `/admin` login (reuse the
waitlist rate-limiter pattern), lockout after N failures, and require a strong
generated passcode (or move to OAuth/single-use magic links).

### F-4 (MEDIUM) — X-Forwarded-For spoofing defeats waitlist rate limit + memory amplification

`src/routes/api/waitlist/+server.ts` `extractIp()` unconditionally trusts the
first entry of the `x-forwarded-for` header. An attacker rotates XFF values per
request, bypassing the 3/hour rate limit entirely.

**Attack chain:**
1. Send `POST /api/waitlist` with a unique `x-forwarded-for` and a unique
   `email` each request.
2. `isDuplicate(email)` reads the **entire** `waitlist.jsonl` into memory and
   parses every line on every request (O(n) per request).
3. `addToWaitlist` then reads the **entire file again** for its pair-assert
   (`content.includes(email)`).
4. Unbounded file growth + two full reads per write = trivial memory/disk DoS
   and waitlist pollution.

**Impact:** Rate limit defeated; waitlist file poisoned with arbitrary emails
(useless for launches); O(n) per request lets a single client exhaust server
memory by inflating `waitlist.jsonl`.

**Fix:** Trust XFF only from a known proxy hop (configure SvelteKit's
`event.getClientAddress()` / deploy behind a trusted proxy and read
`x-real-ip` only from the last hop). Cap the file size or move to SQLite.
Drop the post-write pair-assert readback on the hot path (the append return
already confirms durability).

### F-5 (MEDIUM) — Payment captured but order rejected: no automatic refund on stock race

`create-checkout-session` pre-checks stock, then creates a Stripe Checkout
Session (`mode: 'payment'`, captures funds on completion). Between session
creation and the `checkout.session.completed` webhook, another concurrent order
can deplete stock. The webhook's `processOrder` then returns
`OUT_OF_STOCK` and the handler returns HTTP 200 with `rejected` — but the
customer's payment is already captured. No refund logic exists anywhere in the
codebase.

**Attack (race):** Two customers check out the last unit near-simultaneously.
Both pay. One order is rejected post-payment with no refund. Operator must
manually issue a Stripe refund or face a chargeback.

**Impact:** Direct financial loss to the customer until manual refund;
chargeback/dispute risk; the operator gets no alert that a refund is owed
(the rejection is only `console.warn`-ed).

**Fix:** After `orderResult.reason === 'OUT_OF_STOCK'`, issue
`stripe.refunds.create({ payment_intent: session.payment_intent })` and email
the operator. Consider holding the unit with a short-lived reservation at
session-creation time instead of a read-then-checkout.

### F-6 (LOW) — Order audit log not gitignored; path inconsistency

`src/lib/server/logger.ts` writes to `orders.log.jsonl` at the **cwd root**
(README says `data/orders.jsonl`). `.gitignore` lists neither
`orders.log.jsonl`, `data/waitlist.jsonl`, nor `data/orders.jsonl`. A developer
who runs the store locally and `git add .` commits customer PII (emails,
shipping addresses, recipient names) into history.

**Impact:** PII disclosure via git history if committed and pushed.

**Fix:** Write to `data/orders.jsonl` (match README) and add `data/*.jsonl` and
`orders.log.jsonl` to `.gitignore`.

## What the codebase does well

- **Parameterized SQL everywhere** — no string interpolation in any query,
  `db.prepare(...).run(...)` with placeholders throughout. No SQL injection
  surface found.
- **Stripe webhook signature verification** before any side effect.
- **Atomic stock decrement** inside a SQLite transaction with
  `WHERE stock_count >= ?` and idempotency on `stripe_session_id` UNIQUE —
  oversell is genuinely prevented at the commit boundary.
- **Server is price authority** — `unit_amount` resolved from server catalog,
  never from client input.
- **Zod validation** at every JSON API boundary.
- **SvelteKit default CSRF protection** (`checkOrigin: true` by default) covers
  the admin form actions.
- **`.env` is gitignored** and `.env.example` carries only placeholders.

## Recommendation

Fix F-1 first — it is the only HIGH and it silently defeats the store's
primary safety control. F-2/F-3 together expose the admin boundary to
brute-force + credential-leak takeover. F-4 is the easiest to exploit
remotely (unauthenticated, single request). Re-run this audit after fixes;
a single run finds roughly half of exploitable issues.
