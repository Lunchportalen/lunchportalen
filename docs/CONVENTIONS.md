# Dokumentasjonskonvensjoner

Repository layout (Next.js + Umbraco monorepo, deploy targets, data stores): [architecture/monorepo.md](./architecture/monorepo.md).

## Filnavn

### Hovedregel: kebab-case

Alle dokumentasjonsfiler bruker kebab-case — små bokstaver, bindestrek mellom ord, ingen underscores eller store bokstaver.

Eksempler:

- threat-model.md ✓
- statement-of-applicability.md ✓
- THREAT_MODEL.md ✗
- StatementOfApplicability.md ✗

### Unntak (UPPERCASE bevart)

Industri-konvensjoner forblir UPPERCASE:

- README.md (hub-index for kataloger)
- CHANGELOG.md (release-history)
- LICENSE.md (lisens-tekst)
- CONTRIBUTING.md (bidrag-veiledning)
- AGENTS.md, AGENTS_TLDR.md (LLM-agent-instruks)

### Audit-record immutability

Filer i følgende kataloger er historiske records og skal IKKE renames selv om de inneholder UPPERCASE-referanser:

- docs/audit/
- docs/repo-audit/
- docs/strategy/full-repo-audit-*
- docs/strategy/phase2-*

Disse bevarer revisjonshistorikk og audit-trail for DD-prosesser.

### Auto-genererte filer (Umbraco backoffice-eksport)

docs/umbraco-parity/ inneholder auto-genererte filer fra Umbraco backoffice-eksport. Filnavnene følger Umbraco content-type-ID-konvensjon (UPPERCASE_SNAKE) og skal IKKE manuelt renames. Regenerasjon via Umbraco-eksport overskriver.

## artifacts/ — gitignored proof bank

Repository-root `artifacts/` er et gitignored lokalt bevislager (PNG/JSON/gate-logs) for utviklerverifikasjon. Konvensjon:

- **Ikke committet**: Per `.gitignore` linje 113. Filer her er ikke del av repo eller DD-deliverable direkte.
- **Naming**: u{NN}-{beskrivelse}-proof/ for proof-bundles (eksempel: u97-binding-disposition-proof/).
- **Referansier**: Audit-record (docs/audit/, docs/repo-audit/) kan henvise til artifacts/-bundles som evidens-referanse. Slike refs er ikke markdown-lenker (gitignored target) og er ekskludert fra check:links-validering.
- **Reorganisering**: Subkatalog-struktur (cms-proof/, gate-logs/) kan vurderes i fremtidig sprint hvis artifacts/-volum vokser over 50 MB.

Status (2026-05-26): 315 filer i 23 proof-bundles, ~29 MB lokalt.

## Generated JSON artifacts

Tracked JSON-filer som er output fra audit-scripts (`scripts/audit/*.json`, `repo-intelligence/*.json`, og lignende) skal være deterministisk og matche generating script-output på samme codebase.

### Krav

- **Stabile keys**: `Object.keys().sort()` før `JSON.stringify`, eller rekursiv `sortKeys()`-helper for nested structures
- **Stabile arrays**: Sortér by konsistent key der order ikke er semantisk meningsfull (path-strenger, IDer)
- **Ingen timestamps**: Ingen `Date.now()`, `new Date().toISOString()`, eller `process.uptime()` i committed output. Generation-tid hører i CI-metadata eller commit-message, ikke i artifact-innhold
- **Ingen random**: Ingen `Math.random()`, `crypto.randomUUID()` i output
- **Trailing newline**: Skriv med `\n` på slutten (POSIX-konvensjon)

### Verifikasjon

- **Pre-merge**: Re-generering skal produsere 0-diff mot committed file
- **CI**: `.github/workflows/weekly-repo-intelligence-refresh.yml` kjører hver søndag 03:00 UTC (+ `workflow_dispatch`). Workflow regenererer cron-scope artifacts, verifiserer V.20 determinisme (2× re-run, diff = 0), kjører `npm run check:links`, og oppretter auto-PR med label `automated-refresh` hvis diff

### Shared helper

Bruk `scripts/audit/lib/stable-json.mjs` (`sortKeys`, `stableStringify`, `writeStableJson`) for all committed JSON-generering. Call-sites:

- `scripts/audit/lib-ai-keep-closure.mjs` → `scripts/audit/lib-ai-keep-closure.json`
- `scripts/audit/extract-code-rpc-refs.mjs` → `scripts/audit/k4-code-rpc-refs.json`
- `scripts/scanRepo.ts` → `repo-intelligence/{meta,repo-map,routes,api-map,db-map,flows,dependencies,errors}.json`

Cron-scope ekskluderer append-only logs (`evolution-log.json`, `run-log.json`) og autonomous pipeline-output (`auditReport.json`, `tasks.json`).

### Eksempel: deterministic write

```javascript
import { writeStableJson } from './lib/stable-json.mjs';

writeStableJson(outputPath, data);
```

### Date-suffix policy

Versjonerte audit-docs bruker ISO-dato-suffix:

- full-repo-audit-2026-05-25.md ✓
- phase2-cut-list-2026-05-26.md ✓

Current/live hub-docs uten dato:

- threat-model.md
- statement-of-applicability.md

## Hub-katalog struktur

Repository docs/ er organisert i 6 hub-er:

- docs/governance/ — beslutningstaking, codex-policies, prosesser
- docs/security/ — sikkerhetspolicy, threat-modeling, runbooks
- docs/compliance/ — SOC2/ISO27001/GDPR matriser
- docs/strategy/ — forretningsstrategi, audits, frameworks
- docs/engineering/ — utvikler-onboarding, tekniske briefs
- docs/sales/ — RFP-templates, salgsmaterial

Hver hub har egen README.md som index.

## Enforcement

- **Pre-merge**: `npm run check:links` verifiserer at alle relative .md-lenker peker på eksisterende filer (etablert E.1, scaffold i scripts/check-doc-links.mjs)
- **Weekly**: `.github/workflows/weekly-repo-intelligence-refresh.yml` — repo-intelligence + audit JSON refresh med auto-PR ved drift

## Week visual computed-style gates (V.W*)

Screenshot diff alene fanger ikke radius/border-token endringer (lav kontrast i pixel-diff). CI Week Visual kjører derfor **computed-style-prober** før screenshot-steg.

| Gate | Probe | Assert | Config |
|---|---|---|---|
| **V.W2** — row radius | `e2e/week-row-radius-probe.e2e.ts` | `.ds-week-surface--row` `border-radius` = **22px** (`--ds-radius-md`) | `playwright.week-row-probe.config.ts` |
| **V.W3** — slot surface | `e2e/week-slot-probe.e2e.ts` | Resting `.ds-week-surface--slot` radius = **14px** (`--ds-radius-sm`); valgt slot `border-top-color` = **`#f5c518`** (`--ds-accent`, is-ordered-gull på `/week`); bg = `--ds-accent-soft`; `aria-pressed="true"`; sibling reference i samme stacking context | `playwright.week-row-probe.config.ts` |
| **V.W4** — chip surface | `e2e/week-chip-probe.e2e.ts` | Allergen readonly `.ds-week-surface--chip` radius = **999px** (`--ds-radius-pill`); bg = **`rgb(238, 233, 223)`** (`--ds-bg-soft`); color = **`rgb(95, 95, 95)`** (`--ds-text-soft`); **`font-size` = 15px** (`--ds-body-sm` — skiller seg fra tier-pill **10px**) | `playwright.week-row-probe.config.ts` |
| **V.W5** — motion | `e2e/week-motion-probe.e2e.ts` | **no-preference:** slot `transition-duration` = **0.18s**, `transition-timing-function` = **`cubic-bezier(0.22, 0.61, 0.36, 1)`** (`--ds-ease`); `transition-property` dekker **border-color** og **background**; row `transform` **0.18s** `--ds-ease`. **reduce:** slot + row `transitionProperty` = **`none`** (assert: `property === "none"` + `duration < 0.001s` — headless Chrome rapporterer **`1e-05s`**, ikke `0s`) | `playwright.week-row-probe.config.ts` |
| **V.W6** — lifecycle state | `e2e/week-state-probe.e2e.ts` | Kalender: **locked** pill `opacity` ≈ **0.5**, `cursor: not-allowed`, clock-markør + `data-lp-lifecycle=locked`; **ordered** ✓-markør; **unavailable** em-dash-markør (≠ locked). Slot: **locked** `is-locked`, `aria-disabled=true`, opacity ≈ **0.5**, tekstlabel «Frist passert»; **unavailable** `is-unavailable`, opacity **> 0.85**, stiplet ramme, label «Ikke tilgjengelig». **Perceivable:** synlig markør/label `getBoundingClientRect().height` **> 0**, ikke `display:none` / `visibility:hidden` (aldri `sr-only`) | `playwright.week-row-probe.config.ts` |
| **V.W7** — ordered collapse | `e2e/week-collapse-probe.e2e.ts` | **Editable (før cutoff):** sammendrag inneholder retten; «Endre» + `aria-expanded` **false→true**; ≥1 slot **ikke** `aria-disabled`. **Locked (etter cutoff):** `endreCount` **0** + ingen `getByRole("button", {name:/endre bestilling/i})`; **pickerGate** (picker hidden/absent, ingen edit, ingen `aria-controls`, 0 synlige slot-kontroller i kollaps); synlig locked-notis **«Frist passert»** (én gang) med **height > 0** (aldri `sr-only`). Locked **uten** ordre + slots → V.W6 (`WEEK_STATE_PROBE_LOCKED_SLOTS`) | `playwright.week-row-probe.config.ts` |
| **V.W8** — icon consolidation | `e2e/week-icon-probe.e2e.ts` | **Blokkerende (synkront):** kalender **locked / ordered / unavailable** `.ds-week-icon` — alle tre **samme resolved px**; `currentColor`; `aria-hidden="true"`; markør `font-size` **12px**; `getBoundingClientRect().height` **> 0**; **5.4-vakt** (`::after` ✓ 22×22px). **NON-BLOCKING observasjon:** slot-klokke (`week-category-card__state-icon`) — `try/catch`, logg `treatmentsMatch` i `WEEK_ICON_PROBE` når lesbar; **aldri** gate. **Hvorfor:** appen reverterer låst-dag-valg (CUTOFF) → Mon-tap/`expect.poll` var racy i full-suite; **V.W6** dekker slot-klokke separat | `playwright.week-row-probe.config.ts` |

- **CI-steg:** `.github/workflows/ci-week-visual.yml` → «STEG 5.3–8 surface computed-style probes (row + slot + chip + motion + state + collapse + icon)» — må passere **før** screenshot diff. **Full-suite determinisme:** samme config, **3×** sekvensiell kjøring (`FULL_SUITE_PROBE_DETERMINISM.json`, `allPass: true`).
- **Logg-prefix:** `WEEK_ROW_RADIUS_PROBE`, `WEEK_SLOT_PROBE`, `WEEK_CHIP_PROBE`, `WEEK_MOTION_PROBE_NO_PREFERENCE`, `WEEK_MOTION_PROBE_REDUCE`, `WEEK_STATE_PROBE`, `WEEK_STATE_PROBE_LOCKED_SLOTS`, `WEEK_STATE_PROBE_UNAVAILABLE_SLOT`, `WEEK_STATE_PROBE_UNAVAILABLE_DAY`, `WEEK_COLLAPSE_PROBE_EDITABLE`, `WEEK_COLLAPSE_PROBE_LOCKED`, `WEEK_ICON_PROBE` (JSON i CI-logg / `_8-review-surface`).
- **Screenshot baseline:** Linux Docker only — se [e2e/week-visual-regression.md](./e2e/week-visual-regression.md). **Dato-pin (STEG 8):** allergen collapsed-snapshots pinnet **`2026-06-04`** (`WEEK_VISUAL_ALLERGEN_PINNED_OSLO_DATE` + Playwright-klokke); day-selected / ordered bruker eksplisitt **`2026-06-02`** — begge deterministiske (unifisering valgfri senere).

## Endring av konvensjon

Endringer i denne konvensjonen krever PR med eksplisitt godkjenning. Backwards-incompatible endringer (f.eks. UPPERCASE → kebab på allerede stable docs) krever:

1. Separat rename-PR per katalog
2. Ref-update for alle live cross-doc-refs
3. Audit-record forblir uendret (per immutability-regel)
4. V.14 case-collision verifikasjon (Windows/macOS case-insensitive)

## Eksempler — naming review

| Korrekt | Feil | Begrunnelse |
|---|---|---|
| threat-model.md | THREAT_MODEL.md | hub-doc, kebab-case |
| README.md | readme.md | hub-index, UPPERCASE unntak |
| full-repo-audit-2026-05-25.md | FullRepoAudit2026.md | versjonert audit, dato-suffix |
| audit-coverage.md | AUDIT_COVERAGE.md | hub-doc, kebab-case |
| docs/audit/parts/06f-paths.md | (eksisterende UPPERCASE OK) | audit-record immutability |
| docs/umbraco-parity/CONTENT_TYPE.md | (do not rename) | auto-generert |
