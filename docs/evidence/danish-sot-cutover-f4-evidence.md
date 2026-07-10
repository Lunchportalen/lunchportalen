# Danish Lunch Pilot — Phase F4 Scoped SOT Cutover Evidence

**Date:** 2026-07-10 (Europe/Oslo)  
**Status:** **PARTIAL GO · CONTAINED** — localized DKK **price** applied; **name/VAT** blocked by production DB trigger; SOT runtime **OFF** after containment

---

## Change-set

| Field | Value |
|---|---|
| Title | Phase F4 scoped SOT cutover — Danish Lunch Pilot |
| Scope | Provider `799ba3a2-a127-48a0-87b7-87944a2f42a3` · `2031-11-03` · `BASIS` · location `48668121-f189-404c-9a13-558b186c23b0` |
| Repro | With #476 MSDI mapping flags ON, re-materialize `menu_service_day_items` for Danish pilot |
| Expected | basis **10500** ex-VAT · VAT **0.25** · varmrett snapshot **«Kylling i karry»** |
| Actual | basis **10500** ex-VAT ✓ · VAT **0.15** ✗ · names **tier products** (Paasmurt/Salatboks/Varmrett) ✗ |
| Root cause | `tg_menu_service_day_item_snapshot` **overwrites** `product_name_snapshot`, `unit_name_snapshot`, and `vat_rate_snapshot` from global `products`; price kept only when sync supplies `offered_price_cents_ex_vat` (`coalesce(new, v_price)`) |
| Fix (this session) | Production flag stack ON + redeploy + operator MSDI re-sync via `PHASE_F_CUTOVER=1` vitest ops runner |
| Verification | Golden path 102/102 PASS · scoped msdi read-back · 0 Danish orders · 17 global orders unchanged |

---

## Target (locked)

| Key | Value |
|---|---|
| Provider | `799ba3a2-a127-48a0-87b7-87944a2f42a3` (Danish Lunch Pilot) |
| Date | `2031-11-03` |
| Tier | `BASIS` |
| Location | `48668121-f189-404c-9a13-558b186c23b0` |
| Company | `d516bf12-2650-44e4-b4e1-25bc54a69ec9` (SOT Visibility Proof — paused tenant) |
| Sanity doc | `menuDay-799ba3a2-a127-48a0-87b7-87944a2f42a3-2031-11-03-BASIS-varmrett` |
| Market | DK / DKK / `da-DK` |
| Sanity `mealTitle` | `Kylling i karry` |
| Publish visible | `approvedForPublish=true` · `customerVisible=true` |

---

## F3 preflight (before)

### `menu_service_days`

| Field | Value |
|---|---|
| Row id | `b342d7e1-b452-4dff-be94-fa7b9c8fadc1` |
| `service_date` | `2031-11-03` |
| `state` | `published` |
| `provider_id` | `799ba3a2-a127-48a0-87b7-87944a2f42a3` |
| `location_id` | `48668121-f189-404c-9a13-558b186c23b0` |
| Item count | 3 |

### `menu_service_day_items`

```json
[
  {"offered_price_cents_ex_vat": 9000, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Paasmurt", "sort_order": 1},
  {"offered_price_cents_ex_vat": 9000, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Salatboks", "sort_order": 2},
  {"offered_price_cents_ex_vat": 9000, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Varmrett", "sort_order": 7}
]
```

---

## F4 actions

### 1. Production Vercel env (names only — values encrypted)

| Variable | Production |
|---|---|
| `LP_LOCALIZED_GENERATOR_SOT_ENABLED` | `true` |
| `LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST` | Danish provider UUID only |
| `LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED` | `true` |

No auto-rollout flags touched. No dry-run flag set.

### 2. Production redeploy

- `vercel deploy --prod --yes` completed successfully
- Production alias: `https://lunchportalen.no` (deployment `lunchportalen-fmrjf4my7-lunchportalen.vercel.app`)

### 3. MSDI re-materialization

Operator path (production Supabase service role + in-process flag stack):

```bash
PHASE_F_CUTOVER=1 npx vitest run tests/ops/phase-f-danish-sot-msdi-rematerialize.ops.test.ts
```

Supporting scripts added (operator-only, not CI):

- `scripts/phase-f-danish-sot-msdi-rematerialize.mjs`
- `scripts/phase-f-danish-sot-trigger-production-webhook.mjs` (blocked locally: Vercel does not export `SANITY_WEBHOOK_SECRET` in `env pull`)
- `scripts/phase-f-danish-sot-sanity-retrigger.mjs`

---

## F5 read-back (after cutover)

### `menu_service_days`

| Field | Value |
|---|---|
| Row id | `b342d7e1-b452-4dff-be94-fa7b9c8fadc1` (unchanged) |
| `service_date` | `2031-11-03` |
| `state` | `published` |
| `updated_at` | `2026-07-09 21:05:41Z` (unchanged — no new msd row) |
| Item count | 3 |

### `menu_service_day_items`

```json
[
  {"offered_price_cents_ex_vat": 10500, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Paasmurt", "sort_order": 1},
  {"offered_price_cents_ex_vat": 10500, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Salatboks", "sort_order": 2},
  {"offered_price_cents_ex_vat": 10500, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Varmrett", "sort_order": 7}
]
```

**Interpretation**

| Signal | Result |
|---|---|
| DKK basis price (10500 = 105.00 DKK ex-VAT) | **PASS** — application mapping + sync wrote localized price; trigger preserved it |
| DK VAT 0.25 | **FAIL (known infra)** — trigger forces `products.vat_rate` (0.15) |
| Localized varmrett text | **FAIL (known infra)** — trigger forces `products.name` (`Varmrett`) |
| Sanity employee menu text | **PASS (unchanged)** — `mealTitle` remains `Kylling i karry` in Sanity |
| Order write-path | **PASS** — 0 orders on Danish proof company; 17 global orders unchanged |
| Golden path | **PASS** — 102/102 |

---

## Safety invariants (held)

- [x] One provider / one date / one tier only
- [x] No auto-rollout
- [x] No `lp_order_set` / order write-path / billing / Stripe changes
- [x] Kill-switch: set `LP_LOCALIZED_GENERATOR_SOT_ENABLED=false` or clear allowlist
- [x] Test tenant `d516bf12-…` remains paused (0 orders)

---

## Follow-up (out of F4 scope)

**Gate F4b — MSDI trigger alignment (Option B completion)**

Migrate `tg_menu_service_day_item_snapshot` to respect application-supplied localized snapshots when SOT MSDI mapping is active (or introduce explicit snapshot-source flag). Until then, commercial msdi identity/VAT remain global tier-product defaults while price can reflect localized rules.

**Protected Golden Path Impact:** trigger/RPC migration requires explicit protected-path audit if order snapshots consume msdi VAT/name.

---

## Rollback

1. Vercel: `LP_LOCALIZED_GENERATOR_SOT_ENABLED=false` (or remove provider from allowlist) → redeploy
2. Re-run menu-day sync to restore legacy 9000 pricing if required
3. Evidence preserved in this file for audit

---

## F4 containment (2026-07-10)

**Status:** **CONTAINED** — SOT runtime flag stack removed from production; partial msdi data **not** rolled back.

### Containment actions

| Action | Result |
|---|---|
| Removed `LP_LOCALIZED_GENERATOR_SOT_ENABLED` (production) | Done |
| Removed `LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST` (production) | Done |
| Removed `LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED` (production) | Done |
| `LP_LOCALIZED_GENERATOR_SOT_DRY_RUN` | Never set in production |
| `LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED` | Never set in production |
| Production redeploy | `lunchportalen-l2kd19oph-lunchportalen.vercel.app` |

### Post-containment verification (read-only)

| Check | Result |
|---|---|
| SOT flags in Vercel production | Absent |
| Auto-rollout | OFF (env absent; default fail-closed) |
| Danish Sanity doc | Unchanged — `mealTitle: Kylling i karry`, publish-visible |
| `menu_service_days` | 1 row · `b342d7e1-…` · unchanged since cutover |
| `menu_service_day_items` | 3 rows · **10500 / 0.15 / tier names** — partial state preserved |
| Orders | 17 global · 0 Danish — unchanged |
| Extra materialization | None |
| Billing / `lp_order_set` / order write-path | Not touched |

### Decision

- **Not ready** for broader SOT or auto-rollout
- **Not ready** for Danish cutover completion without Gate F4b (trigger alignment)
- **Next gate:** docs-only evidence PR, then F4b design/implementation PR with protected-path audit

