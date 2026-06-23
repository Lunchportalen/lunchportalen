# R4 — Provider price cutover runbook (R4G gate)

**Status:** Planning document — **no runtime cutover in R4F**.  
**Relates to:** [r4-provider-price-plan.md](./r4-provider-price-plan.md) · [architecture-decisions.md](./architecture-decisions.md) ADR-018 · [commercial-inventory.md](./commercial-inventory.md)

This runbook defines **preconditions and staging steps** before any market-aware production resolver cutover (planned **R4G**). It does **not** authorize cutover by itself.

---

## 1. Preconditions (R4G cannot start until)

| Gate | Requirement |
|------|-------------|
| **R4F tests green** | Parity/edge-case tests in `providerMenuPricePreview.test.ts`, production legacy contract in `providerMenuPackageSurface.test.ts`, `menuDayPayload` dual-truth contract |
| **Staging preview on** | `LP_PROVIDER_PRICE_PREVIEW_DISPLAY=true` in staging only |
| **Drift understood** | `pricePreview.differsFromProduction` observed per provider/tier; root causes documented (market filter, override rows, publish fallback, etc.) |
| **Employee contract** | `tests/api/week-profile-lookup.test.ts` — no `prices`, `pricePreview`, or commercial keys in `/api/week` |
| **Publish dual-truth** | Explicitly **accepted for cutover window** OR **R4G-publish** planned to align `menuDayPayload` with display resolver |
| **Golden Path smoke** | `npm run test:golden-path` green on release candidate |
| **Commercial guard** | `ci:commercial-hardcodes-guard` PASS without broad allowlist expansion |
| **ADR-018 sign-off** | Cutover ADR acknowledged by owner |

---

## 2. Feature flags (do not conflate)

| Flag | Phase | Purpose | Default |
|------|-------|---------|---------|
| `LP_PROVIDER_PRICE_PREVIEW_DISPLAY` | R4E (done) | Diagnostics only — optional `pricePreview` + UI strip | `false` |
| `LP_PROVIDER_PRICE_MARKET_RESOLVER` | **R4G (planned)** | Runtime cutover — `prices` from market-aware resolver v2 | `false` |

**Rules:**

- Preview flag **must never** change `prices` or POST/publish behavior.
- Cutover flag **must not** reuse preview flag name or semantics.
- Both flags default `false` in production until explicit GO.

---

## 3. R4G cutover candidate (planned — not implemented in R4F)

| Item | Description |
|------|-------------|
| Resolver | `loadProviderMenuPricesV2()` or market-aware refactor of `loadProviderMenuPrices()` |
| Scope | `market_code='NO'` tier defaults only; same output shape as today (`ProviderMenuPriceView`) |
| Wiring | Behind `LP_PROVIDER_PRICE_MARKET_RESOLVER`; staging first |
| Out of scope for R4G | Billing, Tripletex, `menuDayPayload`, MSDI, `lp_order_set`, employee APIs |

---

## 4. Staging observation checklist

1. Enable `LP_PROVIDER_PRICE_PREVIEW_DISPLAY=true` in staging.
2. Open `/leverandor/meny` for pilot providers (Melhus + any with custom `provider_price_rules`).
3. For each tier tab, record:
   - `prices` (production) amount
   - `pricePreview` amount
   - `differsFromProduction` badge
   - `aggregateSource` / `rowSource` metadata
4. Attempt publish flows — note client validation uses `prices`, server `menuDayPayload` uses `fallbackProviderMenuPrices()` (dual truth).
5. Confirm `/api/week` response has no commercial keys (manual or contract test).
6. Run `npm run test:golden-path` on staging build.

**Cutover GO criteria (staging):**

- `differsFromProduction === false` for all tiers for pilot providers **OR** each drift has documented acceptance
- No employee price leak
- Golden Path smoke green
- Product owner explicit GO for `LP_PROVIDER_PRICE_MARKET_RESOLVER` in staging

---

## 5. Rollback

| Action | Effect |
|--------|--------|
| Set `LP_PROVIDER_PRICE_MARKET_RESOLVER=false` | Immediate revert to legacy `loadProviderMenuPrices()` |
| Set `LP_PROVIDER_PRICE_PREVIEW_DISPLAY=false` | Hide diagnostics strip only; does not affect `prices` |
| Redeploy previous release | Full revert if flag wiring misbehaves |

**Never** mutate historical orders, MSDI rows, or invoice lines on resolver rollback.

---

## 6. Later phases (not R4G)

| Phase | Scope |
|-------|-------|
| **R4G-publish** | Align `menuDayPayload` / server `validateEnterprisePublish` with display resolver |
| **R4G-billing** | Dry-run agreement vs tier resolver vs invoice lines |
| **R4H** | MSDI + `lp_order_set` alignment — **Golden Path**; protected-path audit required |

---

## 7. Do not touch without separate GO

- `app/api/week/**`, employee UI
- `lp_order_set`, order write-path
- `syncMenuServiceDayItems` / `TIER_PRICE_CENTS`
- Billing, Tripletex, invoice/PDF runtime
- Frozen onboarding (`/onboarding`)
- `supabase/migrations/**` (except dedicated R4 phase migrations with review)
