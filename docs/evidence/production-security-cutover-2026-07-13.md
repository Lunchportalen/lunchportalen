# PHASE 2 — Production Security Hotfix Cutover (evidence)

**Status:** Evidence archived · **CUTOVER COMPLETE — PRODUCTION HEALTHY**
**Date:** 2026-07-13 (kveld, UTC+2)
**Scope:** KUN den godkjente sikkerhetsfasen (release-tog Fase 1). Ingen nye markeder, ingen fakturering, ingen språkendringer, ingen Stripe, ingen global trafikk.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Identitet (exact SHA documented)

| Element | Verdi |
|---|---|
| PR | [#488](https://github.com/Lunchportalen/lunchportalen/pull/488) — squash-merget etter full grønn CI (agents_gate, enterprise, build, e2e, staging, suspend-rpc-authz, week-visual, provider-meny-visual) |
| **Merged SHA (main)** | `98b3b15e258966dd61ad967af5876982bcfcb959` |
| Previous main SHA | `d645873f` (Fase 1 release-sannhet — var allerede auto-deployet til production tidligere i dag; helse verifisert) |
| **Production deployment** | `dpl_D3VRNEr4hmNZY7vmvgDooSVgtwq5` (`lunchportalen-ct5ccm64u`) · status ● Ready · alias `app.lunchportalen.no` · bygget av Vercel GitHub-integrasjonen fra eksakt merge-SHA (verifisert via `vercel ls --meta githubCommitSha=98b3b15e…`) |
| **Runtime-bekreftelse** | `/api/health` → 200 ok=true · `data.version = 98b3b15e258966dd61ad967af5876982bcfcb959` · runtime remote_backend ok · supabase ok · db_schema ok · sanity ok · env ok |
| Branch-parity | `git diff origin/main release/global-invoice-only-foundation` = tom (0 linjer) |

## 2. Pre-deploy-porter (alle PASS før cutover)

Full RLS-suite mot staging (0 skipped) · Golden Path 103/103 · security browser-E2E 18/18 · typecheck · lint · build:enterprise · test:run 5 675 · PR-CI full grønn. Umbraco/Azure: 0 endringer (ingen filer i diff).

## 3. Backup / restore point

- Supabase scheduled physical backups er aktive på prosjektet (siste operatør-bekreftede restore point: 2026-07-11 05:07 UTC, jf. `docs/PRODUCTION-PREFLIGHT-REPORT.md`). CLI-backupliste var ikke tilgjengelig i denne sesjonen (ingen access token) — kompensert med presist restore-artefakt:
- **Eksakt pre-migrasjons-tilstand fanget read-only FØR apply:** `docs/evidence/prod-anon-grant-rollback-20260713.sql` — 436 GRANT-statements som gjenoppretter hele anon-flaten nøyaktig slik den var (migrasjonen endrer KUN grants; ingen data, ingen policies, ingen skjema).

## 4. Migrasjon (kun godkjent sikkerhetsmigrasjon)

- Dry-run mot production viste eksakt ÉN pending migrasjon: `20260818120000_anon_grant_lockdown.sql` (bekreftet «pending migrations inneholder kun godkjente sikkerhetsmigrasjoner»).
- Apply: exit 0. NOTICEs: `tables/views revoked from anon = 181` · `lp_ functions locked = 100, authenticated preserved = 82`.

## 5. Post-migration verifisering (production)

| Sjekk | Resultat |
|---|---|
| anon-tabellgrants i public | **0** (var 616) |
| anon EXECUTE på `lp_*` | **1** — kun `lp_company_registration_create` (var 75) |
| authenticated EXECUTE på `lp_*` | 83 (inkl. reparert `lp_outbox_retry_event`; `lp_order_set` bekreftet) |
| SECURITY DEFINER uten pinned search_path | **0** |
| Ledger-topp | `20260818120000` |
| RLS-parity mot golden snapshot (policies/functions/rls-tabeller) | **PASS** (kjørt post-migration mot prod — 0 policy-endringer) |

## 6. Smokes (production, read-only)

**Health:** `/api/health` 200 ok — alle delsystemer ok (før OG etter deploy).

**Anonymous access matrix (DB, prod anon-nøkkel):**

| Probe | Resultat |
|---|---|
| SELECT profiles / orders / companies / agreement_invoices | 401 · 42501 permission denied (alle) |
| RPC `lp_order_advance_status` / `lp_order_set` / `lp_provider_create` | 404 (ikke eksponert for anon) |
| RPC `lp_company_registration_create` | Når frem — fail-closed validering svarer (offentlig /registrer-inngang intakt) |

**Anonymous access matrix (app, `app.lunchportalen.no`):**

| Rute | Resultat |
|---|---|
| /api/kitchen/companies · /api/kitchen · /api/driver/stops · POST /api/orders · /api/week · /api/order/window · /api/superadmin/invoices/runs · POST /api/ai/track · POST /api/support/report · /api/admin/metrics · /api/provider/menu-days | **401 UNAUTHORIZED** (alle, med rid) |
| /api/address/search (offentlig onboarding) | 200 ok (rate-limit aktiv i ruten) |
| /week | 303 → login |
| /login | 200 |

**Provider A/B og company/location negative smoke:** Uautentisert tilgang til alle provider-/company-/kitchen-/driver-flater avvises på edge (matrix over). Kryss-tenant-garantiene (provider A ser aldri B; company A ser aldri B; kitchen/driver bundet til company/location) er bevist på det EKSAKT samme policysettet som nå kjører i production: post-migration RLS-parity PASS bekrefter at prod-policyene er identiske med settet som passerte full A/B-tenant-suite på staging tidligere i dag (tenantIsolation.final, provider-rls, domainHardening — 0 skipped). Ingen prod-testbrukere ble opprettet (ingen unødvendig prod-mutasjon).

## 7. Rollback readiness (explicitly ready)

| Lag | Rollback |
|---|---|
| **App (øyeblikkelig)** | `vercel rollback` / promote forrige production-deployment som kjørte `d645873f` (deployment-listen viser forrige Ready-deploy `lunchportalen-8oj1v7rph`); `ada0183b`-artefakten (`lunchportalen-cuowxtqv7`) finnes også fortsatt |
| **DB (presis)** | Kjør `docs/evidence/prod-anon-grant-rollback-20260713.sql` (436 statements — gjenoppretter pre-lockdown anon-flate eksakt). Migrasjonen har ingen data-/policy-/skjemaendringer, så dette er fullstendig rollback |
| **Git** | Revert `98b3b15e` på main |

Rollback er IKKE utført (ingen grunn — alle smokes grønne); beredskapen er dokumentert og artefaktene finnes.

## 8. Avgrensning bekreftet

Ingen nye markeder aktivert · ingen fakturering aktivert · ingen språkendringer · ingen Stripe (invoice_only) · ingen global trafikk-start · Umbraco/Azure/lunchportalen.no urørt (kun app.lunchportalen.no-deploy).

**STOP.** Dette dokumentet autoriserer ingen videre migrasjoner, markeder eller pengeflyt-aktivering.
