# Findings — Detailed Data Flows

## F-1 (HIGH) — DROP_ACTIVE kill switch bypass

### Code path

1. Admin clicks "pause store" → `POST /admin/dashboard?/toggleStoreStatus`
   (`src/routes/(admin)/admin/dashboard/+page.server.ts`):
   ```ts
   const next = row.value === 'true' ? 'false' : 'true';
   db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(next, 'drop_active');
   ```
   Only the SQLite `settings` table is mutated. UI reports `drop_active: false`.

2. Customer checks out → `POST /api/create-checkout-session`
   (`src/routes/api/create-checkout-session/+server.ts`):
   ```ts
   if (!isDropActive()) { return json({ error: 'STORE_PAUSED' }, { status: 403 }); }
   ```

3. `isDropActive()` (`src/lib/config/store.ts`):
   ```ts
   import { DROP_ACTIVE } from '$env/static/private';
   export function isDropActive(): boolean {
     const result = DROP_ACTIVE === 'true';
     return result;
   }
   ```
   Reads the **env var**, not the DB row the admin just toggled.

### Proof

With `DROP_ACTIVE=true` in `.env` (current committed state) and the admin
dashboard showing `drop_active: false`:

```
POST /api/create-checkout-session
Content-Type: application/json
{"variantId":"unicorn-pink","quantity":1}
→ 200 {"url":"https://checkout.stripe.com/..."}   ← store is "paused" but checkout proceeds
```

The dashboard `load()` reads `settings.drop_active` to render the pill, so the
operator sees "paused" while checkout accepts orders.

### Root cause

Two independent sources of truth (`DROP_ACTIVE` env var vs
`settings.drop_active` SQLite row) with no reconciliation.

---

## F-2 (MEDIUM) — Admin session cookie == raw passcode

### Code path

`src/routes/(admin)/admin/+page.server.ts` login action:
```ts
cookies.set(COOKIE_NAME, ADMIN_PASSCODE, {
  path: '/admin',
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 60 * 60 * 24,
});
```
Validation (`isAuthenticated`) elsewhere compares
`cookies.get(COOKIE_NAME) === ADMIN_PASSCODE`. The stored session token is
literally the credential.

### Impact

Any cookie leak = passcode leak. `httpOnly` blocks `document.cookie` from JS,
but does not block: reverse-proxy access logs, request mirroring, server-side
logging that dumps headers, LB backups, or SSRF that reflects headers. The
session token should be a random, revocable id, never the raw credential.

---

## F-3 (MEDIUM) — Admin login brute force

### Code path

`src/routes/(admin)/admin/+page.server.ts`:
```ts
if (!ADMIN_PASSCODE || typeof input !== 'string' || input !== ADMIN_PASSCODE) {
  return { error: 'Invalid passcode' };
}
```
No rate limit, no lockout, non-constant-time `!==` compare. `.env` ships
`ADMIN_PASSCODE=admin123`.

### Proof

Unthrottled `POST /admin` with `FormData({ passcode: <guess> })`. A short
wordlist hits `admin123` in seconds. Success yields a cookie equal to the
passcode (F-2) and full CRUD over inventory, orders, and the store toggle.

---

## F-4 (MEDIUM) — XFF spoof + O(n) waitlist amplification

### Code path

`src/routes/api/waitlist/+server.ts`:
```ts
function extractIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return '127.0.0.1';
}
```
Header is attacker-controlled when no trusted proxy strips/overwrites it.

`src/lib/server/waitlist.ts`:
- `isDuplicate(email)` — `readFileSync(WAITLIST_PATH)` then `lines.some(...)`
  over every line. O(n) per request.
- `addToWaitlist(email)` — `appendFileSync` then `readFileSync` again for the
  pair-assert. Two full reads + one write per request.

### Proof

```
POST /api/waitlist
X-Forwarded-For: 10.0.0.<random>
Content-Type: application/json
{"email":"a<random>@b.test"}
→ 200 {"ok":true}   (rate limit never trips, file grows by one line each time)
```
Repeat with unique XFF + email. Each request reads the whole file twice. A few
thousand requests inflate the file to hundreds of MB and each subsequent
request reads it all into memory.

---

## F-5 (MEDIUM) — Captured payment, rejected order, no refund

### Code path

1. `create-checkout-session`: stock pre-check (`stock.stockCount < quantity`
   → 409), then `stripe.checkout.sessions.create({ mode: 'payment' })`. Funds
   captured on session completion.
2. Webhook `checkout.session.completed` → `processOrder` atomic decrement.
   If stock depleted in the window:
   ```ts
   if (variant.stock_count < quantity) return { success: false, reason: 'OUT_OF_STOCK' };
   ```
   Handler returns `json({ received: true, rejected: orderResult.reason })`
   with HTTP 200. No `stripe.refunds.create` anywhere in the repo.

### Proof

- Unit A: `POST /api/create-checkout-session {variantId, quantity:1}` when
  stock=1. Session created.
- Unit B: same, near-simultaneously. Session created (stock still 1 at pre-check).
- A pays → webhook decrements stock 1→0, order committed.
- B pays → webhook `OUT_OF_STOCK`, returns 200, B's payment is captured, no
  refund issued, only a `console.warn`.

---

## F-6 (LOW) — Untracked PII log files

### Code path

`src/lib/server/logger.ts`:
```ts
const LOG_PATH = join(process.cwd(), 'orders.log.jsonl');  // cwd root, not data/
```
`.gitignore` omits `orders.log.jsonl`, `data/waitlist.jsonl`,
`data/orders.jsonl`. `data/store.db*` are gitignored, but the JSONL logs are
not. README documents `data/orders.jsonl` — path mismatch confirms the bug.
