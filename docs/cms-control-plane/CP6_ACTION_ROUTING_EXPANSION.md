# CP6 — Action routing expansion

| Domain | Source of truth | CMS surface | Posture | Safe CP6 routing | Risk |
|--------|-----------------|-------------|---------|------------------|------|
| Companies | DB | `/backoffice/customers` + kort | superadmin | `whyMatters` + CTA | Lav |
| Agreements | DB/API | `/backoffice/agreement-runtime` | review | admin/superadmin lenker | Lav |
| Locations | DB | Inkludert i kunder/agreement | superadmin | Telling + forklaring | Lav |
| Menus | Sanity | `/backoffice/week-menu` | Studio handoff | Orkestrator + readiness | Lav |
| Week publishing | API+Sanity | `/backoffice/week-menu` | governance | Samme | Lav |
| Company admin | /admin | Surface | runtime | `actionRouting` | Lav |
| Kitchen | /kitchen | Surface | runtime | `actionRouting` | Lav |
| Driver | /driver | Surface | runtime | `actionRouting` | Lav |
| Superadmin | /superadmin | Surface | runtime | `actionRouting` | Middels |
| Social | engine | `/backoffice/social` + callout | policy | DRY_RUN tydelig | Middels |
| SEO | content+SEO | `/backoffice/seo-growth` | review | LIMITED callout | Lav |
| ESG | aggregater | `/backoffice/esg` | read-biased | LIMITED callout | Lav |

**Kode:** `actionRouting.whyMatters`, `CmsDomainActionSurfaceCard`.
