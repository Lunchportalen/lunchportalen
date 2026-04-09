# CP1 — Domain linkage matrix

**Dato:** 2026-03-29

| Domain | Current source of truth | Current CMS linkage | Gap | Planned integration in CP1 |
|--------|-------------------------|---------------------|-----|----------------------------|
| **Companies / customers** | Supabase `companies`, superadmin APIs | Indirekte innholdshelpers | Ingen firmaliste i backoffice | Bro-lenke til `/superadmin/companies` fra kontrollflate |
| **Profiles / users** | `profiles`, auth | Backoffice Users/Members | Ingen operativ aggregat | Kun dokumentasjon; ingen mutasjon |
| **Agreements** | `company_current_agreement` | Konsum i ordre/meny | Ingen CMS-widget | Dokumentasjon + bro til superadmin |
| **Locations** | Supabase | Admin scope | — | Dokumentert |
| **Week visibility** | `lib/week/availability.ts`, `GET /api/week` | — | Algoritme vs copy | Statusstrip + `CP1_WEEK_MENU_RUNTIME_CHAIN.md` |
| **Menus / meal types** | Sanity `menu` | Queries, backoffice | — | LIVE i modulstatus der relevant |
| **Week plans** | Sanity `weekPlan` (editorial) | `weekplan/publish` | To spor | Editorial merket LIMITED i status/docs |
| **Order runtime** | Order APIs | Ingen CMS | Korrekt | Ingen CMS-kobling |
| **Billing / invoices** | Billing engine, cron | Superadmin | — | Bro til `/superadmin/invoices` |
| **Company admin tower** | `app/admin/**` | Egen flate | Adskilt visuelt | Bro til `/superadmin/overview` (superadmin-synlig kontekst), ikke erstatning for firma-admin |
| **Kitchen tower** | `app/kitchen/**` | Meny fra Sanity | — | Informativ tekst på bro |
| **Driver tower** | `app/driver/**` | — | — | Informativ tekst på bro |
| **Superadmin tower** | `app/superadmin/**` | Delvis | — | Eksplisitte bro-lenker |
| **Social** | DB + publish DRY_RUN | Backoffice Social | Forventning | **DRY_RUN** i statusstrip |
| **SEO** | Scripts + editor | Backoffice SEO | batch vs editor | **LIMITED** |
| **ESG** | Aggregater | Backoffice ESG | — | **LIMITED** |
| **Media** | Backoffice media API | Canonical | — | **LIVE** |
| **Content tree** | Postgres + API | Canonical | — | **LIVE** |

**CP1-regel:** Ingen ny runtime-sannhet i CMS — kun navigasjon, modulstatus og dokumentasjon.
