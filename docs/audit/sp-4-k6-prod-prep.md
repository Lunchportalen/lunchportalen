# SP-4 — K6 Del 5 Prod Prep Report

**Dato:** 2026-05-24  
**Stop-punkt:** 4 — prod tenant klar; vent `GO K6 LIVE`  
**Bruker-valg:** **A** — ny «Lunchportalen QA»-tenant

---

## 5.0 Prod threshold-justering

| Sak | Status |
|-----|--------|
| `order_place_duration` prod p95 | **3000ms** (DC-033 placeholder) |
| Andre prod endpoint-thresholds | **Uendret** |
| `abortOnFail` audit | **OK** |
| Commit | `3cf4e294` på `origin/main` |

---

## 5.1 Prod discovery (før A)

| Sak | Funn |
|-----|------|
| Test/QA/K6/demo tenants | **Ingen** |
| k6/qa auth.users | **0** |

---

## 5.2 Add-ons (A)

| Add-on | Resultat |
|--------|----------|
| **Intern flagg (DC-034)** | Kolonne finnes ikke (`is_internal` / `is_test` / `tenant_type` / `metadata`). Ticket: [`dc-034-add-internal-test-flag-companies.md`](dc-034-add-internal-test-flag-companies.md). Tenant identifiseres via navn + orgnr `888888888`. |
| **Tripletex (DC-026)** | **Globalt flagg** — `TRIPLETEX_FLOW_1_ENABLED` usatt i prod/preview (fail-closed). Ingen `tripletex_customers`-rad for QA-tenant (0 rader). Per-tenant disable ikke nødvendig. |
| **Notifikasjoner (DC-035)** | `profiles.notifications_enabled` finnes ikke. Ticket: [`dc-035-profile-notifications-disabled.md`](dc-035-profile-notifications-disabled.md). `provision-k6-prod-pool.mjs` → no-op hook. |

---

## 5.3 Prod tenant + provision

| Sak | Status |
|-----|--------|
| Migrasjon | `20260524130000_k6_prod_tenant.sql` → applied prod (`k6_prod_tenant` i schema_migrations) |
| Company | **Lunchportalen QA** `e0a00000-0000-4000-8000-000000000001` |
| Location | `e0a00000-0000-4000-8000-000000000002` |
| Agreement | **ACTIVE / BASIS / 5 dager** (man–fre) |
| tripletex_customers | **0** (forventet) |
| 20 k6-vu brukere | **20/20** (profiles + memberships) |
| `provision-k6-prod-pool.mjs` | **20/20** passord reset, Supabase login probe OK |
| `K6_PROD_PASSWORD` i `.env.local` | **OK** (gitignored) |
| `K6_PROD_COMPANY_ID` | `e0a00000-0000-4000-8000-000000000001` |

---

## 5.4 Live login + read-path (prod)

| Sak | Status | Notat |
|-----|--------|-------|
| `POST /api/auth/login` k6-vu-01 | **PASS** | 200, `ok=true`, `role=employee`, session cookie |
| Supabase direct profile read | **PASS** | `profiles` + `agreements` OK med pool-passord |
| `GET /api/week` | **FAIL** | 500 `PROFILE_LOOKUP_FAILED` (k6 smoke 0/11; cookie session) |
| `GET /api/orders?date=` | **FAIL** | 403 (k6 smoke 0/11) |
| `GET /api/me` | **FAIL** | 403 `profile_missing` — prod app spør `profiles.is_disabled` (kolonne finnes ikke) |
| k6 prod smoke (1 VU, 60s) | **PARTIAL** | Login 3/3 ✓ · health/kitchen/order_place ✓ · week/day_view ✗ |

**Root cause (read-path):** Tenant-data er korrekt. Feil ligger i **prod app-lag**: SSR cookie-session når ikke `loadProfileByUserId` (week 500 via `user_id`-fallback), og `/api/me` refererer ikke-eksisterende `is_disabled`. Ordre-scope via membership fungerer delvis (`order_place` ~2.47s p95, ikke 5xx).

**Anbefaling før Del 6:** Verifiser `/api/week` 200 for k6-vu-01 i browser eller etter minimal app-fix deploy. Ikke start K6 LIVE baseline mot prod read-paths før dette er grønt.

---

## SP-4 status-tabell

| Sak | Status |
|-----|--------|
| Prod order_place threshold 3000ms | **OK** |
| Eksisterende prod test-tenants | **Ingen** (før A) |
| Bruker-valg (A/B/C) | **A** |
| Tenant-migrasjon applied | **OK** |
| 20 k6-vu prod-brukere | **20** |
| ACTIVE avtale + 5 leveringsdager | **OK** |
| Live login app.lunchportalen.no | **PASS** |
| `/api/week` + `/api/orders` + `/api/me` 200 | **FAIL** (app, ikke tenant) |
| `K6_PROD_PASSWORD` i `.env.local` (gitignored) | **OK** |

---

## STOP-PUNKT 4

Prod test-tenant og pool-passord er klare. **Read-paths er ikke grønne** — avklar app-fix eller manuell verifikasjon før belastning.

For Del 6 (`GO K6 LIVE`), bekreft også:
- Lavtrafikk-vindu (~65 min uavbrutt)
- Sentry + Vercel + Supabase dashboards åpne
- 90 min fokustid

→ Skriv **`GO K6 LIVE`** når read-paths er OK og du er klar.
