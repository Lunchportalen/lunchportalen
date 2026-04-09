# CP1 — Week / menu runtime chain (kilde: kode)

**Dato:** 2026-03-29  
**Status:** Kode uendret i CP1 for denne kjeden — **eksplisitt dokumentert** og reflektert i UI-tekst på kontrollflate.

## Operativ kjede (employee)

1. **Autentisering** → `profiles` (`company_id`, `location_id`).
2. **Avtale** → aktiv `company_current_agreement` (tier, `delivery_days`, …).
3. **Meny** → Sanity `menu` / `menuContent` per måltidstype (queries brukt fra server).
4. **API** → `GET /api/week` bygger uke via `buildEmployeeWeekMenuDays` + menydata.
5. **Regler** → `lib/week/availability.ts` og `order/window` for synlighet og bestilling.

**Konklusjon:** `weekPlan` (Sanity) er **ikke** denne kjeden — se `lib/cms/weekPlan.ts` @deprecated for runtime.

## Publisering «fra CMS»

- **Meny** publiseres i **Sanity** / redaksjonell flyt — dette er det **GET /api/week** konsumerer.
- **Redaksjonell weekPlan** → eget spor (`POST /api/weekplan/publish`, superadmin) — **ikke** blandet inn i employee-kjede uten produktendring.

## CP1-integrasjon

- **Statusstrip** merker innhold/meny-kjede som **LIVE** (kanonisk publiserings-/innholdslag).
- **Redaksjonell ukeplan** merket **LIMITED** (editorial / policy).

## Ingen dobbel sannhet introdusert i CP1

- CP1 legger **ingen** ny tabell eller API som dupliserer `GET /api/week`.
