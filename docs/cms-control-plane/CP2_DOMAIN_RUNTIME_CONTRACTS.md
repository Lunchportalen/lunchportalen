# CP2 — Domain runtime contracts

**Dato:** 2026-03-29

| Domain | Current runtime truth | Current CMS surface | Missing control-plane linkage | Planned CP2 action | Risk |
|--------|----------------------|---------------------|------------------------------|-------------------|------|
| **Companies / customers** | Supabase `companies` | Superadmin liste; CMS copy for companies-siden | Aggregert innsyn i backoffice | **Runtime-side** med tellere + lenke til superadmin | Lav (read-only) |
| **Profiles / users** | `profiles` | Backoffice Users/Members | Ingen HR-oversikt | Dokumentert; ev. senere read-only | Lav |
| **Agreements** | `company_current_agreement` | Admin/superadmin | Ingen CMS aggregat | **Teller aktive avtaler** på runtime-side | Lav |
| **Locations** | `company_locations` | Admin | Ingen CMS-teller | **Antall lokasjoner** på runtime-side | Lav |
| **Week visibility** | `lib/week/availability.ts` | — | Ingen | Forklaring på **Uke & meny**-side | Lav |
| **Menus / meal types** | Sanity `menu` | Diverse | Ingen samlet styringflate i backoffice | **Uke & meny**-side med Sanity-lesing | Lav |
| **Week plans** | Sanity `weekPlan` (editorial) | publish API | Tydelig merking | **Eksplisitt** i UI/docs (LIMITED) | Medium (forveksling) |
| **Order runtime** | Orders APIs | — | Korrekt skilt | Ingen CP2-mutasjon | — |
| **Billing / invoices** | Billing engine | Superadmin | — | Lenke fra runtime-side | Lav |
| **Company admin tower** | `app/admin/**` | Egen header | Svak CMS-narrativ | Lenker + språk i **Tårn**-dok | Lav |
| **Kitchen tower** | `app/kitchen/**` | — | — | Lenke + forklaring | Lav |
| **Driver tower** | `app/driver/**` | — | — | Lenke + forklaring | Lav |
| **Superadmin tower** | `app/superadmin/**` | Delvis | — | **Runtime**-side som hub | Lav |
| **Social** | DB + DRY_RUN publish | Backoffice | Ærlig status | Bevart strip + dok | Medium |
| **SEO** | Scripts + editor | Backoffice | — | Dok + lenker | Lav |
| **ESG** | Aggregater | Backoffice | — | Dok + lenker | Lav |
| **Media** | Backoffice | Canonical | — | — | — |
| **Content tree** | Postgres | Canonical | — | — | — |
