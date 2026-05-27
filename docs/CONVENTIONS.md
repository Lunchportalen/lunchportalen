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
