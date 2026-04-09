# Umbraco parity — gap map

Tabell: **Capability → tilstand → evidens → gap → planlagt tiltak → risiko**

| Capability | Current state | Repo evidence | Gap to Umbraco-parity | Planned build action | Risk |
|------------|---------------|---------------|------------------------|------------------------|------|
| Content tree | Sterk | `/backoffice/content`, tree API | Mer søk/filter som Umbraco | Gradvis: filter/forbedret tree-UX | Lav |
| Document types | Delvis | Postgres page kinds + Sanity `_type` | To systemer — ikke én DT-liste | Dokumentere «dual model»; UI-seksjoner | Medium |
| Data types / property editors | Delvis | Schema-drevet blokkskjema + Sanity schema | Splittet modell | Felles begreper i UI copy + workspace | Medium |
| Block editing | Sterk | Content workspace, block canvas | Mer kontekst-handlinger | Contextual actions (eksisterende mønster) | Lav |
| Templates / variant rendering | Delvis | Varianter i content layer | Ikke Razor — Next render | Paritet via dokumentasjon + preview | Lav |
| Preview | Sterk | Preview routes / workspace | CDN/host quirks | Bevare; dokumenter begrensninger | Lav |
| Publish | Sterk (pages) + Sanity | Publish workflow + CP7 broker | To publish-knapper (Postgres vs Sanity) | Tydelig seksjonering i UI | Medium |
| Schedule / governance | Delvis | Workflow flags; cron | Ikke full Umbraco Scheduler UX | Read-only + routing til runtime der trygt | Medium |
| Version history | Delvis | Page versions / Sanity history | Ikke én tidslinje | Eksponer der det finnes; ikke fake unified | Medium |
| Rollback | Delvis | Recovery panel patterns | Begrenset vs Umbraco | Harden recovery der implementert | Medium |
| Media library | Sterk | `/backoffice/media` + API | Mer bulk/metadata UX | Inkrementelt UX | Lav |
| Media metadata / variants | Delvis | Normalisering + validering | Full DAM-paritet mangler | Dokumentert roadmap | Medium |
| Search / filter in backoffice | Delvis | Per-flate søk | Global backoffice-søk mangler | Vurder senere; ikke ny motor nå | Medium |
| Dashboard / sections | Delvis | Control, domains, runtime | Mer «Umbraco sections» IA | Én nav-struktur (iterativ) | Lav |
| Workspaces | Sterk | Content workspace, week-menu orkestrator | Mer enhetlig workspace chrome | Gjenbruk shell; ingen ny shell | Lav |
| Actions / contextual commands | Sterk | Domain surfaces + lenker | Mer inline actions | Utvid eksisterende kort/CTA | Lav |
| Company/customer/agreement/location | God (read/routing) | `controlPlaneDomainSurfaces`, kundesider | Full «module» uten mutasjon i CMS | Review + routing only | Medium |
| Week/menu publishing from CMS | Sterk etter CP7 | `week-menu`, publish API | Ingen bulk uke-publish i LP | Dokumenter; ev. senere batch | Medium |
| Company admin tower | Routing | `/admin` surfaces | Ikke inne i `/backoffice` | Lenket story fra CMS | Lav |
| Kitchen tower | Routing | Surfaces + `/kitchen` | Operativ RO | Tydelig CMS-inngang | Lav |
| Driver tower | Routing | Surfaces + `/driver` | Operativ RO | Tydelig CMS-inngang | Lav |
| Superadmin tower | Sterk | `/superadmin` + CMS | To flater — samme rolle | CMS som «hub»-fortelling | Lav |
| Social module | LIMITED ofte | `moduleLivePosture`, growth UI | Full live poster | Ikke overlov; ærlig badge | Høy hvis overloves |
| SEO module | Sterk innholdsside | SEO panels, scripts | Integrert med content | Bevare kjeden | Lav |
| ESG module | Read APIs | Backoffice ESG routes | Ikke full rapportmotor i CMS | Read-only + ærlig status | Medium |
| Runtime-status / module posture | Sterk | Strips + badges | Mer konsistent plassering | Iterativ UI | Lav |
| Permissions / role experience | Splittet | Superadmin vs andre roller i egne apps | Ikke én RBAC i CMS | Dokumentert; ikke falsk enhet | Høy hvis blandes |
| Ops/runbook support | Delvis | Docs under `docs/**` | En runbook-hub | `docs/umbraco-parity` + driftsdok | Lav |

**Note:** «Planned build action» prioriterer **UX/IA/dokumentasjon** og **små, trygge** utvidelser — ikke replatforming.
