# PHASE 1 — Security and Tenant Isolation (release train)

**Status:** Evidence archived · **CHANGESET COMPLETE (staging-verifisert)**
**Date:** 2026-07-13
**Branch:** `release/global-invoice-only-foundation`
**Audit basis:** `docs/audit/CONTRADICTIONS-AND-GAPS.md` §Sikkerhet/tenant (#20–#27) · `docs/RLS-AND-SECURITY-AUDIT.md`

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Lukkede funn (P0/P1)

| # | Funn | Fiks | Fil(er) |
|---|---|---|---|
| 1–2 | `canAccessCompany`/`canAccessLocation` returnerte alltid `true` for kitchen/driver | Blanket-tilgang fjernet; kitchen/driver er tenant-bundet til tildelt company/location, fail-closed uten tildeling. `routeGuard` håndhever `SCOPE_NOT_ASSIGNED` (403) for kitchen/driver uten company+location | `lib/auth/guards.ts`, `lib/http/routeGuard.ts` |
| 3 | `/api/kitchen/companies` manglet tenant-filter for kitchen | Kitchen-rolle filtreres nå eksplisitt på tildelt `company_id` OG `location_id` i både company-listen og ordre-totalene; superadmin beholder full lesing | `app/api/kitchen/companies/route.ts` |
| 4–5 | Provider A/B og Company A/B-isolasjon | Verifisert av RLS-suiten mot staging (tenantIsolation.final: company_admin/employee kryssleser IKKE; provider-rls-policies uendret) + guards-testene | `tests/rls/**`, `tests/security/tenant-isolation-endtoend.test.ts` |
| 6 | Employee må aldri lese kommersielle data | Leakage-scan: `/api/week` og `/api/order/window` inneholder ingen commission-/billing-/offered_price-felter (kildeskann, låst i test) | `tests/security/tenant-isolation-endtoend.test.ts` |
| 7 | Åpne endepunkter | `ai/track`: krever autentisert sesjon (401), server-truth `company_id`. `address/search`+`resolve`: per-IP rate limit (30) + input-cap (offentlig onboarding beholdes bevisst). `terms-pdf`: per-IP rate limit (10) + strenge input-caps (30 bullets × 300 tegn). `support/report`: tenant-avvik BLOKKERER nå (403 `COMPANY_SCOPE_MISMATCH`/`LOCATION_SCOPE_MISMATCH`, var log-only). `superadmin/profiles/link-company`: validerer at location tilhører company (422) | `app/api/ai/track`, `app/api/address/*`, `app/api/onboarding/terms-pdf`, `app/api/support/report`, `app/api/superadmin/profiles/link-company` |
| 8 | Anon/authenticated grants | Ny additiv migrasjon `20260818120000_anon_grant_lockdown.sql`: REVOKE alt fra `anon` på alle public-tabeller/views/sekvenser + REVOKE PUBLIC/anon EXECUTE på alle `lp_*`-funksjoner; `authenticated` bevares EKSAKT (snapshot før revoke); eneste verifiserte anon-inngang re-grantes: `lp_company_registration_create` (public `/registrer`, SECURITY DEFINER fail-closed). Default privileges strammet. RLS/policies urørt | `supabase/migrations/20260818120000_anon_grant_lockdown.sql` |
| 9 | `user_metadata` som rollegate | Fjernet fra: `lib/superadmin/auth.ts` (nå `profiles.role` + `disabled_at`), 5 superadmin invoices-ruter (felles `requireSuperadminApi`), `admin/dashboard`, `admin/menus`, `admin/orders`, `admin/employees/invites/bulk`, `support/report`, `lib/agreement/loadAgreementContext`, `lib/auth/roles.computeRole`, `lib/auth/routeByUser`, samt alle 8 employee-week-sider (nå `profiles.role`). Repo-scan-test låser at ingen API-rute leser `user_metadata.role` som gate (én diagnostisk COUNT i daily-sanity allowlistet) | se filliste |
| 10 | Canonical auth context | `getAuthContext`/`lookupMembership` er uendret sannhetskilde; gates konsolidert mot den/profiles.role | — |
| 11 | Pinned search_path på SECURITY DEFINER | Verifisert: **0** SECDEF-funksjoner uten pinned search_path i både staging og prod (read-only sjekk 2026-07-13). Migrasjonen endrer ingen funksjonsdefinisjoner | — |
| 12 | Audit av feilede tilgangsforsøk uten PII | `routeGuard` auditerer nå alle 403-avvisninger (`ACCESS_DENIED` med kode FORBIDDEN_ROLE/FORBIDDEN_NO_ROLE/SCOPE_NOT_ASSIGNED/COMPANY_SCOPE_MISMATCH) med pseudonym bruker-id/rolle/rute — aldri e-post eller request-body. `assertTenant`-brudd auditeres som `TENANT_VIOLATION` (eksisterende) | `lib/http/routeGuard.ts` |

## 2. Migrasjon

- `20260818120000_anon_grant_lockdown.sql` — **applied på staging** (`uigxsboqeruxflgzqztl`), verifisert: 0 anon-tabellgrants · anon EXECUTE kun på `lp_company_registration_create` · 82 lp-funksjoner beholder `authenticated` EXECUTE · 0 SECDEF uten pinned search_path. Anon-probematrise: `profiles` read → 401/permission denied · `lp_order_advance_status` → 404 (ikke eksponert) · `lp_company_registration_create` → når frem (validering svarer).
- **Production: IKKE applied** (denne fasen autoriserer ikke prod-migrasjon). Prod-status før apply: 616 anon-tabellgrants, 75 lp-funksjoner med anon EXECUTE (read-only verifisert). **Neste prod-migrasjons-GO må inkludere `20260818120000`.**
- Rollback: grants kan re-etableres med GRANT-statements (migrasjonen er ren grant-endring; ingen policy-/data-endringer). App-kallsteder er verifisert (eneste anon-avhengighet er `/registrer`-RPC-en som er re-grantet).

## 3. Testresultater

| Suite | Resultat |
|---|---|
| Security-unit (guards, endepunkter, user_metadata-scan, allowlist-matrise, leakage-scan, lockdown-kontrakt) | PASS 60/60 (5 filer, inkl. ny `tests/security/tenant-isolation-endtoend.test.ts`) |
| Full RLS-suite mot staging (7 filer) | PASS 23/23 kjørt mot staging + `migrationParity` PASS mot prod (golden er prod-pinned; kjørt read-only mot prod). 0 skipped etter fiks |
| Provider A/B · Company A/B · employee foreign · kitchen foreign company · driver foreign location | PASS (tenantIsolation.final + guards + provider-rls) |
| Anonymous route matrix | PASS (sensitive ruter aldri allowlistet; publikums-endepunkter bevisst åpne med rate limit) |
| Superadmin positiv kontroll | PASS (guards + `requireSuperadminApi`) |
| Security browser-E2E (auth, auth-redirect-safety, auth-role) mot staging | **PASS 18/18, 0 skipped** (dev-server mot staging, seedede rolle-brukere) |
| Golden Path | PASS 103/103 |
| typecheck / lint | PASS / PASS |

Testinfrastruktur-fikser i samme changeset (rot-årsaker, ikke maskering):
- `rlsFixtures.cleanup` kjører nå i én transaksjon med `session_replication_role=replica` (terminal-ordre er delete-beskyttet av `tg_guard_order_mutation`; opprydding via postgres-rollen — RLS/policies urørt) og rydder også seedede menu-dager.
- `ensureIntegrationTestTableGrants` retryer «tuple concurrently updated» (parallell GRANT-race som før skjulte 5 tenant-isolasjonstester som skipped).
- `domainHardening`-toggle-testen låser den faktiske kanoniske kontrakten: CANCEL beholder CANCELLED-raden som historikk, re-SET oppretter ny ordre, og NØYAKTIG én ACTIVE ordre per user/date/slot.
- `migrationParity` sammenligner PostgreSQL-versjonsnummer (ikke kompilator-streng); golden-snapshot regenerert fra prod (SEC-002 lukket — 293 policies/54 funksjoner/160 tabeller, inkluderer billing-blokken som manglet i 2026-07-02-snapshotet).

## 4. Produksjonspåvirkning

Ingen production mutation i denne fasen. Kode-endringene deployes først ved neste deploy-GO; grant-lockdown krever egen prod-migrasjons-GO. Umbraco/Azure/lunchportalen.no urørt. Ingen Stripe.

**STOP.** Dette dokumentet autoriserer ikke deploy eller prod-migrasjon.
