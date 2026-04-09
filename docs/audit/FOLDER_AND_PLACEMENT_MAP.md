# Folder and placement map (V2)

**Kilde:** Rekursiv kartlegging 2026-03-29, ~4583 filer (ekskl. `node_modules`, `.next`, m.fl.).  
**Sannhet:** Faktisk filtre; ikke eldre audit-dokumenter.

## Toppnivåmapper

| Mappe | Ca. filer | Klassifisering | Kommentar |
|-------|-----------|----------------|-----------|
| `app/` | 1113 | **CANONICAL** | Next App Router: pages, layouts, `api/`. |
| `lib/` | 2052 | **CANONICAL** | Delt forretningslogikk, auth, CMS, AI, billing, m.m. |
| `components/` | 233 | **CANONICAL** + **TRANSITIONAL** | Stor UIflate; overlapper delvis `src/components/` via alias. |
| `src/` | 19 | **TRANSITIONAL** | Hovedsakelig `src/components` — canonical **hvis** `@/components` peker hit først. |
| `docs/` | 313 | **CANONICAL** (dok) | Fase-/hardening-/audit-dokumentasjon. |
| `tests/` | 224 | **CANONICAL** | Vitest. |
| `supabase/` | 162 | **CANONICAL** | Migrasjoner, konfig. |
| `scripts/` | 77 | **CANONICAL** | CI, audit, SEO, verktøy. |
| `public/` | 49 | **CANONICAL** | Statiske assets. |
| `studio/` | 46 | **TRANSITIONAL / LEGACY** | Sanity studio; `tsconfig` ekskluderer `studio/**` fra typecheck. |
| `archive/` | 22 | **ARCHIVE_CANDIDATE** / **LEGACY** | Bevisst arkiv; ikke produksjonssti. |
| `e2e/` | 22 | **CANONICAL** | Playwright. |
| `evidence/` | 118 | **OPS_RISK** / **DOC** | Bevisfiler — ikke runtime. |
| `.github/` | 13 | **CANONICAL** | CI workflows. |
| `workers/` | 1 | **CANONICAL** | `workers/worker.ts` — queue worker entry. |
| `infra/`, `k8s/`, `perf/`, `domain/`, `config/`, `design/`, `plugins/`, `reports/`, `repo-intelligence/` | Lav | **MIX** | Infra/docs/eksperiment — se risiko-register. |
| Rot (`.md` policy/GRC) | 40+ `.md` | **DOC_DRIFT** | Mange enterprise-policyfiler ligger i rot vs `docs/`. |

## Canonical mappestruktur (anbefalt mental modell)

| Område | Canonical plassering |
|--------|----------------------|
| Next routes & API | `app/` |
| Domenelogikk | `lib/` |
| Delte React-komponenter | `components/` **og/eller** `src/components/` (må avklares — alias rekkefølge) |
| Typer | `types/`, `src/types/`, `lib/types/` (flere røtter — se duplikatrapport) |
| DB | `supabase/migrations/`, `lib/types/database.ts` (generert) |
| CMS (runtime i app) | `app/(backoffice)/backoffice/**`, `lib/cms/**` |
| Kontrolltårn UI | `app/superadmin/**`, `app/admin/**`, `app/kitchen/**`, `app/driver/**` |

## Transitional mappestruktur

| Plassering | Hvorfor transitional |
|------------|----------------------|
| `src/components/**` vs `components/**` | `tsconfig` `paths`: `@/components/*` → `src/components` **før** `components` — risiko for skyggelegging. |
| `studio/**` | Eget Sanity-prosjekt; ekskludert fra `tsc`. |
| `app/(backoffice)/**` med stor `_components/`-flate | Modulær omskriving pågår historisk (phase2a–2d docs). |
| `superadmin/` (tom rotmappe observert i telling) | Mulig rest/redirect — verifiser mot faktisk `app/superadmin`. |

## Legacy / archive / orphan

| Plassering | Klassifisering |
|------------|----------------|
| `archive/**` | **LEGACY** — ikke slett uten gjennomgang. |
| `docs/audit/full-system/**` | **HISTORICAL** baseline-rapporter — kan være delvis foreldet. |
| `app/registrering/page.duplicate.tsx` (observert i import-søk) | **ORPHAN** / **NEEDS_REVERIFICATION** — navn antyder duplikat/eksperiment. |

## Filer i «feil» mappe (subjektiv plassering — ikke flytt nå)

| Observasjon | Klassifisering | Anbefaling senere |
|-------------|----------------|-------------------|
| Mange `.md` policy-dokumenter i repo-rot | **DOC_DRIFT** | Flytt til `docs/compliance/` eller `docs/archive/` ved eget vedlikeholds-løp. |
| `evidence/**` med store tekst-/json-filer | **OPS_RISK** | Vurder git-lfs eller ekstern evidence-store for langtid. |
| `components/**` og `src/components/**` med samme filnavn | **DUPLICATE** / **SHADOWED** | Konsolider import-sti én vei (se egen rapport). |

## Filer som skygger andre filer (alias)

Se `COMPONENT_ROOT_AND_ALIAS_REPORT.md` og `DUPLICATE_AND_SHADOW_REPORT.md`.

| Mekanisme | Detalj |
|-----------|--------|
| `@/components/*` | `tsconfig` `paths`: `./src/components/*` **deretter** `./components/*`. |
| `@/lib/*` | `./lib/*` **deretter** `./src/lib/*` (sjeldnere konflikt). |
| `@/types/*` | `./types/*` **deretter** `./src/types/*`. |
