# CP2 — Company / agreement / location linkage rules

**Dato:** 2026-03-29

## Read-only i CMS (backoffice CP2)

- **Aggregerte tellere**: antall firmaer (per status der hentet), antall lokasjoner, antall aktive avtaler — fra **Supabase admin** med superadmin-session (samme gate som andre superadmin-operasjoner).
- **Innholds-CMS** (`getSuperadminCompaniesCmsCopy`): presentation copy for superadmin companies — uendret.

## Review / approval i CMS

- **Innholdsreview** (sider, SEO-tekster, social utkast) — eksisterende flyter.
- **Avtale-godkjenning / firma-aktivering** — **ikke** flyttet til backoffice i CP2; fortsetter i **superadmin**-ruter der mutasjon allerede er konsistent.

## Mutasjon som kan skje trygt fra CMS-lignende flater

- **Sanity** meny/dish/weekPlan (Studio eller eksisterende skriv-API) — **ikke** ny Lunchportalen-tabell.
- **Postgres content** (pages, publish) — eksisterende backoffice.

## Må fortsatt gå via admin/superadmin runtime routes

- **Firmastatus**, **avtalefelt** som styrer pris/leveringsdager, **RPC-aktivering**, **invitasjoner**, **faktura** — **supersadmin/admin API** og dedikerte sider.
- **CP2 legger kun navigasjon og lesing** — ikke nye POST fra backoffice til `companies`/`company_current_agreement`.
