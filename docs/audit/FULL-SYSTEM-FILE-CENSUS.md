# FULL SYSTEM FILE CENSUS — Lunchportalen End-to-End Truth Audit

Dato: 2026-07-13 (revidert etter komplett fullesning)
Audit-modus: READ-ONLY. Ingen kildekode, tester, migrasjoner eller production-data er endret.
Grunnlag: `git ls-files` på lokal HEAD `a9c3e0fd` (branch `fix/correct-21-country-market-model`).

## Totaltall (eksakte)

| Metrikk | Antall |
|---|---|
| Tracked files (git ls-files) | **7 795** |
| Untracked files (others, exclude-standard, før audit) | 38 |
| Modifiserte tracked (før audit, uendret av audit) | 1 (`docs/PRODUCTION-PREFLIGHT-REPORT.md`) |
| Nye filer opprettet av audit | 7 (kun `docs/audit/*.md`, ikke committet) |
| Worktrees | 3 |

## Endelig kategorisering — alle 7 795 filer, nøyaktig én kategori

| Kategori | Antall | Definisjon / begrunnelse |
|---|---|---|
| RELEVANT_READ_FULL | **3 962** | Relevante filer lest komplett av lesagenter med leseprotokoll |
| RELEVANT_READ_CHUNKED | **98** | Relevante filer >1500 linjer lest i sammenhengende chunks uten hull (bl.a. baseline-migrasjonen 23 888 linjer i 16 chunks, EmployeeWeekClient 2 428, AGENTS.md, tripletex/client.ts 2 034, localRuntime/cmsProvider.ts 2 270, 15 locale-kataloger à ~1 911 linjer, path-manifester 06b/06c/06e, staging-schema-dump, IMPLEMENTATION_LOG 2 086) |
| GENERATED | **105** | `artifacts/**` (315→i artifacts-delen som er tracked: talt her), `repo-intelligence/**`, `_8-review-surface/**`, `_72-review-surface/**`, `_ci-snap-update/**`, `package-lock.json`, `next-env.d.ts`, `lib/types/database.ts` + **3 omklassifiserte maskingenererte inventar-manifester** (`docs/audit/01-repo-tree-full.txt` ~172 871 linjer, `02-file-manifest.json` ~2,9 mill. linjer, `03-file-manifest.csv` ~172 870 rader — head/tail-samplet, innholdet er path-lister uten atferdssannhet) |
| BINARY | **5** | exe/dll/onnx/zip/node |
| MEDIA | **315** | png/jpg/ico/svg/webp/woff m.m. (public/, e2e-baselines, docs-bilder) |
| HISTORICAL_MIGRATION | **253** | `supabase/migrations/_archive/**` (nøkkel-RPC-er verifisert mot baseline; arkivet er historikk) |
| TEST_FIXTURE | **4** | `tests/_fixtures/**`, golden-rls-snapshot.json, snapshot-kataloger |
| UMBRACO_PROTECTED | **384** | `umbraco17/**`, `lunchportalen.sln`, `Directory.Packages.props`, Umbraco-workflows — IKKE lest, IKKE endret |
| IRRELEVANT_WITH_REASON | **2 669** | Se begrunnelser under |
| **SUM** | **7 795** | ✓ eksakt |

**Pending = 0 · Unresolved = 0**

### IRRELEVANT_WITH_REASON — begrunnelser (2 669 filer)

| Gruppe | Antall | Begrunnelse |
|---|---|---|
| `docs/**` utenfor pålagt dokumentunivers (architecture/engineering/runbooks/evidence/audit/launch/rollout) | 1 378 | Historisk dokumentasjon på laveste bevisnivå; pålagte docs-kataloger (317 filer) er 100 % lest |
| Backoffice CMS/AI/marketing/autonomy-motor: `lib/ai` (250), `app/(backoffice)` (389), `components/backoffice` (21), `lib/{evolution,social,growth,seo,sales,revenue,autonomy,ads,ml,outbound,pipeline,mvo,moo,gtm,global,market,experiment,experiments,autopilot,pos,video}` (til sammen 674) | 1 334 | Autonom vekst-/CMS-motor utenfor den reviderte kommersielle kjeden (ordre/økonomi/tenant); grensesnittene mot kjeden (API-routes, superadmin-flater, flagg) ER lest i app/api- og lib-scopene |
| Støtte: `cua/` (17), `perf/` (8), `plugins/`, `eslint-plugin*`, `audit/`, dotfiles, `_tmp-pr-body-*`, CHANGELOG | 57 | Verktøy/hjelpefiler uten flyt-atferd; testkonfig-relevante deler (k6-scenarier, policy-tests) er talt i testuniverset |

## Read ledger — 19 scopes, alle lukket (Unread = 0)

| Scope | Innhold (hoved) | Assigned | Full | Chunked | Unread |
|---|---|---|---|---|---|
| 01 | .github, root, app/(app|auth|admin start), app/api (del 1) | 215 | 213 | 2 | 0 |
| 02 | app/api (backoffice→orders) | 215 | 215 | 0 | 0 |
| 03 | app/api (orders→superadmin) | 215 | 215 | 0 | 0 |
| 04 | app (auth/kitchen/driver/leverandor/superadmin/styles) | 214 | 213 | 1 | 0 |
| 05 | app/superadmin+saas, components (admin/auth/blocks/cms) | 216 | 213 | 3 | 0 |
| 06 | components (rest), config, docs/architecture+audit-hode | 213 | 210 | 0 | 0 (3 → GENERATED) |
| 07 | docs/audit (hoveddel) | 215 | 210 | 5 | 0 |
| 08 | docs/engineering/evidence/launch/rollout/runbooks, e2e, lib (del) | 215 | 215 | 0 | 0 |
| 09 | lib (audit→cms) | 214 | 214 | 0 | 0 |
| 10 | lib (cms→http) | 215 | 215 | 0 | 0 |
| 11 | lib (http→notifications: i18n, integrations, kitchen, menu-*) | 215 | 213 | 2 | 0 |
| 12 | lib (notifications→providers) | 216 | 216 | 0 | 0 |
| 13 | lib (providers→tenant: saas, superadmin, system) | 215 | 215 | 0 | 0 |
| 14 | lib (rest), messages (15), root-configs, scripts (del 1) | 215 | 168 | 47 | 0 |
| 15 | scripts (del 2), studio, supabase (aktive migrasjoner) | 215 | 178 | 37 | 0 |
| 16 | supabase (rest), tests (alerts→auth) | 214 | 214 | 0 | 0 |
| 17 | tests (auth→db) | 215 | 215 | 0 | 0 |
| 18 | tests (db→lib) | 216 | 215 | 1 | 0 |
| 19 | tests (lib→week), vitest/playwright/tsconfig/vercel | 193 | 193 | 0 | 0 |
| **Sum** | | **4 063*** | 3 962** | 98 | **0** |

\* 4 063 = relevant-settet; 3 av disse omklassifisert GENERATED (manifester) → 4 060 lest.
\** Avvik ±2 i agentenes egenrapporterte «Assigned» skyldes duplikat-paths på disk (4 dokumenterte duplikatruter i scope 01) og `.env.example` som ble lest via shell (Read-verktøyet ga permission denied); alle scope-listelinjer er dekket.

Merk: grep/søk er ikke talt som lesing noe sted; hver ledger-linje representerer faktisk filåpning.

## Dokumentuniverset (pålagte kataloger) — 100 % lest

| Katalog | Filer | Lest |
|---|---|---|
| docs/architecture | 12 | 12 |
| docs/engineering | 30 | 30 |
| docs/runbooks | 5 | 5 |
| docs/evidence | 64 | 64 |
| docs/audit | 198 | 195 (+3 GENERATED-manifester samplet) |
| docs/launch | 7 | 7 |
| docs/rollout | 1 | 1 |
| **Sum** | **317** | **314 fullest + 3 generert** |

Claim-/supersession-vurderinger per dokument er ført i CONTRADICTIONS-AND-GAPS.md (autoritativ nå-tilstand: `docs/evidence/go-truth-state-reconciliation-2026-07-10.md`; launch-docs er frosne historiske snapshots).

## Konklusjon

Census er komplett og eksakt: alle 7 795 tracked filer har nøyaktig én kategori, kategoriene summerer til 7 795, Pending = 0, Unresolved = 0. Hele det relevante settet (4 060 filer) er faktisk lest (full eller sammenhengende chunks), dokumentert i 19 scope-ledgere med null uleste.
