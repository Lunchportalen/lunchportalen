# CP3 — Domain bridge matrix

**Formål:** Kartlegge gap mellom runtime-sannhet og CMS-kobling; planlagt CP3-tiltak og risiko.

| Domain | Current runtime truth | Current CMS linkage | Gap to enterprise coherence | Planned CP3 action | Risk |
|--------|----------------------|---------------------|----------------------------|-------------------|------|
| Companies / customers | `companies` (Supabase), superadmin firma-flyt | Superadmin UI; CP3: `loadDomainRuntimeOverview` + tabell | Trengte ett CMS-innsyn uten shadow DB | Read-only panel + `/backoffice/domains`, `/backoffice/customers` | Lav — read-only |
| Profiles / users | `profiles`, auth/session | Backoffice Users/Members (eksisterende) | Ikke flyttet til CMS som sannhet | Uendret; lenket via domeneoversikt | Lav hvis uendret |
| Agreements | `agreement_json`, `company_current_agreement` | Superadmin | CMS må vise avtalefelt uten å duplisere | Speiling i panel (tier, notice m.m. fra JSON) | Middels — kun tolkning av JSON |
| Locations | `company_locations` | Superadmin | Telling må synes fra CMS | Aggregert `locationCount` per firma i oversikt | Lav |
| Week visibility | Cron + uke-API policy | Delvis dokumentert | Trenger én forklart kjede | `CmsWeekRuntimeStatusPanel` + week-menu side | Lav–middels |
| Menus / meal types | Sanity `menu`/`menuContent`; meal keys fra avtale | `getMenusByMealTypes`, week-menu tabell | Trenger eksplisitt «kilde»-språk | Samme lesing; UI-tekst | Lav |
| Week plans | Sanity `weekPlan` + egne publish-API | Editorial | Må ikke forveksles med ansatt-sannhet | Merket LIMITED / editorial i statusdata og UI | Middels hvis feil merkes |
| Order runtime | `orders`, API routes | Ikke CMS-sannhet | CMS viser kun aggregat (7d count) | `orders7d` i domain overview | Lav |
| Billing / invoices | Billing engine, superadmin | Superadmin | CMS lenker, muterer ikke | Lenker i control/domener | Lav |
| Company admin tower | `/admin/*` | Egen layout | Trenger narrativ under control plane | Control page + RuntimeDomainLinkCard | Lav |
| Kitchen tower | `/kitchen/*` | Egen | Samme | Samme | Lav |
| Driver tower | `/driver/*` | Egen | Samme | Samme | Lav |
| Superadmin tower | `/superadmin/*` | Egen | Koblet eksplisitt fra CMS | Domener, kunder, lenker | Lav |
| Social | Policy/stub/dry_run | Backoffice social | Ærlig badge | `CONTROL_PLANE_RUNTIME_MODULES` + kort | Lav |
| SEO | Review-first / LIMITED | SEO-growth side | Samme | Samme | Lav |
| ESG | Aggregater / LIMITED | ESG side | Samme | Samme | Lav |
| Media | Backoffice media API | LIVE | OK | Uendret | Lav |
| Content tree | Postgres pages, publish | LIVE | OK | Uendret | Lav |

**Kode referanser:** `lib/cms/backoffice/loadDomainRuntimeOverview.ts`, `lib/cms/controlPlaneRuntimeStatusData.ts`, `components/cms/control-plane/*`.
