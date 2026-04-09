# ESG — flategrenser (Phase 2D3)

| Flate | Synlighet | API | Merknad |
|-------|-----------|-----|---------|
| **CMS / backoffice** | `superadmin` | `GET /api/backoffice/esg/summary`, `GET /api/backoffice/esg/latest-monthly` | Read-only innsikt; lenke til superadmin for PDF/eksport |
| **Superadmin** | `superadmin` | `GET /api/superadmin/esg/*` | Eksisterende sannhets- og rapportflate — **ikke** duplisert logikk i 2D3 |
| **Company admin** | `company_admin` | `GET /api/admin/esg/summary` | Uendret kontrakt; **ingen** ny CMS-mutasjon for firma i 2D3 |
| **Ansatt / uke / onboarding** | — | — | **Ikke** berørt |

**Prinsipp:** Én beregningskjede i DB; flere **les**-porter (admin vs superadmin vs backoffice) som deler `fetchCompanyEsgSnapshotSummary` der det er relevant.
