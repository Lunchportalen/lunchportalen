# FULL REPO AUDIT V2 — Execution log

**Dato:** 2026-03-29  
**Metode:** Rekursiv filskanning (Node `fs`, ekskl. `node_modules`, `.next`, `dist`, `coverage`, `.git`), `rg`/verktøy-søk, lesing av `tsconfig.json`, `vercel.json`, `middleware.ts`, `workers/worker.ts`, `package.json`, stikkprøver i `lib/http/routeGuard.ts`, `app/api/something/route.ts`, `docs/hardening/RESOLVED_BASELINE_ITEMS.md`.  
**Kodebase som sannhet:** Filer i working tree; eldre rapporter brukt som referanse der spesifisert.

## Kommandoer kjørt (lokal)

| Kommando | Exit | Merknad |
|----------|------|---------|
| `npm run typecheck` | 0 | `tsc --noEmit` OK |
| `npm run build:enterprise` | 0 | Inkl. `agents:check`, `ci:platform-guards`, `audit:api`, `audit:repo`, Next build, `seo-proof`, `seo-audit`, `seo-content-lint` — alle rapporterte OK i logg |
| `npm run test:run` | 0 | Vitest: **212** testfiler, **1191** tester pass |

## Telle-skript (bevis)

- **Totalt antall filer** (rekursivt, ekskl. over): **4583** (kjørt 2026-03-29).
- **Toppnivå filtelling** (filer under hver rotmappe, samme ekskludering): `lib` 2052, `app` 1113, `docs` 313, `components` 233, `tests` 224, `supabase` 162, `evidence` 118, `scripts` 77, `public` 49, `studio` 46, `archive` 22, `e2e` 22, `src` 19, `.github` 13, `repo-intelligence` 13, `.vercel` 9, `perf` 8, `.tmp` 4, øvrige små.
- **Duplikat filnavn** (samme basename, flere stier): **246** unike navn med kollisjon; `route.ts` forekommer **571** stier (forventet i Next App Router API/backoffice-struktur).

## Begrensninger

- Ingen full statisk «brukt/ubrukt»-analyse av alle eksporter (ville kreve custom bundle-graph / ts-prune på hele monolitten).
- `studio/**` og `archive/**` er ekskludert fra `tsconfig` `exclude` — de er fortsatt **fysiske** deler av repo; klassifisert separat.
- Skjulte filer under rot ble delvis telt; node-skriptet hoppet over visse rot-`.` mapper bevisst for hastighet — tellinger er **nedre gren** for logikk-filer.

## Referanser til vedlegg

Se `FULL_REPO_AUDIT_V2.md` vedlegg B for korrelasjon mellom funn og filstier.
