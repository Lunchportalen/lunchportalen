# Top-level mapper og rot-filer (`docs/audit/05-top-level-directories.md`)

Vurdering: **Rolle**, **Risiko**, **Viktighet**, **Ryddighet** (subjektiv, teknisk).

## Mapper (alfabetisk utvalg — alle er i manifestet)

| Mappe | Rolle | Risiko | Viktighet | Ryddighet |
|-------|-------|--------|-----------|-----------|
| `app/` | Next.js App Router: sider, layouts, `api/`. | Medium (stor overflate) | **Kritisk** | Strukturert med route groups `(app)`, `(auth)`, `(public)`, `superadmin`, `admin`, osv. |
| `lib/` | Forretningslogikk, auth, Supabase-klienter, domene. | Medium | **Kritisk** | Omfattende; krever disiplinerte importgrenser (`server-only`). |
| `components/` | Delte React-komponenter. | Lav | Høy | Standard for Next-prosjekter. |
| `utils/` | Diverse inkl. `utils/supabase/proxy.ts` (middleware-kritisk). | Medium (edge vs node) | Høy | Liten mappe; viktige filer. |
| `public/` | Statiske assets, brand. | Lav | Høy | Forventet. |
| `supabase/` | Migrasjoner, config. | Medium (schema/RLS) | **Kritisk** | `migrations/` med 153 `.sql` — ser disiplinert ut. |
| `scripts/` | CI, audit, SEO, db-hjelpere. | Lav | Høy | Mange verktøy; dokumenter hva som er obligatorisk i CI. |
| `tests/` | Vitest. | Lav | Høy | Stor dekning mange domener. |
| `e2e/` | Playwright. | Lav | Middels | Støtter release-kvalitet. |
| `docs/` | Dokumentasjon (stor). | Lav | Middels | Mange filer — navigér via `DOCS_OVERVIEW.md` / indekser. |
| `workers/` | Bakgrunnsarbeid (`worker.ts`). | Medium | Middels | Avhengig av drift. |
| `studio/` | Sanity Studio (kilde; vendor under `node_modules` klassifisert generert). | Lav | Middels | ~60 ikke-genererte poster (kilde/config). |
| `.github/` | CI workflows. | Lav | **Kritisk** for merge | Standard. |
| `.git/` | Versjonshistorikk. | — | System | Ikke rediger manuelt. |
| `node_modules/` | Avhengigheter. | Lav (supply chain) | System | Generert; hold låst med `package-lock.json`. |
| `.next/` | Next bygg-output. | — | Cache | Generert. |
| `.vercel/` | Lokal Vercel-metadata. | Lav | Lav | Ofte ignorerbar i git. |
| `archive/` | Arkivert kode. | Lav (forvirring) | Lav | Tydelig navn — unngå import derfra i ny kode. |
| `audit/` | (Egen liten mappe i rot — ikke `docs/audit`) | Lav | Lav | Verifiser formål vs ny `docs/audit/`. |
| `domain/`, `design/`, `infra/`, `k8s/`, `perf/`, `plugins/`, `repo-intelligence/`, `evidence/`, `reports/`, `src/`, `superadmin/` | Støtte, deploy, bevis, eldre/parallell struktur. | Variert | Variert | Noe overlapp mulig med `lib/` og `app/` — se `04` §15. |
| `.cursor/`, `.vscode/`, `.githooks/` | Editor/hooks. | Lav | Lav | OK for team. |
| `.tmp/`, `playwright-report/`, `test-results/` | Midlertidige/rapportutdata. | Lav | Lav | Bør ikke committes som kilde; sjekk `.gitignore`. |

## Rot-filer (kategorisert)

- **Build / config:** `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `postcss.config.cjs`, `tailwind.config.cjs`, `vitest.config.ts`, `playwright.config.ts`, `eslint`-config, `vercel.json`, `Dockerfile`, `instrumentation.ts`, `middleware.ts` — **kritiske**; vurderes som ryddige og sentrale.
- **Dokumentasjon (mange `*.md`):** Styring, sikkerhet, produkt — **høy organisatorisk verdi**, teknisk “støy” i rot hvis ikke lenket fra README/oversikt.
- **Genererte / lokale artefakter:** `tsconfig.tsbuildinfo`, `fullAudit.json`, `dead-files.json`, `queue.json`, `structure.txt`, `typecheck-out.txt`, `*_proof*.log`, `.tmp_*.sql`, `.tmp-dev-*.log` — **middels risiko** for rot eller utilsiktet commit; anbefales holdt utenfor VCS eller i `.gitignore`.
- **Miljø-maler:** `.env.example`, `.env.postdeploy.example` — **navn** dokumentert i `07`; innhold i `.env.example` er kort subsett (ikke full env-kontrakt).
- **Låste policy-filer:** `AGENTS.md` — prosjektets operativstandard (ikke endret i denne revisjonen).

## Samlet vurdering top-level

- **Styrke:** Klar hovedstruktur (`app`, `lib`, `supabase`, `tests`, `scripts`).
- **Forbedringspotensial:** Redusere antall rot-nivå markdown/JSON/logg-filer eller flytte til `docs/` for kognitiv enkelhet.
- **Fragmentering:** Noen satellittmapper (`src/`, `domain/`, `superadmin/` utenfor `app`) kan være historiske — verifiser importkanaler før refaktor (ikke utført nå).
