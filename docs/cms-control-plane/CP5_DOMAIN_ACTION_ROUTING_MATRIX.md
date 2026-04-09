# CP5 — Domain action routing matrix

| Domain | Current source of truth | Current CMS surface | Current mutation posture | Safe CP5 action-routing | Risk |
|--------|-------------------------|---------------------|--------------------------|-------------------------|------|
| Companies / customers | `companies`, `company_locations` | `/backoffice/customers` | Superadmin | `actionRouting` + CTA til superadmin | Lav |
| Agreements | Avtale DB + `agreement_json` | `/backoffice/agreement-runtime` | Admin/superadmin API | Routing til `/admin/agreement` + superadmin | Lav–middels |
| Locations | `company_locations` | Kunder/agreement-runtime | Superadmin | Telling + lenke | Lav |
| Menus / meal types | Sanity menu/menuContent | `/backoffice/week-menu` | Studio | Numnerert publish-kjede + Studio-lenke | Lav |
| Week publishing | `/api/week` + avtale + Sanity | `/backoffice/week-menu` | API uendret | Eksplisitt kjede i UI | Lav |
| Company admin | `/admin/*` | Action surface | company_admin | `actionRouting` «påvirker eget selskap» | Lav |
| Kitchen | `/kitchen/*` | Action surface | kitchen | Kontekst: produksjon | Lav |
| Driver | `/driver/*` | Action surface | driver | Kontekst: leveranse | Lav |
| Superadmin | `/superadmin/*` | Action surface | superadmin | Kontekst: plattform | Middels (rolle) |
| Social | Engine + policy | `/backoffice/social` + callout | policy | Callout + DRY_RUN | Middels |
| SEO | SEO + content | `/backoffice/seo-growth` + callout | review | Callout + LIMITED | Lav |
| ESG | Aggregater | `/backoffice/esg` + callout | read-biased | Callout + LIMITED | Lav |

**Kode:** `lib/cms/controlPlaneDomainActionSurfaces.ts` (`actionRouting`).
