# lp_order_set variant item_key — evidence (fix/lp-order-set-variant-itemkey)

**Prod:** `hkpokyapzarefrgqzkos` (read-only baseline). **Staging tests:** `uigxsboqeruxflgzqztl` only.

## Design lock (FASE 0.6)

**Primary:** Drop MSDI `item_key = SKU` constraint in RPC; kitchen resolves `day_choices.item_key` (CMS slug) → title via `buildVariantTitleLookup()` / `getLunchCategoryStaticItemsByPlanTier`. No new RPC params; FASE 2 API snapshot skipped.

## Constraint removed (both MSDI SELECT blocks)

Migration `20260611120000_lp_order_set_variant_itemkey.sql` — removed:

```sql
and (v_item_raw = 'default' or lower(trim(coalesce(pr.sku,''))) = v_item_raw)
```

MSDI resolves on `v_slug_msdi` (+ varmmat→varmrett alias) + `v_expect_cents` only. `day_choices.item_key` still stores variant slug when not `default`.

## Branches preserved (byte-identical intent)

CANCEL, outbox, CUTOFF_PASSED, tier pricing, `v_choice_raw`/`v_item_raw`, varmmat MSDI alias — unchanged from `20260610130000` base.

## API changes

None (primary path). Existing callers still send `p_item_key` from `resolveOrderDayItemPersist` / week `itemKey`.

## Kitchen changes

| File | Change |
|------|--------|
| `lib/kitchen/kitchenMealNote.ts` | New: lookup + `buildKitchenMealNote` (snapshot → slug → legacy note) |
| `lib/kitchen/dayData.ts` | SELECT `item_key`, `item_title_snapshot`; kitchen note via helper |
| `lib/server/kitchen/loadOperativeKitchenOrders.ts` | dcMap includes `item_key`, `item_title_snapshot` |
| `app/api/kitchen/route.ts` | `note` field uses `buildKitchenMealNote` |

## FASE 4 matrix (uigx, after migration apply)

| Case | Expected |
|------|----------|
| Påsmurt + `ost-skinke` (BASIS) | 200 · `item_key=ost-skinke` · product = paasmurt |
| Salat + variant slug | 200 · `item_key` stored |
| Varmmat/default | 200 · product = varmrett (alias) |
| `default` item_key | 200 · `item_key` null |
| LUXUS choice on BASIS day (e.g. sushi) | 409 tier (unchanged) |

Integration: `tests/integration/lp-order-set-variant-itemkey.integration.test.ts`  
Unit kitchen: `tests/lib/kitchen/kitchenMealNote.test.ts` → e.g. `Påsmurt (Ost & skinke)`

## Prove-fires

- **Pre-migration RPC:** `p_item_key` = variant slug → `MENU_SERVICE_DAY_ITEM_NOT_FOUND` (409).
- **Post-migration:** same call → 200 + slug in `day_choices.item_key`.
- **Fail-loud:** `tests/lib/orders/planOrderChoiceKeysMsdiResolve.test.ts` (MSDI slug guard).

## Grants (prod baseline)

`EXECUTE` on `lp_order_set` for `authenticated`, `service_role`, `postgres` — no signature change; re-grant not required.
