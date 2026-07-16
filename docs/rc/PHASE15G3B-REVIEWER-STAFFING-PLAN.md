# PHASE 15G.3B — Reviewer staffing & scope plan

**No reviewer names or organizations are invented.**

## Minimum coverage

| Role | Scopes | Filled |
|---|---|---|
| Tax | 21 countries | 0 |
| Legal | 21 countries | 0 |
| Invoice / e-invoice | 21 countries (tax/legal capable) | 0 |
| Privacy | 21 countries | 0 |
| Native localization | 24 locales | 0 |
| Security | 1 global | 0 |
| Product owner | 1 global | 0 |

## Grouping opportunities (explicit assignment still required)

- Nordics (NO/SE/DK/FI) tax — only if one firm’s credential explicitly lists each country
- DACH (DE/AT/CH) legal — same rule
- Benelux (NL/BE) — same rule
- en-GB / en-US / en-CA / en-IE — **separate** native sign-offs (not interchangeable)
- fr-FR / fr-BE / fr-CA / fr-CH — separate native sign-offs
- Privacy: EU/EEA counsel may cover multiple countries with per-country DPA addenda

## Critical path countries

`NO`, `DE`, `FR`, `IT`, `US`, `CA`, `GB`

## Estimated sequence

1. Onboard tax reviewers (critical path first)
2. Onboard legal/privacy (marketplace model)
3. Invoice/e-invoice after tax model path exists
4. Native localization in parallel on frozen RC SHA
5. Live registration/credential verification
6. Security + product owner gates

## Dependencies

- TAX before cutover tax lane
- LEGAL marketplace before invoice issuer assumptions
- E-invoice APPROVED or N/A before Peppol/CTC VERIFIED
- Native per locale before country cutover
- Registration credential approval after authority evidence upload

## Status

**AWAITING_EXTERNAL_REVIEWERS** — all scopes unfilled.
