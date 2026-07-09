# Localized Generator Visibility-Materialization Proof Evidence

**Status:** Evidence archived · docs-only · **visibility-materialization proof PASS**
**Date:** 2026-07-09
**Main HEAD (archive):** `0ca92416` — docs(menu): archive final SOT readiness audit (#470)
**Environment:** Production — Sanity project `4udoq5d8` dataset `production` · Supabase production
**Design authority:** [`docs/engineering/localized-generator-sot-cutover-design.md`](../engineering/localized-generator-sot-cutover-design.md) · closes the residual gap from [`final-sot-readiness-audit.md`](./final-sot-readiness-audit.md)

This document records the scoped proof that a **generated localized menuDay** flows through the full publish chain: `customerVisible=true` → Sanity webhook → `menu_service_days`/`menu_service_day_items` materialization. This closes the Gate E residual visibility risk.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Purpose | Close Gate E residual gap: visibility → materialization → employee-consumable rows, with a generated doc as source |
| Mutations performed | (a) One transactional Supabase insert of synthetic test-tenant scaffolding (3 rows + 1 trigger-generated row) · (b) One Sanity patch: `customerVisible: false → true` on one exact doc |
| Manual `menu_service_days` write | **NONE** — materialization performed exclusively by the existing production webhook |
| Broad publish | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Generator apply / onboarding apply / Phase D apply | **NOT RUN** |
| Orders / users / auth / e-mail | **NONE created or sent** |
| Billing/Stripe | **NOT TOUCHED** (synthetic company deterministically excluded — see §3) |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| Production flags | **UNCHANGED** |

## 2. Why the prior attempt stopped

The first visibility-proof GO stopped fail-closed in preflight: materialization requires the tenant chain `ACTIVE agreement → agreement_delivery_days (weekday+tier) → company → company_location`, and Danish Lunch Pilot had none (0/0/0/0). No mutation was performed in that session. This GO explicitly authorized the minimal scaffolding.

## 3. Test-tenant scaffolding (Supabase, one transaction)

| Row | Value |
|-----|-------|
| Company | `SOT Visibility Proof Test Company — Danish Lunch Pilot` · id `d516bf12-2650-44e4-b4e1-25bc54a69ec9` · status ACTIVE · provider Danish · contact `sot-visibility-proof-danish@example.invalid` · timezone `Europe/Copenhagen` · billing_country DK |
| Billing exclusion | Company inserted with **`paused_at` set** and explanatory `paused_reason` — `lp_compute_agreements_due_today` skips paused companies, so the synthetic ACTIVE agreement can never become billable; materialization is unaffected (sync filters on `provider_id` only) |
| Location | `SOT Visibility Proof Test Location — Danish Lunch Pilot` · id `48668121-f189-404c-9a13-558b186c23b0` · status ACTIVE |
| Agreement | id `cb61777f-05a0-4a54-b768-3c21f135ef07` · BASIS · **ACTIVE** · `delivery_days=["mon"]` · currency DKK · provider Danish |
| Delivery day | Exactly one row `mon/BASIS` — created by the platform's own `trg_agreements_sync_delivery_days` trigger from the jsonb (not inserted manually) |

Known, documented platform side effects of inserting an ACTIVE agreement (unavoidable, benign):

- `trg_agreement_lifecycle_hook` enqueued one outbox event (`tripletex.company_customer_create_provider:…`, status PENDING) + one lifecycle audit row. Danish pilot has no Tripletex connection, so the event cannot create anything externally.
- `provider_invoices` count remained **0** before and after.

Not touched: orders, users/auth, billing/payment tables, provider settings, Melhus, all other providers, flags, RLS, `menu_service_days` (no manual write).

## 4. Target

| Field | Value |
|-------|-------|
| Provider | Danish Lunch Pilot · `799ba3a2-a127-48a0-87b7-87944a2f42a3` · `da-DK` / `danish_office_lunch` |
| Doc | `menuDay-799ba3a2-a127-48a0-87b7-87944a2f42a3-2031-11-03-BASIS-varmrett` (generated, «Kylling i karry», far-future Monday) |
| Pre-state | `approvedForPublish=true` (Gate B artifact) · `customerVisible=false` · `_rev 1zexheHxKDYI99qGZrA2vw` verified with optimistic lock |
| Field changed | `customerVisible: false → true` **only** · new `_rev A9KxU337ELsycETkokQcEf` · exactly once, no retry, no errors |

## 5. Pre-mutation snapshot

- Danish: 0 msd rows · msd total 86 · orders 17 global / 0 Danish / 17 Melhus · Melhus 226 menuDays · templates 7 · anonymous `/api/week` + `/api/order/window` 401 safe · flags untouched.

## 6. Expected webhook behavior (verified in code pre-mutation)

`app/api/webhooks/sanity/menu-day/route.ts` → `menuDayIsPublishVisible` (both flags true) → `syncMenuServiceDaysForPublishedMenuDay` resolves provider-scoped ACTIVE agreements with `mon/BASIS`, their companies and locations → upserts one `menu_service_days` row per location (exactly one location exists) → `syncMenuServiceDayItemsAfterMenuDayPublish` snapshots tier products.

## 7. Post-mutation read-back (production, read-only)

| Check | Result |
|-------|--------|
| `menu_service_days` Danish | **Exactly 1 row** — location `48668121-…` · `service_date 2031-11-03` · `state published` · provider Danish |
| msd total | 86 → **87** (delta exactly +1) |
| Extra msd rows | **0** |
| `menu_service_day_items` | 3 rows for the day (BASIS product snapshots: Paasmurt/Salatboks/Varmrett, standard tier products) — created by the same webhook run, no manual write |
| Target doc | `approvedForPublish=true` · `customerVisible=true` |
| Other 14 Danish docs | Unchanged (0 approved/visible) |
| Melhus | 226 menuDays — unchanged · menuDay total 331 |
| Global templates | 7 · sample `_rev` unchanged |
| Orders | 17 — unchanged |
| Flags | Unchanged · SOT not started · auto-rollout not started |

## 8. Employee/API safety

- Anonymous `/api/week` and `/api/order/window`: **401 safe** before and after.
- No employee users exist for the synthetic company — no real user can see the row; exposure surface is the far-future test tenant only.
- No economy/metadata leakage introduced on anonymous surfaces; no Phase D leakage; no provider leakage.
- Order write-path and `lp_order_set` untouched.

## 9. Key learning for SOT design

The materialized `menu_service_day_items` snapshots come from the provider's **tier product catalog** (names/prices, e.g. `Paasmurt` at default NOK-denominated pricing) — not from the generated localized menuDay content. Localized employee-facing menu text flows from Sanity menuDay; commercial line snapshots flow from products. SOT cutover planning must account for per-market product naming/pricing (provider price rules / markets) as a separate work item. Documented as input to Gate F planning — not a blocker for this proof.

## 10. Known risks / residual

1. Proof artifacts remain in production by design: 1 visible generated menuDay (far-future), 1 msd row, 3 msdi rows, 1 paused synthetic company + location + ACTIVE agreement, 1 PENDING outbox event. Revert boundary below.
2. Synthetic tenant is billing-excluded via `paused_at`; if it is ever un-paused, the agreement becomes billable — do not un-pause.
3. Localized msdi naming/pricing gap noted in §9 (planning input, not a defect).

## 11. Revert boundary (if needed later — separate GO)

1. Sanity: set `customerVisible=false` on the exact doc (webhook then deletes the msd row via the unpublish path — proven code path).
2. Supabase: delete agreement `cb61777f…` (trigger clears delivery days), location `48668121…`, company `d516bf12…`; mark/delete the single outbox event.
3. Optionally revert `approvedForPublish` (Gate B artifact) on the same doc.

No revert executed in this GO.

## 12. Next action

| Item | Action |
|------|--------|
| This document | Archive evidence (docs-only PR) |
| Gate E residual | **Closed** — visibility→materialization proven with generated doc |
| Next step | Final readiness re-check / SOT cutover planning — **separate GO** |
| SOT | **Do not start** |
| Auto-rollout | **Do not start** |

**Exact next GO prompt (separate GO only):**

```text
GO SOT cutover planning PR — implementation plan only, no SOT start, no production mutation
```
