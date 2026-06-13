# Incident: MSD `provider_id` NOT NULL — 2026-05-29

**Status:** Lukket (teknisk)  
**Severity:** P1 — bestilling blokkert for nye `menu_service_days`-datoer  
**Prod-ref:** `hkpokyapzarefrgqzkos` (Supabase Ireland)  
**Fix-commit:** `ab01f3f89d132a0b4f77ee7e674304470a409ffa` (PR #61)  
**Trigger hotfix (MCP):** `20260528143000` manuelt applied 2026-05-29 ~13:15 Oslo

---

## Tidslinje (alle tider Oslo)

| Tid | Hendelse |
|-----|----------|
| ~07:30 | Thomas observerer 5× POST `/api/orders` → 500 i prod network-tab (Melhus Catering AS sesjon) |
| ~07:35 | Sentry breadcrumb identifiserer `menu_service_days.provider_id` NOT NULL violation |
| 08:00:04 | Cron-jobben `menu-service-day-reconcile` feiler (samme root cause, separat trigger) |
| ~12:00 | Diagnose via Supabase MCP fullført — H2+H4 bekreftet |
| 12:36 | PR #61 merged til main (`ab01f3f8`) |
| 12:37 | `supabase-migrate.yml` CI grønn (**FALSE GREEN** — bug i workflow) |
| ~13:00 | STOP-PUNKT 7a-verifisering avdekket at trigger **ikke** var oppdatert i live; CI rapporterte success uten å applye |
| ~13:15 | HOTFIX-A manuell migration via MCP — trigger live |
| ~13:25 | HOTFIX-B drift-audit — 1 isolert bug + 1 delvis unapplied bekreftet |
| 13:28 | Reconcile-cron manuelt trigget, 75 MSD-rader materialisert |
| 13:58 | Sentry 30-min observasjons-vindu ferdig |

**Total tid deteksjon → fix live:** ~5,5 timer (~07:30 → ~13:15 trigger live; reconcile + coverage bekreftet ~13:58)

---

## Root cause

Migration `20260520160001_seed_default_provider_melhus.sql` introduserte `provider_id NOT NULL` i `menu_service_days` uten å oppdatere `tg_menu_service_day_defaults` eller `syncMenuServiceDaysFromMenuDay.ts`. Trigger og app-kode satte aldri `provider_id` på nye INSERTs.

**Skjult i ~9 dager fordi:**

- `syncMenuServiceDaysFromMenuDay` throws ved upsert-feil
- `menu-service-day-reconcile/route.ts` hadde ingen per-menuDay try/catch, så første feil stoppet hele kjøringen
- Brukere så bare 500 `ORDER_SET_FAILED` uten kontekst — det kunne forveksles med transient feil
- Cron returnerer 200 til scheduler selv om sync-koden throws (Vercel cron sluker exception)

**Sekundær:** `supabase-migrate.yml` hadde to bugs som ga false green CI:

- `supabase db push --project-ref` (ugyldig flagg i CLI 17+)
- Pipe til `tee` uten `set -o pipefail` (mistet exit code)

Resultat: Apply migrations (prod)-steget rapporterte success selv når push faktisk feilet.

---

## Påvirkning

- Bestillingsfrist 08:00 hver virkedag siden 20. mai 2026
- Brukere kunne ikke bestille for noen dato uten pre-eksisterende MSD-rad
- 5 aktive locations berørt
- Eksakt antall feilede ordre-attempts: ukjent (Sentry event_count rapport — TODO)

**Data før fix (preflight 29.05):** 0 MSD-rader for `2026-05-29`; jun-ukedager hadde 4/5 MSD (gap fra feilede INSERTs).

**Data etter reconcile (29.05 ~13:28):** 75 MSD-rader i 21-dagers vindu; hver jun-ukedag (man–fre) har 5 MSD; MSDI 15 (BASIS) / 18 (LUXUS fre).

---

## Fix

1. **Trigger:** `CREATE OR REPLACE tg_menu_service_day_defaults` — setter `provider_id` fra `companies` via `company_locations` ved INSERT, `RAISE MSD_PROVIDER_UNRESOLVABLE` hvis ingen funnet (`20260528143000`, manuelt applied etter CI false green)
2. **Server:** Ny `mapOrderWriteError` i `lib/orders/` — strukturerte 4xx for fem error-typer (`23502`, `23503`/`23505`, `MENU_NOT_PUBLISHED`, `MENU_SERVICE_DAY_ITEMS_MISSING`, `MSD_PROVIDER_UNRESOLVABLE`)
3. **Klient:** `EmployeeWeekClient` — UUID-fix (`useRef` + scope-nøkkel) mot dobbeltklikk-duplisering, målrettede feilmeldinger per error-shape
4. **Reconcile:** Partial-success — én feilet menuDay blokkerer ikke resten av kjøringen

---

## Forhindret gjentakelse

- Trigger er nå robust mot alle INSERT-paths (webhook, cron, manuelt, fremtidig admin-UI)
- Server fanger constraint-violations + RPC RAISE-typer strukturert — neste data-mangel blir 4xx, ikke 500
- `mapOrderWriteError` er testet (`tests/error-mapping.test.ts`, 6/6 PASS)

---

## Hva som IKKE forhindrer gjentakelse (gjenstående)

- **HOTFIX-C:** `supabase-migrate.yml` workflow må fikses (`--linked` + `pipefail` + verifiserte secrets)
- **Andre stille-feilede migrations (audit HOTFIX-B):** `tpt_b7_foundation_fix` delvis unapplied (2 RPCer)
- **167 git-filer** ikke matchet i `schema_migrations` (historisk alias-drift fra manuell mai-sprint)
- **Ingen staging-miljø** → ingen E2E-verifisering før prod
- **Cron-jobs** returnerer 200 til Vercel scheduler selv ved internal throws (egen oppfølging)

---

## Hva fungerte godt

- STOP-PUNKT 7a fanget CI false green før vi trigget reconcile på en ikke-fixet DB
- Supabase MCP + psql ga rask root cause i Fase 1
- Pre-push hook fanget en utdatert idempotency-test som ellers ville bryt prod
- Per-menuDay try/catch (bonus i samme PR) gjør fremtidige sync-feil ikke-blokkerende

---

## Follow-ups (datert)

- [ ] HOTFIX-C: workflow-fix PR (i morgen)
- [ ] `tpt_b7_foundation_fix`: apply 2 manglende RPCer
- [ ] 167-filer drift: reconcile-strategi-beslutning
- [ ] Sentry alarmregel for 23502 violations
- [ ] Staging-miljø roadmap (større sprint)
- [ ] Sanity `menuDay` 2026-05-29: forretningsavklaring (mangler publisert meny)

---

## Referanser

- PR: https://github.com/Lunchportalen/lunchportalen/pull/61
- Supabase migrate CI (false green): https://github.com/Lunchportalen/lunchportalen/actions/runs/26632498982
- Migration root cause: `supabase/migrations/20260520160001_seed_default_provider_melhus.sql`
- Trigger fix: `supabase/migrations/20260528143000_fix_msd_provider_id_trigger.sql`
