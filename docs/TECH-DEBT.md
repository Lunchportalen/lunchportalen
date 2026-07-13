# Lunchportalen — Teknisk gjeld og ikke-kritiske funn

**Status:** DOKUMENTFRYS · LOKAL FULLFØRT · EKSTERN DELVIS (2026-07-11)  
**Dato:** 2026-07-11  
**Dekning:** 7162 I · 85 P · M=0 — [OPEN-QUESTIONS.md §2](./OPEN-QUESTIONS.md#2-kanonisk-filregnskap-v6--m0)

---

## Innholdsfortegnelse

1. [Funnregister](#1-funnregister)
2. [Testhull](#2-testhull)
3. [Død eller foreldet kode](#3-død-eller-foreldet-kode)
4. [Dokumentasjonsgjeld](#4-dokumentasjonsgjeld)
5. [Foreslått prioriteringsrekkefølge](#5-foreslått-prioriteringsrekkefølge)

---

## 1. Funnregister

| ID | System | Status | Alvorlighet | Betinget | Fil:linje | Teststatus | Remote | Dup |
| -- | ------ | ------ | ----------- | -------: | --------- | ---------- | ------ | --: |
| OPS-001 | Supabase | **uavklart produksjonsdrift** | **ikke endelig klassifisert** | nei | hosted `list_migrations` + `information_schema` MCP 2026-07-11 | nei | **ja** | nei |
| SEC-001 | Next.js | bekreftet | 🟠 Høy | nei | `middleware.ts:115-136` | delvis | nei | nei |
| SEC-002 | Supabase | bekreftet | 🟠 Høy | nei | `golden-rls-snapshot.json:3-4` | RLS opt-in | ja | nei |
| SEC-003 | GitHub | bekreftet | 🟠 Høy | nei | ruleset main-protection: review_count=0, check=suspend-rpc-authz; Production env reviewer | nei | ja | nei |
| SEC-004 | Next.js | bekreftet | 🟡 Middels | nei | `actions.ts:26-57` | TEST-003 | nei | nei |
| CRON-001 | Next.js | betinget | 🔴 Kritisk† | **ja** | `lib/http/cronAuth.ts:29-31` | unit PASS | **ja** | nei |
| SR-001 | Next.js | bekreftet | 🟠 Høy | nei | `lib/supabase/admin.ts:45-48` | delvis | nei | nei |
| OBS-002 | observability | bekreftet | 🟡 Middels | nei | `actions.ts:26-57` | mangler | nei | nei |
| SCRIPT-002 | scripts | bekreftet | 🟠 Høy | nei | `scripts/k6/provision-k6-prod-pool.mjs` | nei | ja | nei |
| SCRIPT-001 | scripts | sannsynlig | 🟡 Middels | nei | `scripts/smoke/*` (27) | nei | delvis | nei |
| DESIGN-003 | UI | sannsynlig | 🟡 Middels | nei | `AppShell.tsx:47-103` | nei | nei | nei |
| DESIGN-004 | UI | bekreftet | 🟡 Middels | nei | `RegisterEmployeeClient.tsx:275` | nei | nei | nei |
| DESIGN-005 | UI/CSS | sannsynlig | 🟡 Middels | nei | ds/*.css !important | nei | nei | nei |
| DESIGN-006 | UI | sannsynlig | 🟡 Middels | nei | arbitrary Tailwind backoffice | nei | nei | nei |
| UI-001 | UI | falsk positiv | — | nei | `RegisterEmployeeClient.tsx:162` | nei | nei | nei |
| STATE-001 | hooks | avkreftet | — | nei | `useSettings.ts:36` | nei | nei | nei |
| CACHE-001 | lib | avkreftet | — | nei | `readGlobal.ts:119` | nei | nei | nei |
| BILL-001 | billing | avkreftet | ⚪ Lav | nei | `globalCommission.ts:67` | TS only | nei | nei |
| ORD-001 | orders | avkreftet | ⚪ Lav | nei | `20260730120000:412` | DB test | nei | nei |
| INV-001 | invites | avkreftet | ⚪ Lav | nei | `accept-invite/complete/route.ts:278` | mangler | nei | nei |

†**CRON-001 betingelse:** Kritisk kun hvis `CRON_SECRET` ikke er satt i prod **og** `x-vercel-cron: 1` bypass er aktiv.

**Funnstatistikk:** Aktive hovedfunn 14 · Betingede kritiske 1 · Kandidater 154 (0 venter) · Avkreftede 6 · Hierarki: [OPEN-QUESTIONS.md §3c](./OPEN-QUESTIONS.md#3c-hierarkisk-id-matrise) · **Hoved-ID-er: 20**

### OPS-001 — Hosted prod migrasjonsdrift (LUKKET 2026-07-13)

**Status:** `lukket` · Historisk funn fra 2026-07-11 er **superseded av runtime-verifisering 2026-07-13** (Truth Audit + Fase 1 release-sannhet).

**Runtime-sannhet (MCP `list_migrations` mot prod `hkpokyapzarefrgqzkos`, 2026-07-13):** Hele billing-blokken `20260729120000`–`20260809120000` **ER kjørt i production** (applisert 2026-07-11 17:46–17:47 UTC etter eksplisitt operatørgodkjenning, se `docs/PRODUCTION-PREFLIGHT-REPORT.md`). Prod-ledger omfatter `20260528000000` → `20260814120000`. Commission-tabellene finnes i prod med `commission_rules` seedet (`LP_GLOBAL_5P`). Migrasjonene `20260815`–`20260817` (nl + 21-lands-korreksjon) håndteres i Fase 1 av release-toget med egen staging→prod-verifisering.

**Konsekvens:** Det finnes ingen migrasjonsdrift mellom repo og prod for billing-blokken. E2-blokkeringen er **ikke** manglende skjema — den er (1) ingen betalings-provider-env i prod (invoice_only-modell) og (2) manglende cron for periodestenging/fakturaopprettelse. Se `docs/audit/CONTRADICTIONS-AND-GAPS.md` #2.

**Historisk analyse (2026-07-11, bevart for sporbarhet):** Funnet var korrekt på kontrolltidspunktet — prod manglet da 12 fremtidsdaterte billing-versjoner mens `20260810120000` var cherry-picket. Dette ble lukket av den kontrollerte produksjonsmigrasjonen samme kveld.

Se også kandidatregister i [OPEN-QUESTIONS.md §4](./OPEN-QUESTIONS.md#4-kandidatregister-154-rader).

### 1b. Kandidatregister (154 — alle manuelt vurdert)

| Metrikk | Antall |
|---------|-------:|
| Kandidat-ID-er totalt | 154 |
| Bekreftet underfunn | 1 |
| Sannsynlig | 109 |
| Legitim implementasjon | 21 |
| Falsk positiv | 23 |
| Venter manuell verifisering | **0** |
| Kontrollsum | **gyldig** |

Full liste: [OPEN-QUESTIONS.md §4](./OPEN-QUESTIONS.md#4-kandidatregister-154-rader).

---

## 1c. Utvidet funnregister (legacy detaljer)

| ID | Alvorlighet | System | Kategori | Funn | Konsekvens | Bevis | Anbefalt retning |
| -- | ----------- | ------ | -------- | ---- | ---------- | ----- | ---------------- |
| SEC-001 | 🟠 Høy | Next.js | auth | Stripe provider webhooks ikke allowlisted | Betalingswebhooks blokkert (401) | `apiAllowlist.ts:9-91`, `middleware.ts:115-136` | Se RLS-AND-SECURITY-AUDIT.md |
| SEC-002 | 🟠 Høy | Supabase | migrasjoner | Golden RLS snapshot forfalt | Drift-check upålitelig | `golden-rls-snapshot.json:3-4` | Regenerer snapshot |
| SEC-003 | 🟠 Høy | GitHub | CI/CD | 0 required PR reviews på main | Merge til main uten uavhengig review (PR obligatorisk, push blokkert) | `gh api .../protection` | Aktiver review-krav |
| ARCH-001 | 🟡 Middels | Sanity | duplisert sannhet | `provider` dokumenttype er read-only mirror av Supabase | Sync-drift risiko | `studio/schemaTypes/provider.ts:4-6` | Dokumenter sync-kontrakt; overvåk `lastSyncedAt` |
| ARCH-002 | 🟡 Middels | Next.js/Umbraco | arkitekturbrudd | Tre CMS-lag: Umbraco + Sanity + Supabase `content_pages` | Uklar eierskap for public content | `baseline:10743` content_pages; `docs/architecture/PUBLIC_SITE_AND_APP_BOUNDARIES.md` | Avklar roadmap: deprecate `content_pages` for public eller dokumenter dual-use |
| SANITY-001 | 🟡 Middels | Sanity | arkitekturbrudd | `page`/`pricingInfo` registrert lokalt; null publiserte dokumenter i prod-dataset 2026-07-11 | Schema registrert; ingen runtime-leser; remote telling null | `studio/schemaTypes/page.ts`, `pricingInfo.ts` | Avklar remote dataset; migrer eller deprecate |
| SANITY-002 | 🟡 Middels | Sanity | datamodell | Orphan `dish` schema ikke registrert | Forvirring, død kode | `studio/schemas/dish.ts` (ikke i `schemaTypes/index.ts`) | Slett eller registrer |
| RLS-001 | 🟡 Middels | Supabase | RLS | Open SELECT på billing catalog | Alle auth brukere ser produktkatalog | `20260609120000_dc018:16-20` | Dokumenter som tilsiktet |
| NEXT-001 | 🟡 Middels | Next.js | types | `LoosePublicTable` for 131/136 tabeller | Schema-drift skjult | `lib/types/database.ts:19-27` | Regenerer typer: `npm run db:types` |
| NEXT-002 | 🟡 Middels | Next.js | cron | 16 cron-ruter uten Vercel schedule | Jobs kjører aldri automatisk | `vercel.json` vs `app/api/cron/` | Dokumenter trigger-kilde eller legg til schedules |
| NEXT-003 | 🟡 Middels | Next.js | auth | Duplikat onboarding route | To innganger samme flyt | `app/onboarding/complete/route.ts` + `app/api/onboarding/complete` | Konsolider til én |
| NEXT-004 | 🟡 Middels | Next.js | legacy | `src/components/nav/HeaderShell.tsx` duplikat | Vedlikeholdsrisiko | `src/` (5 filer) vs `components/nav/` | Slett `src/` legacy |
| NEXT-005 | 🟡 Middels | Next.js | CMS | `ContentWorkspace.tsx` monolitt (~5.7k linjer) | Vedlikehold, review-tid | `docs/MASTER_FULL_REPOSITORY_AUDIT.md:15` | Fortsett modularisering (faseplan finnes) |
| CI-001 | 🟡 Middels | GitHub | CI/CD | CODEOWNERS placeholder | Ingen faktisk code owner enforcement | `.github/CODEOWNERS` | Oppdater med reelle teams |
| CI-002 | 🟡 Middels | GitHub | CI/CD | Docs-only PRs skipper CI | Uoppdaget link-brudd | `docs/architecture/monorepo.md:165-167` | Akseptabelt; vurder `check:links` i schedule |
| TEST-001 | 🟡 Middels | testing | testhull | Provider Stripe webhooks ikke i allowlist-regression | SEC-001 ikke fanget av CI | `api-allowlist-regression.test.ts:136-141` | Utvid scan-mønster |
| TEST-003 | 🟡 Middels | testing | testhull | Ingen test for `setCompanyStatus` server action (SEC-004) | company_admin status-mutasjon uoppdaget | Ingen testfil | E2E action + RLS live test |
| TEST-004 | 🟡 Middels | testing | testhull | Ingen middleware→route test for Stripe provider webhooks | SEC-001 route-sikkerhet ubevist i CI | Mangler | Integrasjonstest med allowlist mock |
| TEST-005 | ⚪ Lav | testing | testhull | Cron replay/rate-limit ikke testet | CRON-001 exploit window | `cronAuth.test.ts` dekker kun unit | Pen-test cron med/uten secret |
| SEC-004 | 🟠 Høy | Next.js | auth | `setCompanyStatus` action uten superadmin-gate; RLS `companies_update` tillater `company_admin` | Firmalivssyklus kan endres uten superadmin | `actions.ts:26-44`, `can_manage_company` baseline:606-622 | Deprecate action; bruk `set-status` API |
| CRON-001 | 🟠 Høy | Next.js | cron | `x-vercel-cron: 1` tillatt uten secret | Spoofbar cron-trigger når `CRON_SECRET` mangler | `cronAuth.ts:29-31`, `cronAuth.test.ts:39-42` | Krev secret i prod; begrens header-bypass |
| SR-001 | 🟠 Høy | Next.js | service role | 573 importsteder; **46** API-ruter middleware-only (liste i RLS-doc) | Feil gate → full DB | `admin.ts`; import-scan | Handler-gate før admin |
| TEST-002 | 🟡 Middels | testing | testhull | Post-golden billing RLS ikke i parity-test | Nye tabeller uten RLS-test | Mangler i `tests/rls/migrationParity.test.ts` | Utvid etter snapshot-regenerering |
| DESIGN-001 | 🟡 Middels | Next.js | designsystem | Arbitrary Tailwind i toast/tooltip | Token-brudd | `components/ui/toast.tsx:82,91`, `tooltip.tsx:36` | Erstatt med `shadow-soft`, spacing tokens |
| DESIGN-002 | 🟡 Middels | Next.js | designsystem | Blandet `ds-*` og `lp-*` | To parallelle konvensjoner | `components/ui/ds/Button.tsx`, `app/styles/ds/`, `app/globals.css` `--lp-*` | Dokumenter hierarki: `lp-*` = tokens, `ds-*` = komponenter |
| A11Y-001 | 🟡 Middels | Next.js | tilgjengelighet | `getClosedDatesForDate` stub returnerer `[]` | Closed dates vises ikke for ansatte | `lib/sanity/getClosedDatesForDate.ts` | Wire GROQ eller fjern feature flag |
| DOC-001 | ⚪ Lav | docs | dokumentasjon | `monorepo.md` sier 16 workflows, faktisk 20 | Feil telling | `.github/workflows/` (20 filer) | Oppdater monorepo.md |
| DOC-002 | ⚪ Lav | docs | dokumentasjon | Mange `_tmp-*` og `scripts/temp-*` untracked | Rot i working tree | `git status` | `.gitignore` eller slett etter bruk |
| DOC-003 | ⚪ Lav | docs | dokumentasjon | 50+ legacy MD i `docs/` rot | Vanskelig navigasjon | `docs/README.md` | Fortsett hub-organisering |
| DEPS-001 | ⚪ Lav | avhengigheter | lockfile | `package-lock.json` + `pnpm-lock.yaml` coexisting | Forvirring om package manager | Rot `package.json` bruker npm | Velg én manager |
| DEPS-002 | ⚪ Lav | avhengigheter | pakker | `studio/lunchportalen-studio/` deprecated | Død avhengighet | `studio/lunchportalen-studio/DEPRECATED.md` | Fjern mappe |
| MIG-001 | ⚪ Lav | Supabase | migrasjoner | 250+ arkiverte migrasjoner i `_archive/` | Forvirring om rekkefølge | `supabase/migrations/_archive/` | Dokumenter at kun root-level er aktive |
| MIG-002 | ⚪ Lav | Supabase | migrasjoner | `lib/types/database.ts` håndskrevet | Drift fra schema | `lib/types/database.ts:1-5` | Automatiser typegen |
| OBS-001 | ⚪ Lav | observability | logging | PII i logger ikke systematisk auditert | Potensielt GDPR-brudd | Diverse `console.log` i scripts | Gjennomgang av log-policy |
| UMB-001 | ⚪ Lav | Umbraco | SEO | SEO avhengig av Umbraco SeoToolkit | Ikke verifisert runtime | `lunchportalen.csproj` package ref | Manuell SEO-audit på prod |
| UMB-DESIGN-001 | 🟡 Middels | Umbraco | designsystem | Hardkodede farger i `priser-page-blocks.css` | Brudd mot token-system | `umbraco17/.../priser-page-blocks.css:9-13` | Align med `lp-*` tokens |
| BILL-001 | ⚪ Lav | billing | vedlikehold | TS preview + SQL ledger samme formel (500 bps / 10000) | Drift ved fremtidig endring | `globalCommission.ts`, `20260729120000` | SQL autoritativ; parity-test |
| BILL-002 | 🟡 Middels | billing | idempotens | `invoices/generate` delvis idempotent | Duplikat periode | CRON-001 | Utvid idempotens-keys |
| ORD-001 | ⚪ Lav | orders | statusmaskin | UI labels i `kitchenOrderStatus.ts`; DB håndhever i RPC | Ingen — avkreftet | `20260730120000:412-454` | — |
| INV-001 | ⚪ Lav | invitations | testhull | Replay-kontroll finnes (`used_at`) | Regression-test mangler | `accept-invite/complete/route.ts:278` | E2E replay-test |
| OBS-002 | 🟡 Middels | observability | audit | `setCompanyStatus` uten opsLog/audit | Sporbarhet SEC-004 | `actions.ts:26-57` | Deprecate action |
| SCRIPT-002 | 🟠 Høy | scripts | prod mutasjon | `provision-k6-prod-pool.mjs` eksplisitt prod | Feil kjøring → prod mutasjon | `scripts/k6/provision-k6-prod-pool.mjs` | Guard + dokumentasjon |
| DESIGN-004 | 🟡 Middels | UI | hardkodet farge | `RegisterEmployeeClient.tsx:275` CTA `#f5c842` | Token-brudd | Bekreftet Fase 7 | Migrer til `lp-*` |
| DESIGN-003 | 🟡 Middels | UI | inline style | `AppShell.tsx:47-103` legacy shell | Token-brudd | Bekreftet subset | Erstatt med tokens |

### Kandidater (ikke bekreftet — regex-batch G6)

154 automatiske treff — se §1b. **Telles ikke** som bekreftede funn.

### Manuell verifiseringsfremdrift (fullført)

| Blokker | Filer åpnet | I | P | M slutt |
|--------:|------------:|--:|--:|--------:|
| 1–8 | 1600 | 1575 | 25 | 3835 |
| 9–28 | 2235 | 5587 | 60 | **0** |
| **Totalt** | **3835** | **7162** | **85** | **0** |

---

## 2. Testhull

Prioritert matrise over manglende eller svake testområder:

| Prioritet | Område | Eksisterende | Mangler | Bevis |
|-----------|--------|--------------|---------|-------|
| P1 | Stripe provider webhook allowlist | SaaS webhook testet | Middleware bypass for provider routes | SEC-001 |
| P1 | `setCompanyStatus` server action | API `set-status` testet | Action uten superadmin | SEC-004, TEST-003 |
| P1 | Cron auth prod config | Unit `cronAuth.test.ts` (27 tester PASS) | Prod `CRON_SECRET` satt / header exploit | CRON-001 |
| P1 | Post-20260702 RLS policies | Golden snapshot | Billing engine, menu translations | SEC-002 |
| P1 | `lp_billing_*` RPC authz | `tests/db/global-billing-engine-foundation.test.ts` | Full authenticated abuse-test | Migrasjoner `20260729120000+` |
| P2 | Auth hook JWT claims | Shadow migration | End-to-end claim → RLS test | `20260708120000` |
| P2 | All 9 locales menu publish | Staging matrix scripts (untracked) | CI-innlemmet test | `_tmp-9-locale-staging-matrix.mjs` |
| P2 | Umbraco deploy smoke | `postdeploy.yml` | Innholds-/SEO-verifikasjon | Workflow finnes |
| P3 | WCAG AA systematisk | Mobile invariant e2e | Full a11y audit (axe) | `e2e/mobile-invariants` |
| P3 | Cache tenant-isolasjon | Ingen dedikert test | RSC/fetch cache cross-tenant | — |
| P3 | CMS single source of truth | 100+ Umbraco parity-tester | Ingen prod-verifisering av aktiv kilde | ARCH-002 |
| P3 | Sanity `page`/`pricingInfo` | Schema registrert | Ingen lokal runtime-leser; remote uverifisert | SANITY-001 |
| P3 | Invite replay etter `used_at` | Kontroll i kode | Dedikert regression-test | INV-001 |
| P3 | SQL↔TS provisjon parity | TS unit-test | Sammenligning mot SQL fixture | BILL-001 |
| P3 | Postdeploy prod gate | `tests/ci/postdeploy-transient.test.ts` | Remote `POSTDEPLOY_BASE_URL` uverifisert | postdeploy.yml |

### Eksisterende sterk testdekning

| Område | Tester | Status |
|--------|--------|--------|
| Tenant isolation | `tests/tenant-isolation.test.ts`, `tests/rls/` | ✅ 5 268 tester PASS |
| Protected golden path | `npm run test:golden-path` | ✅ CI guard |
| API allowlist regression | `tests/security/api-allowlist-regression.test.ts` | ✅ PASS (gap TEST-001) |
| Cron auth | `tests/lib/http/cronAuth.test.ts` | ✅ 11 tester (G3 kjørt); unit only |
| Server actions | — | ⚠️ SEC-004 uten test |
| CMS parity (Umbraco) | 100+ `tests/cms/*Parity.test.ts` | ✅ Omfattende |
| Sanity menu | `tests/cms/menuDayReader.test.ts`, `tests/runtime/SanityHealthTruth.test.ts` | ✅ G4 kjørt (20 tester) |
| Postdeploy | `tests/ci/postdeploy-transient.test.ts` | ✅ Unit; ikke live URL |
| Suspend RPC authz | `tests/db/suspend-rpc.test.ts` + workflow | ✅ Integration gate |

---

## 3. Død eller foreldet kode

| Sti | Hvorfor ubrukt | Søk utført | Risiko |
|-----|----------------|------------|--------|
| `studio/lunchportalen-studio/` | `DEPRECATED.md`; tom schema | Glob + package.json | ⚪ Forvirring |
| `studio/schemas/dish.ts` | Ikke i `schemaTypes/index.ts` | Grep `_type.*dish` | ⚪ Død schema |
| `src/components/nav/HeaderShell.tsx` | Kanonisk er `components/nav/` | Grep imports av `src/components` | 🟡 Duplikat |
| `hooks/` (tom) | Ingen filer | Glob | ⚪ Tom mappe |
| `types/` (tom) | Typer i `lib/types/` | Glob | ⚪ Tom mappe |
| `lib/sanity/getClosedDatesForDate.ts` | Stub `return []` | Read file | 🟡 Halvimplementert |
| `_tmp-*.mjs` (80+ untracked) | Engangs-scripts | git status | ⚪ Rot |
| `scripts/temp-*.mjs` (20+ untracked) | Staging-evidence scripts | git status | ⚪ Rot |
| `supabase/migrations/_archive/` (250+) | Erstattet av baseline | Migrasjon rekkefølge | ⚪ Historikk |

**Ikke erklært død (aktiv via routing/framework):**
- `app/onboarding/complete/route.ts` — duplikat men potensielt i bruk (krever trafikk-analyse)
- Alle 29 cron-ruter — allowlisted, noen uten schedule men kan trigges manuelt

---

## 4. Dokumentasjonsgjeld

| Dokument | Påstand | Implementasjon | Status |
|----------|---------|----------------|--------|
| `docs/architecture/monorepo.md:154` | «16 workflows» | 20 workflows | ⚠️ Foreldet |
| `docs/MASTER_FULL_REPOSITORY_AUDIT.md` | «57 migrasjoner» | 61 aktive + baseline | ⚠️ Foreldet |
| `docs/architecture/monorepo.md:94` | Sanity = «week menus, dishes» | Også `page`, `pricingInfo`, `provider` | ⚠️ Motstridende |
| `AGENTS.md` | RC gates | Matcher `package.json` scripts | ✅ Korrekt |
| `docs/PROTECTED_GOLDEN_PATH.md` | Order pilot | Matcher kode + CI guard | ✅ Korrekt |
| `docs/VISUAL_SYSTEM.md` | `lp-*` tokens | Matcher `app/globals.css` | ✅ Korrekt |
| `docs/rls-golden.md` | RLS golden rules | Matcher snapshot + migrasjoner | ✅ Korrekt (men snapshot forfalt) |

---

## 5. Foreslått prioriteringsrekkefølge

### 1. Sikkerhet og datalekkasje
- OPS-001: Avklar objekt-/deploykonsekvens (uavklart; ikke 🔴 uten runtime-bevis)
- SEC-001: Fix Stripe provider webhook allowlist
- SEC-002: Regenerer golden RLS snapshot
- SEC-003: Aktiver PR review requirement

### 2. Tenant og roller
- Verifiser auth hook remote (OPEN-QUESTIONS.md)
- Review `lp_billing_*` RPC in-function auth

### 3. Dataintegritet
- SANITY-001: Avklar/fjern `page`/`pricingInfo` fra Sanity
- ARCH-002: Avklar CMS-eierskap (Umbraco vs content_pages)

### 4. Deploy og miljø
- NEXT-002: Align Vercel cron med route inventory
- CI-001: Oppdater CODEOWNERS

### 5. Testdekning
- TEST-001: Utvid allowlist-regression
- TEST-002: RLS parity for billing engine

### 6. Arkitektur og duplisering
- NEXT-004: Fjern `src/` legacy
- SANITY-002: Fjern orphan `dish` schema
- DEPS-001: Velg én lockfile-strategi

### 7. Tilgjengelighet og design
- DESIGN-001: Fix arbitrary tokens i toast/tooltip
- A11Y-001: Wire closed dates

### 8. Opprydding
- DOC-002: Rydd `_tmp-*` / `scripts/temp-*`
- DEPS-002: Fjern deprecated studio scaffold
- MIG-001: Dokumenter `_archive/` policy
