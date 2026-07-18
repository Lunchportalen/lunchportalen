# PHASE 17MENU — Enterprise Upgrade Contract

**Status:** FROZEN FROM ADR-019 (no invention)  
**Date:** 2026-07-18  
**Authority:** `docs/engineering/ADR-019-global-menu-profile-provider-commercial-model.md` §2.2–2.3, `lib/menu-profile/registry.ts`

## Decision (locked)

Enterprise is **not** a silent copy of Luxus without documentation — ADR-019 already defines it:

1. Enterprise includes the **same food categories** as Luxus for the active menu profile (NO: sandwich/salad/warm + sushi/poke/thai).
2. Enterprise adds **upgrade metadata / add-ons on the same warm dish** for that provider and operating day.
3. Enterprise must **never** receive a separate base warm dish for the same provider and date.
4. `enterprise_upgrade` is **not an employee-orderable category** (`canOrder=false`).

## Package contents (global package model)

| Package | Orderable categories | Upgrade |
|---------|----------------------|---------|
| BASIS | `sandwich`, `salad_box`, `warm_meal` | none |
| LUXUS | BASIS + `sushi`, `poke_bowl`, `thai` | none |
| ENTERPRISE | Same orderable set as LUXUS | `enterprise_upgrade` metadata on shared `warm_meal` |

## Runtime rules

- Shared warm dish content identical across BASIS / LUXUS / ENTERPRISE for `(provider_id, date)`.
- Enterprise upgrade fields (type/note) are provider-owned publish metadata; employees order `warm_meal` (and other entitled categories), not `enterprise_upgrade`.
- Entitlement key: `enterprise_upgrade` (boolean / jsonb default) on `provider_package_entitlements` for `ENTERPRISE` only.
- Locale switch must not alter Enterprise rights.

## Owner action

No owner decision packet required to invent Enterprise contents — ADR-019 is authoritative.  
Owner action required only if product wants to **change** this contract (e.g. remove sushi from Enterprise or make upgrade orderable).

## Seed gap (to close in W1)

Melhus seed currently sets ENTERPRISE entitlements identical to LUXUS food categories and **omits** `enterprise_upgrade`. Phase 17MENU migration adds the upgrade entitlement row without changing warm-dish uniqueness.
