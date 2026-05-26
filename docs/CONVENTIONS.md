# Dokumentasjonskonvensjoner

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
- **Weekly (TBD Gr 17)**: repo-intelligence refresh + filename convention compliance check

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
