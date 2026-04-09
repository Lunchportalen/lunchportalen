# CP4 — Domain action surfaces

Tabell: kilde, CMS-flate, mutasjonsposture, trygg CP4-aksjon, risiko.

| Domain | Current source of truth | Current CMS surface | Current mutation posture | Safe CP4 action | Risk |
|--------|-------------------------|---------------------|--------------------------|-----------------|------|
| Companies / customers | `companies` (Supabase) | Domains, customers, agreement-runtime | Superadmin | Action-kort + avtale-runtime side (read + lenker) | Lav |
| Agreements | `company_current_agreement`, `agreement_json`, ledger | Agreement-runtime, panel | Superadmin / admin agreement | Routing + schedule-abbr når JSON normaliserer | Lav–middels |
| Locations | `company_locations` | Panel (telling) | Superadmin | Uendret sannhet; tydeligere kort | Lav |
| Menus / meal types | Sanity `menu`/`menuContent` + meal keys fra avtale | `/backoffice/week-menu` | Studio | Publish panel + editorial grense | Lav |
| Week publishing | `GET /api/week` + DB + Sanity | Week-menu | API uendret | Governance UI | Lav |
| Company admin | `/admin/*` | Lenker fra control plane | Company role | Dypere forklaring + action surface | Lav |
| Kitchen | `/kitchen/*` | Lenker | Kitchen role | Samme | Lav |
| Driver | `/driver/*` | Lenker | Driver role | Samme | Lav |
| Superadmin | `/superadmin/*` | Domener, agreement-runtime | Superadmin | Eksplisitt hierarki | Lav |
| Social | Engine + policy | `/backoffice/social` | API begrenset | Konsistent status-språk | Middels |
| SEO | Review-first | `/backoffice/seo-growth` | Batch/editor | Samme | Lav |
| ESG | Aggregater | `/backoffice/esg` | Read-biased | Samme | Lav |

**Kode:** `lib/cms/controlPlaneDomainActionSurfaces.ts`, `CmsDomainActionSurfaceCard`.
