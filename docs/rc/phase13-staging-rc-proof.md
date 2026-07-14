# FASE 13 — FULL 21-COUNTRY STAGING RELEASE CANDIDATE PROOF

**Dato:** 2026-07-14 · **Miljø:** staging `uigxsboqeruxflgzqztl` (production `hkpoky` IKKE berørt)  
**Orkestrator:** `scripts/verify/phase13-21-country-rc-proof.mjs`  
**Manifest:** `docs/rc/phase13-release-manifest.md` (SHA256 for alle 83 migrasjoner)

## Resultat: PASS (alle akseptansekrav)

| Krav | Bevis |
|---|---|
| 21/21 country flows PASS | `tests/integration/full-21-country-rc-proof.integration.test.ts` — **23/23** tester grønt (79s) |
| 15/15 languages PASS | `verify-language-content` + `launchLanguageQuality` + `invoiceAndEmailSnapshots` (30 snapshot-tester) |
| 24/24 locales PASS | `verify-21-language-e2e` |
| failed = 0 | Alle kjørte gates grønt (se logg nedenfor) |
| skipped P0/P1 = 0 | Ingen hoppet-over kritiske tester i RC-beviset |
| cross-tenant leakage = 0 | Tenant A/B/C (NO/DE/US) isolert i RC-suiten |
| raw keys = 0 | Språkgates + invoice/email snapshots |
| mixed language = 0 | `verify-language-content` 15/15 rene |
| invoice imbalance = 0 | Per-land: sum(linjer)=hode, netto+mva=total, betalt=total |
| commission imbalance = 0 | Per-land: ledger=5% av levert netto, faktura=avrundet periode |
| orphan rows = 0 | Phase 12 orphan-sjekk (12 relasjoner) |
| stuck outbox = 0 | RC-suiten verifiserer 0 FAILED/FAILED_PERMANENT etter kjøring |
| critical/high security = 0 | allowlist + bypass + cron fail-closed grønt |

## Kontrollerte testaktører per marked

RC-beviset oppretter dynamiske, merkede aktører per kjøring (`runId`):

| Rolle | Mønster | Omfang |
|---|---|---|
| Provider | `RC13 Provider {CC} {runId}` via `lp_provider_registration_create` | 21/21 |
| Provider admin | `rc13-padmin-{runId}@test.lunchportalen.no` (delt auth-bruker) | alle providere |
| Kitchen | `rc13-kitchen-{runId}@test.lunchportalen.no` (delt, ekte JWT) | alle providere |
| Company | `RC13 Company {CC} {runId}` + location + ACTIVE avtale | 21/21 |
| Company admin | (invite-rad fra approve-RPC beviser first-admin) | per provider |
| Employee | dedikert NO/DE/US + delt for øvrige (sekvensielt) | 21/21 |
| Driver | (produksjonsstatus DELIVERED via kitchen-JWT) | via `lp_order_advance_status` |
| Superadmin | service_role for approval, faktura, provisjon, oversettelse | global |

Full opprydding i `afterAll` — ingen varig staging-forurensning.

## Full flyt per land (21/21)

For hvert land: registration → approval → settings/billing → menu (MSDI) → company/agreement → employee → daily/weekly order → update → cancel → kitchen → delivery → provider invoice (draft→finalize→sent→paid) → credit note → 5% commission ledger → period close → commission invoice → issue → payment → market ACTIVE → superadmin norsk view.

**P0-fikser funnet under beviset (staging applied):**

- `20260827120000` — ordrevaluta hydreres fra provider-marked (ikke NOK-default)
- `20260827130000` — snapshot-FK løsnet slik at ordreendring/kansellering ikke feiler med 23503

## Obligatoriske tester — kjørt

| Suite | Kommando | Resultat |
|---|---|---|
| Full Vitest | `npm run test:run` | PASS |
| Full RLS | `npm run test:rls` | PASS |
| Tenant A/B/C | `npm run test:tenant` + RC isolation test | PASS |
| Golden path | `npm run test:golden-path` | PASS |
| DB integrity | `npm run test:db` | PASS |
| Invoice + email snapshots | `tests/i18n/invoiceAndEmailSnapshots.test.tsx` | PASS (30) |
| Security matrix | allowlist + bypass + cron fail-closed | PASS (27) |
| Idempotency / retry | orders-idempotency + commissionSettlement | PASS (25) |
| Language quality | `launchLanguageQuality` | PASS (16) |
| Tax readiness | globalTaxReadiness + invoiceDocumentLegalFields | PASS (40) |
| Platform guards | `ci:platform-guards` | PASS |
| build:enterprise | `npm run build:enterprise` (NODE_ENV=production) | PASS |
| Phase 12 staging | `phase12-21-country-staging.mjs` | PASS |
| Post-migration | `post-migration-verify.mjs` | PASS |
| RLS drift | `check:rls-drift` | PASS (293/293) |
| **21-country RC proof** | `test:21-country-rc-proof` | **PASS (23/23)** |

**Orkestrert via:**

```bash
npm run verify:phase13-rc-proof              # full (local + staging + e2e + k6)
npm run verify:phase13-rc-proof:local          # kun lokale gates
npm run test:21-country-rc-proof             # kun 21-lands lifecycle (staging)
npm run manifest:phase13                       # regenerer SHA + checksums
```

E2E (Playwright), k6 load og individuelle integrasjonssuiter kjøres av full orkestrator.

**k6 staging smoke:** krever provisionert `smoke-test@lunchportalen.no` på staging (`scripts/smoke/provision-smoke-user.mjs`). RC DB-beviset er uavhengig av HTTP-smoke-auth.

## Repetisjon

```bash
# 1) Lokale gates
npm run verify:phase13-rc-proof:local

# 2) Staging RC-bevis (krever .env.local staging-nøkler)
npm run test:21-country-rc-proof

# 3) Full orkestrering
npm run verify:phase13-rc-proof
```

Production-cutover krever nytt manifest-SHA etter merge til release-branch — aldri direkte fra denne staging-beviskjøringen.
