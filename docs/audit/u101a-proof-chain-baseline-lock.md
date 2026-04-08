# U101A — Proof chain policy + baseline lock (inventory)

**Dato:** 2026-04-08  
**Formål:** Første faktiske pakke — definere proof/baseline-sannhet og kartlegge dagens tilstand. Ingen produktendringer.

## Kommandoer kjørt (Windows / PowerShell)

| Kommando | Resultat |
|----------|----------|
| `git status --short` | **~2336 linjer** — massiv dirty working tree (ikke audit-baseline) |
| `git diff --name-only` | Svært mange filer (diff mot index) — se git for full liste |
| `git rev-parse HEAD` | `a809362e296b80459c1adc2ae5932aeb1cb9b82f` (referanse ved kjøring; **ikke** baseline pga. dirty tree) |
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run test:run` | **PASS** — 359 testfiler passert, 4 skipped; 1599 tester passert, 13 skipped |
| Filinventar `artifacts/**` | PowerShell `Get-ChildItem -Recurse` (ekvivalent med `find`) |

**Merk:** `typecheck` / `test:run` på denne maskinen beviser kun **nå**-tilstand med dirty tree — erstatter ikke E4-proof eller ren-baseline.

## Proof inventory (artifacts per mappe)

Antall rasterfiler (png/jpg/jpeg/webp) per undermappe under `artifacts/`:

| Mappe | Binære bilder | Manifest / gates / json | Merknad |
|-------|-----------------|-------------------------|---------|
| u72-block-editor-visual | 0 | 0 | **Tom mappe** |
| u81-block-editor-visual | 11 | — | Skjermbilder |
| u85-property-editor-proof | 0 | 0 | **Tom mappe** |
| u86-property-editor-runtime-proof | 11 | logger | Konsistent |
| u88–u93 (diverse) | >0 | json/txt | Skjermbilder + manifest-lignende JSON |
| u91-block-entry-model-proof | 0 | `.gitkeep` | **Ingen proof** |
| u94-data-type-config-proof | 0 | 0 | **Tom mappe** |
| u95-data-types-workspace-proof | 0 | `README.md` | **README lister 12 PNG — ingen filer** |
| u95b-data-types-workspace-runtime-proof | 17 | RUNTIME-PROOF-MANIFEST.json | Full pakke |
| u96-content-types-element-types-proof | 0 | `.gitkeep` | **Ingen proof** |
| u96b-content-types-element-types-runtime-proof | 16 | manifest | Full pakke |
| u97b–u97e | 7–9 | — | Skjermbilder |
| u97f-content-tree-create-sync-proof | 0 | `.gitkeep` | **Ingen proof** |
| u97g, u97i, u98b, u98c | 13 + gates + manifest | `proof-manifest.json` m.m. | **Sterkeste “chain lock”-pakker** — manifest med `runStartedAt`, sha256 per bilde |

**u97i** (`runStartedAt` 2026-04-08T15:42Z) og **u98c** (`runStartedAt` 2026-04-08T19:28Z) er **forskjellige** runs — forskjellig baseUrl/port og hypoteser; skal ikke blandes som én proof uten eksplisitt dokumentasjon.

## e2e og scripts (referanse, ikke endret)

- `e2e/**`: 44 filer (playwright-spesifikasjoner + helpers + `fixtures/media-sample.png`).
- `package.json`: `e2e`, `e2e:ui`, `test:run`, `build:enterprise`, `sanity:live`, `ci:enterprise`, `push:ok` (sjekker porcelen ved git clean).

## Policier (kanonisk)

Se:

- `docs/audit/policies/canonical-proof-policy.md`
- `docs/audit/policies/audit-baseline-policy.md`

## Oppfølging (U101B)

Kanonsk baseline-sannhet etter kartlegging: [`u101b-baseline-freeze-record.md`](./u101b-baseline-freeze-record.md).
