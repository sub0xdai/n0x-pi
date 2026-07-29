# Architecture Summary — LoveByCartiana

## What the app is

SvelteKit single-product e-commerce store ("Love By Cartiana") selling handcrafted
slime. Guest checkout only, no user accounts. Payments via Stripe Checkout
Sessions. Manual fulfillment by a single operator. Stack: SvelteKit + Bun,
better-sqlite3, Resend (email), Stripe, Sentry.

## Trust boundaries

- **Public (untrusted):** `/`, `/shop`, `/subscribe`, `/checkout`, all
  `/api/*` endpoints except webhook.
- **Stripe-signed:** `/api/webhooks/stripe` (verified via Stripe signature).
- **Admin-gated:** `/admin`, `/admin/dashboard` — gated by a single shared
  passcode stored in `ADMIN_PASSCODE` env var, set as a cookie on login.

## Input surfaces

| Surface | Handler | Auth |
|---------|---------|------|
| `POST /api/create-checkout-session` | Zod `{variantId, quantity}` → Stripe session | None (DROP_ACTIVE env gate) |
| `POST /api/waitlist` | Zod `{email}`, IP rate limit (3/hr) | None |
| `POST /api/webhooks/stripe` | Stripe signature verify → `processOrder` | Stripe sig |
| `POST /admin` (login) | form passcode compare | None |
| `POST /admin/dashboard?/*` actions | cookie `admin_session === ADMIN_PASSCODE` | Admin cookie |

## Data stores

- **SQLite** (`data/store.db`): `products`, `variants` (stock_count), `orders`
  (stripe_session_id UNIQUE), `settings` (key=`drop_active`).
- **JSONL** (`data/waitlist.jsonl`, `orders.log.jsonl` at cwd root — path
  inconsistency noted).

## Security-relevant design claims

- Server is price authority (catalog lookup, not client price).
- Atomic stock decrement in `processOrder` via
  `UPDATE ... WHERE stock_count >= ?` inside a transaction (prevents oversell
  at the webhook; idempotent on `stripe_session_id`).
- Admin "pause store" toggle writes `settings.drop_active`.
- DROP_ACTIVE env var is the documented kill switch.

## Notable divergence (flagged for Phase 2)

The kill switch has **two sources of truth**: the checkout endpoint reads the
`DROP_ACTIVE` env var (`isDropActive()` in `src/lib/config/store.ts`), while
the admin dashboard toggles `settings.drop_active` in SQLite. The admin toggle
is **never read by the checkout path**. This is a candidate HIGH business-logic
finding — see FINDING-1 in the report.

## Prior runs

None. Coverage improves with additional runs; recommend re-running to catch
findings this run may have missed.
