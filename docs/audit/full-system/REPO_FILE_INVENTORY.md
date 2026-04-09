# REPO_FILE_INVENTORY

## Scope

- **Tracked files (git):** **1892** (`git ls-files | Measure-Object`)
- **Tracked TS/JS:** **1504** (extension filter on `git ls-files`)
- **API route modules:** **314** (`git ls-files "app/api/**/route.ts"`)
- **Monorepo:** **Nei** — single `package.json` at repo root (not npm/pnpm workspaces).

**Analysemetode:** Hele treet kartlagt via `git` + målrettede glob/grep. **Alle 1892 filer er ikke linje-for-linje lest**; kjernekontrakter, middleware, auth, CMS-lag, migrasjoner, CI og representative moduler er dybdelest. Sekundær kode er dekket via statisk søk og testtre.

## Toppnivå — filer per hovedmappe (git)

| Mappe / prefix | Count | Rolle |
|----------------|-------|--------|
| `app/` | 624 | Next.js App Router: sider, layouts, **API routes** |
| `lib/` | 558 | Domenelogikk, Supabase, CMS, AI, auth, HTTP, observability |
| `tests/` | 135 | Vitest (unit/integration/smoke) |
| `components/` | 121 | Delt UI |
| `docs/` | 114 | Dokumentasjon (øker med denne auditen) |
| `supabase/` | 73 | Migreringer, konfigurasjon |
| `public/` | 49 | Statiske assets |
| `studio/` | 38 | Sanity-relatert (schema/seed; undermappe `node_modules` lokalt — **ikke** i inventartelling som produktkode) |
| `scripts/` | 36 | CI-guards, audit, SEO, deploy-hjelpere |
| `e2e/` | 22 | Playwright |
| `.github/` | 12 | Workflows |
| `perf/` | 8 | Performance-relatert |
| `src/` | 4 | Spredt kode (f.eks. guards) |
| `domain/` | 3 | Begrenset domenelag |
| `plugins/` | 2 | Plugins |
| Rot — diverse `*.md` | 10+ | Strategi-/sikkerhetsdokumenter |

## Kjerne (produktkritisk)

| Område | Beskrivelse |
|--------|-------------|
| `app/(public)`, `app/(app)`, `app/(auth)` | Forside, uke, onboarding, login |
| `app/admin`, `app/superadmin`, `app/(backoffice)/backoffice` | Admin/superadmin/backoffice |
| `app/api/**` | **314** route handlers — primær backendflate |
| `middleware.ts` | Auth-gate for beskyttede stier; API bypass (unntatt auth-endepunkter) |
| `lib/auth/**`, `app/api/auth/post-login/route.ts` | Post-login resolver, roller (E5 i AGENTS.md) |
| `lib/supabase/**`, `lib/types/database.ts` | DB-klient, genererte typer |
| `supabase/migrations/**` | Schema-sannhet |
| `lib/cms/**`, `app/(backoffice)/backoffice/content/**` | Innholdsmodell, editor, blokker |
| `components/nav/**` | Kanonisk header (AGENTS.md H8) |

## Støtte

| Område | Beskrivelse |
|--------|-------------|
| `scripts/**` | `audit-api-routes.mjs`, `audit-repo.mjs`, `ci:platform-guards`, SEO |
| `.github/workflows/**` | `ci-enterprise.yml`, `ci.yml`, e2e, supabase-migrate |
| `tests/**` | Kvalitetssikring |
| `docs/**` | RC-dokumenter, runbooks |

## Legacy / duplikat / tvilsomt

| Funn | Bevis / merknad |
|------|------------------|
| **Sanity studio duplikat** | `studio/lunchportalen-studio/` med `DEPRECATED.md` — indikerer overlappende/eldre studio-oppsett. |
| **`studio/**/node_modules`** | Lokale avhengigheter under `studio/` (ikke root `package.json` workspace) — **drift- og reproduserbarhetsrisiko** hvis ikke dokumentert ensartet install. |
| **`archive/`** referert i kodebase-søk | `archive/app/(public)/registrering/...` forekom i søk; **0** spor i `git ls-files archive` — enten ignorert eller ikke sporet; **verifiser i arbeidskopi**. |
| **`app/api/something/route.ts`** | Generisk navn + `any` i respons-hjelpere — vedlikehold og sikkerhetsgjennomgang vanskelig (se fil). |
| **Duplikat API-route utenfor `app/`** | `superadmin/system/repairs/run/route.ts` (repo root) **og** `app/api/superadmin/system/repairs/run/route.ts` — samme konsept; root-filen er **ikke** standard App Router-plassering (vedlikeholdsrisiko). |

## Spesielle volumtall

| Metrikk | Verdi | Kilde |
|---------|-------|--------|
| Filer under `lib/ai/` | **295** | `git ls-files lib/ai \| Measure-Object` |
| Linjer `ContentWorkspace.tsx` | **6401** | `Get-Content ... \| Measure-Object -Line` (PowerShell) |

Dette er **direkte mot "moden CMS-arkitektur"**: én klientkomponent på tusenvis av linjer overstiger profesjonell modulær grense (sammenlign Umbraco backoffice som er modulært selv om monolitten er stor).

## Direkte vs indirekte påvirkning

- **Direkte:** Alt i `app/`, `lib/`, `components/`, `middleware.ts`, `supabase/migrations/`, `tests/` som importeres fra produksjonsflyt.
- **Indirekte:** `docs/`, `scripts/` (bygger kvalitet), `.github/` (deploy-gates), `studio/` (innholdsseed/schema hvis brukt).

## Analyserte filer — tall som skal rapporteres

- **Repositoryomfang:** **1892** sporede filer.
- **Primær kodebase (TS/JS):** **1504** filer.
- **Dyp analyse (lest/verifisert i detalj):** ~**50–80** filer inkl. `package.json`, `middleware.ts`, `next.config.ts`, `post-login`, migrasjoner, CI-workflow, representative API-ruter, `lib/cms/blocks/blockContracts.ts`, `lib/sanity/client.ts`, nøkkeltester — pluss **aggregerte** resultater fra grep på hele treet.

**Konklusjon på inventar:** Produktet er et **enkelt Next.js-repo med ekstremt stor flate** (300+ API-ruter, 295 `lib/ai`-filer, 6k+ linjer i én editorfil). Dette er **strukturell risiko**, ikke bare "mange features".
