# CP6 — Module live posture lock

Klassifisering (kode: `MODULE_LIVE_POSTURE_REGISTRY`).

| Modul | Posture |
|-------|---------|
| Operativ uke/meny-orkestrering (CMS) | **LIVE** |
| Redaksjonell weekPlan | **LIMITED** |
| Firma/avtale/lokasjon-flater | **LIVE** (governance + routing) |
| Company admin | **LIVE** |
| Kitchen | **LIVE** |
| Driver | **LIVE** |
| Superadmin | **LIVE** |
| Social kalender (backoffice) | **LIMITED** |
| Social ekstern publish | **DRY_RUN** |
| SEO / vekst | **LIMITED** |
| ESG | **LIMITED** |
| Worker jobs | **STUB** |
| Cron growth/ESG | **INTERNAL_ONLY** |

**UI:** `CmsModuleLivePostureTable` på domener; growth-callout bruker register for **strikkere** visning når ikke bred live.
