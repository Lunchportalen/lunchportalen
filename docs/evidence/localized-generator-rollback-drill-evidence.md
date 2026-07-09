# Localized Generator Rollback Drill Evidence

**Status:** Evidence archived · docs-only · **rollback drill PASS (Gate C)**
**Date:** 2026-07-09
**Main HEAD (archive):** `c7f1692b` — feat(smart-menu): include order-window sources in translation coverage report (#401)
**Environment:** Production Sanity — project `4udoq5d8` · dataset `production`
**Design authority:** [`docs/engineering/localized-generator-sot-cutover-design.md`](../engineering/localized-generator-sot-cutover-design.md) §8 (rollback strategy, Gate C)

This document records the **draft-only rollback drill** required by SOT Gate C. Exactly one scoped mutation was performed: deletion of 15 exact-ID generated draft menuDay documents for one Phase C pilot provider and one far-future week.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Gate | **C — rollback drill** (draft-only, scoped) |
| Mutation | Deletion of 15 exact draft menuDay IDs — nothing else |
| Publish | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Generator apply | **NOT RUN** |
| Onboarding apply | **NOT RUN** |
| Phase D apply | **NOT RUN** |
| Supabase mutation | **NONE** (read-only order counts only) |
| Billing/Stripe | **NOT TOUCHED** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| Production flags | **UNCHANGED** |

## 2. Target

| Field | Value |
|-------|-------|
| Provider | Italian Lunch Pilot |
| ProviderId | `50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa` |
| Slug | `italian-lunch-pilot` |
| Locale / profile | `it-IT` / `italian_office_lunch` |
| Week | `2031-12-15` → `2031-12-19` (5 weekdays, far-future) |
| Docs | 15 menuDay tier-docs (5 weekdays × BASIS/ENTERPRISE/LUXUS) |
| Source apply session | RID `prov_mapply_mrc3dvfy_m1irw3gje6m45wd3` (it-IT generator apply evidence, PR #455 chain) |

Exact deleted doc IDs (deterministic pattern `menuDay-{providerId}-{date}-{TIER}-varmrett`):

- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-15-BASIS-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-15-ENTERPRISE-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-15-LUXUS-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-16-BASIS-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-16-ENTERPRISE-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-16-LUXUS-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-17-BASIS-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-17-ENTERPRISE-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-17-LUXUS-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-18-BASIS-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-18-ENTERPRISE-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-18-LUXUS-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-19-BASIS-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-19-ENTERPRISE-varmrett`
- `menuDay-50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa-2031-12-19-LUXUS-varmrett`

## 3. Why this target was safe

1. Last-onboarded Phase C pilot; far-future week (no live orders: global 17, Italian 0).
2. All 15 docs verified pre-delete: `approvedForPublish=false` · `customerVisible=false` · `providerRef` match · dates within scoped week · `_createdAt` 2026-07-08 matching the evidenced apply session.
3. No Sanity `drafts.*` variants existed for the IDs.
4. Only one other doc references the provider (`lunchCategory-…-vegetarian` catalog doc) — explicitly **not selected**, left untouched.
5. Docs are deterministic-ID operational drafts recreatable by a future scoped generator apply.
6. Rollback boundary matches design doc §8.2 exactly.

## 4. Pre-rollback snapshot (read-only)

| Item | Value |
|------|-------|
| Target week menuDays | 15 (all flags safe) |
| Italian menuDays total | 15 |
| Italian visible/approved docs | 0 |
| Provider mirror `_rev` | `OalDYDQpYpgEHE2cZw0auK` |
| Italian catalog doc `_rev` | `p9L5AVJjTpTcQqdqTRNG4U` |
| Global templates | 7 docs, `_rev` set snapshotted per doc |
| Melhus menuDays | 226 |
| Swedish / Danish / Finnish / UK / German / French / Spanish | 15 each |
| menuDay total | 346 |
| Orders (global / Italian / Melhus / Swedish / Danish / Finnish) | 17 / 0 / 17 / 0 / 0 / 0 |
| Providers total | 9 |
| Production flags | Unchanged / untouched |

## 5. Rollback boundary

Deleted **only if all of**: exact ID in the 15-ID list · `_type == "menuDay"` · providerRef == Italian pilot · `approvedForPublish=false` · `customerVisible=false` · date within `2031-12-15..19`. Any violation → abort before mutation (validated in code; no violations).

**Not deleted:** provider mirror, provider catalog doc, global templates, any published/visible/approved doc, any other provider's docs, orders, Supabase rows, flags.

## 6. Mutation performed

| Field | Value |
|-------|-------|
| Method | Single Sanity transaction, delete by 15 exact IDs (no query-based delete) |
| Transaction ID | `1zexheHxKDYI99qGZqxPU4` |
| Executed | Exactly once — no retry |
| Errors | None |

## 7. Post-rollback read-back (independent re-query)

| Check | Result |
|-------|--------|
| Target IDs remaining | **0** (deleted 15 / expected 15 / extra 0) |
| Italian menuDays total | 15 → **0** |
| Provider mirror `_rev` | **Unchanged** (`OalDYDQpYpgEHE2cZw0auK`) |
| Italian catalog doc | **Present, `_rev` unchanged** (`p9L5AVJjTpTcQqdqTRNG4U`) |
| Global templates | **7 docs, all `_rev` byte-identical** |
| Melhus | **226 — unchanged** |
| Swedish/Danish/Finnish/UK/German/French/Spanish | **15 each — unchanged** |
| menuDay total | 346 → **331** (delta exactly −15) |
| Orders (global / Italian / Melhus) | **17 / 0 / 17 — unchanged** |
| Providers total | **9 — unchanged** |
| Anomalies | **None** |

## 8. Release safety

- SOT: **NOT STARTED** · Auto-rollout: **NOT STARTED** · Publish: **NOT RUN**
- Generator apply / onboarding apply / Phase D apply: **NOT RUN**
- Supabase: read-only counts only — **no mutation**
- Order write-path / `lp_order_set`: **untouched**
- Billing/Stripe: **untouched**
- Production flags: **unchanged**
- Secrets/tokens/env values: **not printed, not committed**

## 9. DryRun after rollback

Not run. Optional per drill GO; requires a provider-admin session against the apply route. The deterministic ID scheme plus the it-IT apply evidence already proves recreatability: a future scoped apply for the same provider/week would recreate the same 15 IDs (`create_missing_only_strict`).

## 10. Known risks

1. Italian Lunch Pilot week `2031-12-15` is now empty (0 menuDays) — intentional drill outcome; recreatable via separate scoped generator apply GO if needed.
2. Production inventory expectations referencing "120 generated Phase C menuDays" should read **105** until/unless the Italian week is re-applied.
3. No other risk introduced — protected surface verified unchanged.

## 11. Next action

| Item | Action |
|------|--------|
| This document | Archive evidence (docs-only PR) |
| Gate B — publish workflow proof | **Separate scoped GO required** |
| Gate E — final SOT readiness audit | After Gate B |
| SOT | **Do not start** |
| Auto-rollout | **Do not start** |

**Exact next GO prompt (separate scoped GO only):**

```text
GO scoped publish workflow proof for localized generator — one provider/week only, no SOT, no auto-rollout
```
