# CMS Control Plane — Domain map

**Dato:** 2026-03-29

## Tabell

| Domain | Current source of truth | Current surface | CMS linkage today | Desired CMS linkage | Risk |
|--------|-------------------------|-----------------|-------------------|---------------------|------|
| **Companies / customers** | Supabase `companies`, superadmin/admin APIs | `/superadmin/companies`, `/admin/*` | Indirekte via content helpers (`lib/cms/backoffice/getSuperadminCompaniesContent.ts`), ikke én CMS-tenant-tree | **Read-heavy control plane:** innsyn, lenker til relatert innhold/media, statuskort i backoffice-kontekst uten ny DB-sannhet | Fragmentert IA hvis ikke eksplisitt |
| **Profiles / users** | Supabase `profiles`, auth metadata | Admin employee lists, invites | Ingen direkte CMS-eierskap | **Review-only / linking** fra CMS til «hvem redigerer» der relevant; auth forblir runtime | Rolle-lekkasje hvis klient-styrt redirect |
| **Agreements** | `company_current_agreement`, agreement JSON/RPC | Onboarding, admin agreement API, order window | Meny/tier konsumeres i ordre-vindu via avtale + Sanity menu | **CMS viser avtale-nøkler** (tier, dager) som *read* fra server helpers + tydelig «runtime låst» | Dobbel avtale-sannhet hvis CMS lagrer parallelt |
| **Locations** | Supabase `locations` m.m. | Admin, orders scoped by `location_id` | Delvis i product/surface maps | **Kontekst i CMS** (scope labels) uten å erstatte DB | Scope-feil ved feil filter |
| **Week visibility** | `lib/week/availability.ts`, `GET /api/week`, `order/window` | Employee week UI | Regler i kode, ikke CMS-tekst som sannhet | **CMS:** publiserings-/kommunikasjonslag (copy) + dokumentert tidsregel i drift — **ikke** erstatte algoritme | Forveksling hvis marketing sier annet enn kode |
| **Menus / meal types** | Sanity `menu` / meal type docs + `lib/cms/getMenusByMealTypes.ts` | Kitchen/marketing, `GET /api/week` | Sterk CMS/Sanity-kobling | **Én redaksjonell pipeline** fra backoffice/Studio til publisert meny som runtime leser | Desynk mot `weekPlan` editorial |
| **Week plans** | Sanity `weekPlan` (editorial); **deprecated** for employee runtime | Studio, `app/api/weekplan/publish`, cron lock | Redaksjonell publish (superadmin API) | **Eksplisitt:** editorial vs operational labels i UI | To «uke»-fortellinger uten doc |
| **Order runtime** | Supabase orders, idempotent APIs | `/api/orders/**`, employee flows | Ingen CMS direkte | **Read-only speil** / deep links fra CMS rapporter — **ikke** CMS-mutasjon | Ordre i CMS = kritisk feil |
| **Billing / invoices** | `lib/billing/**`, cron, Tripletex/Stripe der konfigurert | Superadmin, cron | Ingen CMS | **Read-only dashboards** eller lenke ut — faktura-motor forblir runtime | Hybrid økonomi forvirrer uten doc |
| **Company admin tower** | `app/admin/**`, server layouts | HeaderShell pattern | Ikke under `(backoffice)` | **Narrativ:** «operativ tårn» med lenke til CMS content der relevant | To visuelle verdener uten bro |
| **Kitchen tower** | `app/kitchen/**`, kitchen APIs | Read-only produksjon | Menyer fra CMS/Sanity | Samme meny-kjede som runtime | Feil kilde → feil porsjoner |
| **Driver tower** | `app/driver/**` | Stops, mobile | Ingen CMS | **Operational only**; CMS kun for **kommunikasjon** (content) | — |
| **Superadmin tower** | `app/superadmin/**` | System, growth, companies | Krysser growth + CMS routes | **Hub** som lister modulstatus og peker til backoffice | Stor flate = gate-risiko |
| **Content tree** | Postgres content pages + tree API | Backoffice content | **Canonical** | Forbedret IA, ikke ny backend | — |
| **Media** | Backoffice media API + refs | Library | **Canonical** | Design scopes / publish pipeline | — |
| **Social** | DB + executor (`lib/social/**`) | Superadmin/backoffice | Delvis | Modul under CMS med **DRY_RUN** ærlighet | Overlovet forventning |
| **SEO** | Scripts + CMS panel + variant body | Growth, editor | Transitional | Én fortelling: publish før «live SEO» | Batch vs editor forvirring |
| **ESG** | Supabase aggregates + cron | Admin/superadmin/backoffice | Flere yter | **Én modul-fortelling** + readonly trust | Duplikat API-yte |
| **Cron / worker / snapshots** | `app/api/cron/**`, `workers/worker.ts` | Server-only | Ingen CMS-styring av ordre | **Observability** + runbook; stubs dokumentert | Stubs antatt prod |

---

## Merknad

«Desired CMS linkage» betyr **kontrollflate, innsyn, publisering og review** — ikke automatisk at CMS skal **eie** transaksjonell tabell-rad uten eksplisitt produktvedtak.
