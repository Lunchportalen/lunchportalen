# Fil-for-fil-gjennomgang — metode og dekning (`docs/audit/06-file-by-file-review.md`)

## Omfang

Repoet inneholder **172 870** path-poster i manifestet (mapper + filer). En manuell, narrativ beskrivelse av *hver* enkelt fil ville være uegnet for lesbarhet og vedlikehold. Denne revisjonen leverer i stedet:

1. **Full maskinlesbar dekning** — hver path har én post i [`02-file-manifest.json`](./02-file-manifest.json) og [`03-file-manifest.csv`](./03-file-manifest.csv) med feltene `path`, `type`, `extension`, `size`, `topLevelArea`, `classification`, `binaryOrText`, `analyzedLevel`, relasjonsflagg og `notes`.
2. **Eksplistitte path-lister** for alt som **ikke** er klassifisert som `generated_only` (dvs. utenfor `node_modules`, `.git`, `.next`, osv. på ethvert segment i banen):
   - [`parts/06a-paths-root-config.md`](./parts/06a-paths-root-config.md)
   - [`parts/06b-paths-app.md`](./parts/06b-paths-app.md)
   - [`parts/06c-paths-lib-utils-components.md`](./parts/06c-paths-lib-utils-components.md)
   - [`parts/06d-paths-public-scripts-workers.md`](./parts/06d-paths-public-scripts-workers.md)
   - [`parts/06e-paths-supabase-docs-tests-e2e.md`](./parts/06e-paths-supabase-docs-tests-e2e.md)
   - [`parts/06f-paths-studio-misc.md`](./parts/06f-paths-studio-misc.md)
3. **Auth-relaterte filbaner** (heuristikk + manuell kryssjekk): [`parts/auth-related-paths.txt`](./parts/auth-related-paths.txt) — **406** filer (ikke generert).

## Hva «fil-for-fil» betyr her

- For **genererte/vendor/cache/system**-trær: manifestpost = full «gjennomgang» på metadata-nivå; **ingen** plikt til narrativ per fil i Markdown (jf. oppdragskrav).
- For **kildekode og konfigurasjon**: narrativ forklaring av *rolle*, *aktivitet* og *koblinger* ligger i [`04-full-audit-report.md`](./04-full-audit-report.md) (§5–12) og [`07-runtime-build-auth-db-analysis.md`](./07-runtime-build-auth-db-analysis.md), med vekt på auth, API, data og build.
- **Binære filer** (png, woff, pdf, osv.): klassifisert som `binary` / `text_probable` i manifest; innhold ikke lest som tekst.

## Filer som ikke ble lest innholdsmessig

| Kategori | `analyzedLevel` / merknad |
|----------|---------------------------|
| Under `node_modules/`, `.git/`, `.next/`, osv. | `generated_only` |
| `.env`, `.env.local` (hvis tilstede) | `redacted` / `metadata_only` — **ingen verdi utlevert** |
| Meget store enkeltfiler (>500 KB tekst) | `metadata_only` |
| Binære formater | `binary` — ikke tekstlest |

## Anbefaling per livssyklus (generell)

- **Behold:** Alt under `app/` (produktflate), `lib/` (kjerne), `supabase/migrations`, `tests/`, `scripts/ci*`.
- **Dokumenter:** Rot-nivå policy-MD og `docs/` — behold, men lenk fra `README.md`.
- **Fase ut / isoler:** Arkiv (`archive/`), dupliserte strukturer (`src/` vs `app/`) — kun etter eksplisitt produkteierskap; **ikke** utført i denne revisjonen.
- **Overvåk:** Debug-ruter under `app/api/debug/`, `login-debug` — se `08-risk-register.md`.

## Dekningskontroll

Alle paths som finnes på disk under repo-rot ved skannetidspunkt skal finnes i `01-repo-tree-full.txt`. Antall linjer i tree-filen er lik `summary.totalEntries` i JSON. Avvik = **0** ved siste regenerering (se `00-index.md`).
