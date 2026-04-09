# ESG — CMS UI / IA (Phase 2D3)

## Canonical surface

- **`/backoffice/esg`** — hovedflate i backoffice (kun **superadmin**, samme som øvrig CMS-shell).
- **Navigasjon:** fane «ESG» i `TopBar` (ved siden av Social / Intelligence).

## Skjermbilder

1. **Innledning (H1)** — én overskrift, rolig beskrivelse av read-only scope.
2. **Kilde og metode** — statisk forklaringsblokk (ikke skjult i docs-only): tabeller, estimat vs snapshot.
3. **Firmavelger** — liste fra `GET /api/backoffice/esg/latest-monthly` (søk på navn/ID); viser operative estimater per rad med tydelig merking.
4. **Detalj for valgt firma** — `GET /api/backoffice/esg/summary`:
   - Årssnapshot + KPI-linje
   - Narrativ fra `buildEsgNarrativeYear` (snapshot-basert tekst)
   - Tabell siste 12 måneder
5. **Lenke** — «Åpne full ESG (superadmin)» → `/superadmin/esg/[companyId]` for PDF/eksport.

## Ikke bygget her

- Egen CMS-side for `company_admin` (bruker fortsatt `/admin/*` og `GET /api/admin/esg/summary` der det finnes UI).
- Duplikat superadmin-dashboard — CMS **lenker** dit i stedet for å kopiere rapportmotorer.
