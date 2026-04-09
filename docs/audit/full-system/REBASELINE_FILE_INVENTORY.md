# Rebaseline — filinventar og repo-kart

**Dato:** 2026-03-27  
**Metode:** `git ls-files`, `glob`/`Get-ChildItem`, stikkprøver i kritiske mapper, sammenligning med tidligere audit-dokumenter.

## Toppnivå (faktisk struktur)

| Område | Rolle |
|--------|--------|
| `app/` | Next.js App Router — offentlige sider, backoffice, admin, superadmin, API-ruter (`app/api/**/route.ts`). |
| `components/` | Delt UI — nav/header, mønstre på tvers av roller. |
| `lib/` | Forretningslogikk, HTTP-hjelpere, CMS, AI, ordre, observability, m.m. |
| `src/` | Eldre/parallell struktur (guards, noen typer) — importet fra app/lib. |
| `supabase/` | Migreringer, seed, konfigurasjon. |
| `studio/` | Sanity Studio; `studio/lunchportalen-studio/` markert deprecated (se `DEPRECATED.md`). |
| `tests/` | Vitest — API, RLS, CMS, auth, sikkerhet. |
| `e2e/` | Playwright (ikke kjørt i denne rebaseline-runden). |
| `scripts/` | CI-gates, SEO, agenter, audit, verktøy. |
| `.github/workflows/` | `ci-enterprise.yml`, `ci.yml`, m.fl. |
| `docs/` | Audit, RC-dokumentasjon, runbooks. |

## Tellinger (kilde: **git** der annet ikke er sagt)

| Metrikk | Verdi | Kommentar |
|---------|-------|-----------|
| Sporede filer totalt (`git ls-files`) | **1892** | |
| Sporede `*.ts` + `*.tsx` | **1470** | Primær «analysert» populasjon for TypeScript-økosystemet. |
| `app/api/**/route.ts` (git) | **314** | Versjonskontrollert APIflate. |
| `app/api/**/route.ts` (disk, denne WS) | **557** | **Avvik:** mange `route.ts` finnes på disk men er **ikke** sporet i git i denne kopien — se `REBASELINE_COMMANDS_AND_RESULTS.md`. |
| `lib/ai/**/*.ts` (git) | **295** | |
| `lib/ai/**/*.ts` (disk, denne WS) | **698** | **Avvik:** tilsvarer ikke git — behandle som lokal/utvidet arbeidsflate til status er ren. |
| `ContentWorkspace.tsx` linjer (`Measure-Object -Line`) | **6401** | Fortsatt én dominerende fil; POST_IMPLEMENTATION_REVIEW nevnte 6724 etter FASE 15 — avvik kan skyldes målemetode/branch. **Verifisert nå:** ~6401 linjer. |

## Kjerne / støtte / legacy / duplikat

### Kjerne (inntekt & drift)

- Ordre, uke, kjøkken, sjåfør, onboarding — `app/orders`, `app/kitchen`, `app/driver`, `app/week`, `lib/orders`, `lib/kitchen`, relaterte API-ruter.
- Tenant-isolasjon — `profiles.company_id`, RLS-tester under `tests/rls/`, `tests/tenant-isolation*.test.ts`.

### Backoffice / CMS

- `app/(backoffice)/backoffice/content/` — `ContentWorkspace.tsx` + uttrukne moduler (`contentWorkspace.*.ts`, `useContentWorkspace*.ts`, `_workspace/`, `_tree/`).
- Kanonisk render/preview-kjede dokumentert i `POST_IMPLEMENTATION_REVIEW.md` — `lib/cms/public/renderPipeline.ts`, `PreviewCanvas.tsx`, `renderBlock`.

### Støtte

- `lib/http/respond.ts` — JSON-kontrakt `{ ok, rid, ... }`.
- `scripts/ci/*` — plattformvakter (`api:contract`, `cms:check`, `ai:check`, m.m.).

### Legacy / teknisk gjeld

- `studio/lunchportalen-studio/` — DEPRECATED i favør av `studio/`.
- `next lint` deprecation-melding (migrasjon til ESLint CLI for Next 16).

### Duplikat (tidligere funn)

- **Duplikat `superadmin/.../repairs/run` utenfor `app/api`:** **Ikke funnet** i nåværende tre — kun `app/api/superadmin/system/repairs/*/route.ts`. Status: **RESOLVED** (tidligere risiko R2).

## Analyserte filer (estimat)

- **Full linje-for-linje:** ikke 1892 filer — urealistisk i én økt.
- **Dekket:** (1) alle obligatoriske gate-scripts via kjøring; (2) representative og kritiske filer fra audit-historikk + brukerens spesialfokus (`ContentWorkspace`, preview, API-kontrakt, `lib/ai`-omfang, auth); (3) automatisk statistikk (`grep`, glob, linjetelling).
- **Rapportert «analysert populasjon»:** **1470** TS/TSX-filer som **definisjon av kodebasens hovedmengde**; dyp gjennomgang **~120–200 filers** ekvivalent via verktøy + manuelle stikkprøver (ikke teller hver fil individuelt).

## Ansvar per sentral filgruppe

| Gruppe | Ansvar |
|--------|--------|
| `ContentWorkspace.tsx` + hooks | Editor-skal, preview-props, modal-stack, orkestrering; mye state fortsatt her. |
| `useContentWorkspaceData.ts` | Liste/detalj/rute/sync — «én sannhet» for dataflyt (per IMPLEMENTATION_LOG). |
| `useContentWorkspacePersistence.ts` | Save/publish/outbox/konflikt — transportert ut av monolitten. |
| `app/api/**/route.ts` | HTTPflate; enterprise-kontrakt håndheves av `api-contract-enforcer.mjs`. |
| `lib/cms/**` | Blokker, parse, render, offentlig pipeline. |
| `lib/ai/**` | Stor parallellflate — governance sjekkes av `ai-governance-check` (63 filer i siste build-logg — **merknad:** sjekken skanner et delsett / mønstre, ikke nødvendigvis alle 698 diskfiler). |
| `middleware.ts` / `app/api/auth/post-login` | Auth entry og landing — frozen mønstre per AGENTS.md. |
