# Audit: /admin-flaten

Read-only audit for planlegging av UI-opprydding og forretningsflyt-justering. Ingen kode er endret utenom denne rapportfilen.

## 0. Premisser

- Audit-dato: 2026-05-12.
- Scope: repo-lesing av `app/admin/**`, relevante `components/admin/**`, `lib/admin/**`, `lib/server/admin/**`, `lib/server/kitchen/loadOperativeKitchenOrders.ts`, relevante `app/api/admin/**` og relevante migrasjoner.
- Ingen kall er gjort mot Sanity, Supabase eller eksterne API-er.
- `/admin`-rutene lever i `app/admin/**`. Det finnes ingen filer under `app/(admin)/**` i denne repoen ved glob-søk.
- `app/(backoffice)` finnes som egen flate, men er ikke en del av company_admin `/admin`-navigasjonen.
- `company_admin`-rollen er hovedscope for `/admin`, men `app/admin/**` inneholder også legacy/superadmin/kitchen-ruter.
- UKLART: faktisk UI-screenshot er ikke lest her. Mobile-vurdering er statisk vurdering fra JSX/CSS-klasser.

## 1. Route-oversikt

### 1.1 Toppnivå og shell

| Fil | Type | Linjer | Hva filen gjør |
| --- | --- | ---: | --- |
| `app/admin/layout.tsx` | Server layout | 160 | Gater `/admin` med `getAuthContext()`, rolle, `company_id` og egen avtalesjekk før `AdminNav` rendres, se `app/admin/layout.tsx:109-142`. |
| `app/admin/AdminNav.tsx` | Client navigation | 80 | Definerer 13 nav-items hvor 12 er sider og `Faktura (CSV)` er direkte API-lenke, se `app/admin/AdminNav.tsx:31-45`. |
| `app/admin/page.tsx` | Server page | 489 | Root `/admin` / Oversikt; henter admin-kontekst, operativ brief og CMS-overlays, og rendrer mange KPI-/kortseksjoner, se `app/admin/page.tsx:184-257` og `app/admin/page.tsx:299-488`. |
| `app/admin/admin-client.tsx` | Client gate, legacy | 115 | Client-side `AdminGate` som kaller `/api/admin/me`, men er ikke brukt i root-siden som ble lest, se `app/admin/admin-client.tsx:33-65`. |
| `app/admin/loading.tsx` | Loading UI | 3 | Inline-style loading placeholder, se `app/admin/loading.tsx:1-3`. |
| `app/admin/error.tsx` | Client error boundary | 98 | Error boundary med flere inline styles og console-logg, se `app/admin/error.tsx:22-96`. |

### 1.2 De 12 observerte toppfanene

| Fane | Route | Fil(er) | Type | Linjer | Status |
| --- | --- | --- | --- | ---: | --- |
| Oversikt | `/admin` | `app/admin/page.tsx` | Server page | 489 | Reell funksjon, men svært tett og overlappende. |
| Ansatte | `/admin/people` | `app/admin/people/page.tsx`, `app/admin/people/PeopleClient.tsx` | Server + client | 100 + 255 | Reell funksjon for lesing, invitasjon og CSV. |
| Lokasjoner | `/admin/locations` | `app/admin/locations/page.tsx`, `components/admin/LocationsPanel.tsx` | Server + client | 200 + 222 | Reell funksjon; status-toggle finnes. |
| Avtale | `/admin/agreement` | `app/admin/agreement/page.tsx`, `lib/admin/fetchAgreementPageDataServer.ts`, `app/api/admin/agreement/route.ts` | Server + API fetch | 374 + 65 + 450 | Reell read-only avtalevisning. |
| Leveringsgrunnlag | `/admin/leveringsgrunnlag` | `app/admin/leveringsgrunnlag/page.tsx`, `components/admin/AgreementDeliveryBasisView.tsx` | Server + subcomponent | 97 + 189 | Reell read-only, men overlapp med Avtale/Oversikt/Uke. |
| Uke og bestillbarhet | `/admin/uke-bestillbarhet` | `app/admin/uke-bestillbarhet/page.tsx`, `lib/server/admin/loadCompanyWeekBookabilityOverview.ts` | Server + loader | 204 + 334 | Reell read-only, samme grunnlag som `/week`. |
| Dagens brukere | `/admin/dagens-brukere` | `app/admin/dagens-brukere/page.tsx`, `lib/server/admin/loadCompanyOperativeDayRoster.ts` | Server + loader | 181 + 448 | Reell operativ liste per ansatt/ordre. |
| Dagens levering | `/admin/dagens-levering` | `app/admin/dagens-levering/page.tsx`, `lib/server/admin/loadCompanyOperativeDayRoster.ts` | Server + shared loader | 259 + 448 | Reell operativ aggregert levering per lokasjon/slot. |
| Økonomi | `/admin/insights` | `app/admin/insights/page.tsx`, `app/admin/insights/AdminInsightsClient.tsx` | Server + client | 118 + 393 | Reell, men blander ROI, stabilitet og AI/demand. |
| Faktura (CSV) | `/api/admin/invoices/csv` | `app/api/admin/invoices/csv/route.ts` | Route handler | 405 | Direkte nedlasting, ingen side. |
| Historikk | `/admin/orders` | `app/admin/orders/page.tsx`, `components/admin/OrdersTable.tsx` | Server + client | 132 + 345 | Reell ordretabell, men egen legacy-gating og eldre UI-stil. |
| Aktivitet | `/admin/history` | `app/admin/history/page.tsx`, `lib/server/admin/loadCompanyOperativeRecentHistory.ts` | Server + loader | 338 + 241 | Reell feed + eksportkort, men navn overlapper Historikk. |
| Kontrolltårn | `/admin/control-tower` | `app/admin/control-tower/page.tsx`, `app/admin/control-tower/OperationsTowerClient.tsx`, `app/api/admin/operations-tower/route.ts` | Server + client + API | 108 + 743 + 405 | Reell, men veldig omfattende og tung som fane. |

Merk: bruker beskriver 12 toppnavigasjons-faner, men `AdminNav` inneholder 13 entries hvis direkte API-lenken `Faktura (CSV)` telles, se `app/admin/AdminNav.tsx:31-45`.

### 1.3 Andre filer under `app/admin/**`

| Fil | Type | Linjer | Hva filen gjør |
| --- | --- | ---: | --- |
| `app/admin/dashboard/page.tsx` | Server page, legacy | 260 | Eldre dashboard som henter `/api/admin/metrics` og `/api/admin/metrics/daily`, ikke i `AdminNav`, se `app/admin/dashboard/page.tsx:105-108`. |
| `app/admin/dashboard/MyLunchCard.tsx` | Client component | 137 | Ansatt-lunsjkort som kaller `/api/orders/my`, se `app/admin/dashboard/MyLunchCard.tsx:45-77`. |
| `app/admin/dashboard/Sparkline.tsx` | Server/simple component | 28 | Ren SVG sparkline, se `app/admin/dashboard/Sparkline.tsx:1-27`. |
| `app/admin/companies/page.tsx` | Server page, superadmin legacy | 70 | Superadmin-only firmaoversikt under `/admin`, ikke company_admin, se `app/admin/companies/page.tsx:27-29`. |
| `app/admin/companies/CompaniesClient.tsx` | Client component | 273 | Kaller `/api/superadmin/companies` og status-endring, se `app/admin/companies/CompaniesClient.tsx:41-110`. |
| `app/admin/audit/page.tsx` | Server page, superadmin legacy | 67 | Superadmin audit-side under `/admin`, se `app/admin/audit/page.tsx:22-30`. |
| `app/admin/audit/AuditClient.tsx` | Client component | 324 | Kaller `/api/superadmin/audit`, ikke `/api/admin`, se `app/admin/audit/AuditClient.tsx:59-65`. |
| `app/admin/menus/page.tsx` | Server page, superadmin legacy | 113 | Superadmin meny-publisering under `/admin`, se `app/admin/menus/page.tsx:63-65`. |
| `app/admin/menus/MenusClient.tsx` | Client component | 317 | Kaller `/api/superadmin/menus-week` og `/api/superadmin/menu-publish`, se `app/admin/menus/MenusClient.tsx:68-126`. |
| `app/admin/invite/page.tsx` | Server page | 121 | Invitasjonsside lenket fra Oversikt/Ansatte, men ikke egen toppfane, se `app/admin/invite/page.tsx:49-116`. |
| `app/admin/invite/InviteClient.tsx` | Client component | 344 | Single/bulk invite UI som kaller `/api/admin/invite`, se `app/admin/invite/InviteClient.tsx:108-137`. |
| `app/admin/invite/actions.ts` | Server action | 75 | Server action for enkel invite med egen rolle-/profile-logikk, se `app/admin/invite/actions.ts:19-61`. |
| `app/admin/baerekraft/page.tsx` | Server page | 34 | Bærekraft/ESG-side, ikke i toppnav, se `app/admin/baerekraft/page.tsx:10-31`. |
| `app/admin/baerekraft/AdminEsgClient.tsx` | Client component | 198 | Kaller `/api/admin/esg/summary`, se `app/admin/baerekraft/AdminEsgClient.tsx:59-90`. |
| `app/admin/baerekraft/DownloadEsgPdfButton.tsx` | Client component | 45 | Starter PDF-nedlasting via `/api/admin/esg/report/pdf?mode=year`, se `app/admin/baerekraft/DownloadEsgPdfButton.tsx:15-20`. |
| `app/admin/baerekraft/LatestMonthlyBox.tsx` | Client component | 120 | Kaller `/api/admin/esg/latest-monthly`, se `app/admin/baerekraft/LatestMonthlyBox.tsx:48-79`. |
| `app/admin/firma-onboarding/page.tsx` | Server page | 24 | Onboarding wizard i admin-shell, bruker Sanity-loader hvis den rendres, se `app/admin/firma-onboarding/page.tsx:10-20`. |
| `app/admin/kjokken/page.tsx` | Redirect page | 11 | Redirecter `/admin/kjokken` til `/kitchen`, se `app/admin/kjokken/page.tsx:8-10`. |
| `app/admin/kjokken/kitchenClient.tsx` | Client component, legacy | 289 | Legacy kjøkken-UI med CSV/print, ikke brukt av redirect-siden, se `app/admin/kjokken/kitchenClient.tsx:56-120`. |
| `app/admin/kjokken/orders/route.ts` | Route handler, gone | 11 | Returnerer 410 og peker til `/kitchen`, se `app/admin/kjokken/orders/route.ts:1-10`. |
| `app/admin/kitchen-test/page.tsx` | Test page | 18 | Testside for kitchen RPC, se `app/admin/kitchen-test/page.tsx:1-17`. |
| `app/admin/kitchen-test/test-client.tsx` | Client test | 68 | Kaller `supabase.rpc("get_kitchen_orders")` direkte fra browser, se `app/admin/kitchen-test/test-client.tsx:17-33`. |
| `app/admin/employees/invites/bulk/route.ts` | Route handler | 264 | Bulk invite route under `app/admin`, ikke `app/api`; sender SMTP og lagrer invites, se `app/admin/employees/invites/bulk/route.ts:118-263`. |

### 1.4 API-ruter som er direkte relevante for toppfanene

| API | Brukes av | Hva den gjør |
| --- | --- | --- |
| `app/api/admin/people/route.ts` | Ansatte | Leser firma, ansatte og employee_invites, se `app/api/admin/people/route.ts:80-100`. |
| `app/api/admin/invites/route.ts` | Ansatte/Invite | Oppretter single/bulk employee invites. Ikke fullstendig lest i denne rapporten. |
| `app/api/admin/locations/route.ts` | Lokasjoner | Leser `company_locations` med `select("*")` og fallback-mapping, se `app/api/admin/locations/route.ts:64-103`. |
| `app/api/admin/locations/status/route.ts` | Lokasjoner | Oppdaterer `company_locations.status` etter company-scope-validering, se `app/api/admin/locations/status/route.ts:55-87`. |
| `app/api/admin/agreement/route.ts` | Avtale/Leveringsgrunnlag | Leser company, location, `company_current_agreement`, fallback `agreements`, day tiers og metrics, se `app/api/admin/agreement/route.ts:189-449`. |
| `app/api/admin/orders/route.ts` | Historikk/OrdersTable | Leser ordre for valgt dato/status, se `app/api/admin/orders/route.ts:101-137`. |
| `app/api/admin/invoices/csv/route.ts` | Faktura CSV/Oversikt/History | Bygger CSV fra active agreement og active orders, se `app/api/admin/invoices/csv/route.ts:198-398`. |
| `app/api/admin/insights/route.ts` | Økonomi | Leser ordre og ansatte for ROI/stabilitet, se `app/api/admin/insights/route.ts:99-183`. |
| `app/api/admin/demand-insights/route.ts` | Økonomi | Leser orders/day_choices og kjører deterministisk demand-forecast, se `app/api/admin/demand-insights/route.ts:57-162`. |
| `app/api/admin/operations-tower/route.ts` | Kontrolltårn | Leser orders/companies/day_choices/company_locations, bygger plan/forslag og logger audit, se `app/api/admin/operations-tower/route.ts:59-290`. |

## 2. Hovedsiden: `/admin`

### 2.1 Data-henting server-side

`/admin` starter med auth og rollecheck:

- `getAuthContext()` kalles i `app/admin/page.tsx:186-197`.
- Ikke-auth redirecter til `/login?code=NO_SESSION`, se `app/admin/page.tsx:187-193`.
- Roller uten `company_admin` eller `superadmin` redirectes til status-blokk, se `app/admin/page.tsx:197-204`.
- `loadAdminContext()` kalles med `nextPath: "/admin"`, `enforceCompanyAdmin: role !== "superadmin"` og `returnBlockedState: true`, se `app/admin/page.tsx:206-211`.

Supabase-queryer fra `loadAdminContext()`:

- Auth: `supabase.auth.getUser()` via server client, se `lib/admin/loadAdminContext.ts:149-154`.
- Profil: `profiles.select("role, email, company_id, location_id, disabled_at").eq("id", authUserId)`, se `lib/admin/loadAdminContext.ts:179-188`.
- Profil fallback: `profiles.select("role, email, company_id, location_id, disabled_at, created_at").ilike("email", authEmail).order("created_at").limit(1)`, se `lib/admin/loadAdminContext.ts:190-201`.
- Firma: `companies.select("id, status, name").eq("id", companyId).maybeSingle()`, se `lib/admin/loadAdminContext.ts:301-306`.
- Ansatte totalt: `profiles` count `company_id + role=employee`, se `lib/admin/loadAdminContext.ts:342-346`.
- Ansatte aktive: `profiles` count `company_id + role=employee + disabled_at is null`, se `lib/admin/loadAdminContext.ts:348-356`.
- Ansatte deaktivert: `profiles` count `company_id + role=employee + disabled_at not null`, se `lib/admin/loadAdminContext.ts:358-366`.
- Lokasjoner: `company_locations` count `company_id`, se `lib/admin/loadAdminContext.ts:372-375`.
- Bestillinger i dag: `orders` count `company_id + date=todayISO + status=ACTIVE`, se `lib/admin/loadAdminContext.ts:377-380`.
- Bestillinger uke: `orders` count `company_id + date >= weekStart + date < weekEnd + status=ACTIVE`, se `lib/admin/loadAdminContext.ts:382-391`.

Supabase-queryer fra `loadCompanyOperationalBrief()`:

- `agreements.select("id,company_id,status,created_at,slot_start,slot_end").eq("company_id", companyId).in("status", ["PENDING", "ACTIVE"])`, se `lib/server/admin/loadCompanyOperationalBrief.ts:196-204`.
- `company_current_agreement.select("status").eq("company_id", companyId).maybeSingle()`, se `lib/server/admin/loadCompanyOperationalBrief.ts:202-203`.
- `fetchAgreementDayTiersForCompany(admin, companyId)`, se `lib/server/admin/loadCompanyOperationalBrief.ts:203-204`.
- `loadOperativeClosedDatesReasonsInRange()` for dagens dato, se `lib/server/admin/loadCompanyOperationalBrief.ts:242-249`.
- `loadOperativeKitchenOrders({ admin, dateISO: today_iso, tenant: { companyId } })`, se `lib/server/admin/loadCompanyOperationalBrief.ts:250-254`.
- `company_locations.select("id,name").eq("company_id", companyId)`, se `lib/server/admin/loadCompanyOperationalBrief.ts:255-256`.

Eksterne/CMS-kall i `/admin`:

- `getOverlayBySlug(APP_OVERLAYS.companyAdmin.slug, { locale: "nb", environment: "prod" })`, se `app/admin/page.tsx:290-295`.
- `getDesignSettings()`, se `app/admin/page.tsx:290-293`.
- UKLART: disse CMS-helperne kan lese Sanity ved runtime. I denne auditen ble de ikke kjørt.

Hvor kommer "Operative ordre i dag" fra:

- UI-boksen rendres i `CompanyOperationalBriefPanel`, se `components/admin/CompanyOperationalBriefPanel.tsx:103-147`.
- Data kommer fra `brief.orders_day`, som settes i `loadCompanyOperationalBrief()` etter `loadOperativeKitchenOrders()`, se `lib/server/admin/loadCompanyOperationalBrief.ts:242-276`.
- `loadOperativeKitchenOrders()` queryer `orders` med `date` og `.in("status", ["ACTIVE", "active"])`, se `lib/server/kitchen/loadOperativeKitchenOrders.ts:72-77`.
- Dette er sannsynlig kilde til observert enum-feil hvis live enum er uppercase-only.

### 2.2 Layout-hierarki

Faktisk komponenttre for root-siden:

```text
AdminLayout
├── NeonGuard
├── AdminNav
├── AdminCommandCenterPage
│   ├── AdminPageShell
│   │   ├── title/actions header
│   │   ├── topBanner/headerSlot from CMS overlays
│   │   ├── CompanyOperationalBriefPanel
│   │   │   ├── Firmadagens drift
│   │   │   ├── Avtale (ledger)
│   │   │   ├── Avtale (snapshot)
│   │   │   ├── Operative leveringsdager (daymap)
│   │   │   ├── Uke i /week
│   │   │   ├── Cut-off i dag
│   │   │   ├── Operative ordre i dag (firma)
│   │   │   ├── Ordre — forklaring
│   │   │   ├── Bestilling / drift — forklaring
│   │   │   └── relaterte lenker
│   │   ├── egen header-rad: Firmaadmin / neste levering / primær CTA
│   │   ├── KPI-grid 1: Ansatte, Lokasjoner, Neste leveringsvindu
│   │   ├── KPI-grid 2: Avtale (ledger), Bestillinger i dag, Bestillinger denne uken
│   │   ├── hovedgrid
│   │   │   ├── Neste levering card
│   │   │   │   ├── CommandCenterKpis
│   │   │   │   └── Systemregler
│   │   │   ├── Aktivitet card (placeholder)
│   │   │   ├── Systemstatus card
│   │   │   │   ├── Firma-status
│   │   │   │   ├── Invitasjoner / PendingInvitesStat
│   │   │   │   └── Quick links
│   │   │   ├── Fakturagrunnlag card
│   │   │   └── Support card
│   │   ├── helpSlot
│   │   ├── footer link to /week
│   │   └── footerCtaSlot
│   └── BlockedState ved fail-closed admin-context
└── AdminFooter
```

Viktige filreferanser:

- Layout shell: `app/admin/layout.tsx:93-106`.
- Admin nav: `app/admin/AdminNav.tsx:31-80`.
- Root page data + render: `app/admin/page.tsx:184-489`.
- `AdminPageShell`: `components/admin/AdminPageShell.tsx:10-35`.
- `CompanyOperationalBriefPanel`: `components/admin/CompanyOperationalBriefPanel.tsx:55-196`.
- `CommandCenterKpis`: importert i `app/admin/page.tsx:27` og brukt i `app/admin/page.tsx:386-391`.
- `PendingInvitesStat`: importert i `app/admin/page.tsx:28` og brukt i `app/admin/page.tsx:428-433`.

### 2.3 CSS-klasser brukt

Design-system / `lp-*`:

- `AdminNav` bruker `lp-motion-btn` og mange Tailwind-klasser, se `app/admin/AdminNav.tsx:12-18`.
- `AdminPageShell` bruker `lp-h1`, men ellers Tailwind grid/flex, se `components/admin/AdminPageShell.tsx:12-33`.
- Root `Card` helper bruker `lp-card lp-card--elevated` og `lp-card-pad`, se `app/admin/page.tsx:77-101`.
- Root `KpiCard` bruker `lp-card` og `lp-card-pad`, se `app/admin/page.tsx:104-113`.
- CTA-er bruker `lp-btn`, `lp-btn--primary`, `lp-btn--secondary`, `lp-btn--ghost`, `lp-neon-focus`, `lp-neon-glow-hover`, se `app/admin/page.tsx:326-329` og `app/admin/page.tsx:376-382`.
- `CompanyOperationalBriefPanel` bruker `lp-card`, `lp-card--elevated`, `lp-card-pad`, `lp-btn`, se `components/admin/CompanyOperationalBriefPanel.tsx:57-58` og `components/admin/CompanyOperationalBriefPanel.tsx:167-191`.

`ds-*`:

- Ingen `ds-*`-klasser ble funnet i de leste `/admin`-filene. UKLART om globalt designsystem definerer `ds-*` andre steder.

`lp-*` brukt som mulig landing/marketing-stil:

- `lp-card`, `lp-glass-card`, `lp-card-glass`, `lp-glass-panel`, `lp-motion-card`, `lp-motion-btn`, `lp-neon-*` brukes bredt i admin, f.eks. `app/admin/insights/AdminInsightsClient.tsx:72-95`, `app/admin/history/page.tsx:44-67`, `app/admin/locations/page.tsx:40-63`.
- Dette er konsistent internt, men bryter med brukerens ønske hvis admin skal bruke `ds-*` som primært designsystem.

Lokale/Tailwind-klasser:

- Det meste av UI er Tailwind utility-klasser: `rounded-2xl`, `ring-1`, `bg-neutral-50/80`, `grid`, `sm:grid-cols-2`, `lg:grid-cols-12`, osv.
- Det er flere lokale helper-komponenter (`Card`, `KpiCard`, `SectionCard`, `GhostLink`, `PrimaryLink`) definert per side i stedet for gjenbruk, se `app/admin/page.tsx:77-129`, `app/admin/locations/page.tsx:18-63`, `app/admin/history/page.tsx:22-99`, `app/admin/insights/page.tsx:18-27`.

Inline styles:

- `app/admin/loading.tsx` bruker inline style på root-div, se `app/admin/loading.tsx:1-3`.
- `app/admin/error.tsx` bruker inline styles på mange elementer, se `app/admin/error.tsx:22-96`.
- `OperationsTowerClient` har inline `style={{ width: ... }}` for progressbar, se `app/admin/control-tower/OperationsTowerClient.tsx:497-499`.
- Dette bør flagges som design-system-brudd hvis inline styles er ulovlig.

### 2.4 Mobile-first eller desktop-first?

- `AdminNav` er `flex flex-wrap items-center justify-center gap-2 md:justify-start`, se `app/admin/AdminNav.tsx:50-52`. Det wrapper faner i stedet for horisontal scroll.
- `AdminNav` mangler egen mobile menu/progressive disclosure og viser alle 13 nav-items på mobil.
- Root `/admin` bruker mobile-first grids (`grid`, `sm:grid-cols-2`, `lg:grid-cols-3`, `lg:grid-cols-12`) i KPI- og hovedseksjoner, se `app/admin/page.tsx:333-370`.
- `CompanyOperationalBriefPanel` bruker `sm:grid-cols-2` og flere `sm:col-span-2`, se `components/admin/CompanyOperationalBriefPanel.tsx:74-100`.
- `Dagens brukere`, `Dagens levering`, `OrdersTable` og flere admin-tabeller bruker `overflow-x-auto` og `min-w-full`, se `app/admin/dagens-brukere/page.tsx:127-158`, `app/admin/dagens-levering/page.tsx:150-178`, `components/admin/OrdersTable.tsx:289-335`.
- Statisk vurdering: layouten er delvis mobile-first i grid, men informasjonsarkitekturen og nav/tables er desktop-tung.

## 3. Hver av de 12 fanene

### 3.1 Oversikt

- Route: `/admin`, `app/admin/page.tsx`.
- Hovedformål: command center for firmaadmin; avtale, drift, KPI-er, quick links, support og faktura samlet.
- Data: `loadAdminContext()` for profil/firma/counts, `loadCompanyOperationalBrief()` for avtale/daymap/cutoff/orders, og CMS overlay helpers, se `app/admin/page.tsx:206-257` og `app/admin/page.tsx:290-297`.
- Handlinger: primær CTA til `/admin/orders`, secondary links til `/week`, `/admin/invite`, faktura CSV og supportrapport, se `app/admin/page.tsx:275-286`, `app/admin/page.tsx:326-329`, `app/admin/page.tsx:376-382`, `app/admin/page.tsx:454-470`.
- Status: reell funksjon, men med placeholder "Aktivitet" og svært mange kort.
- Subjektiv boks-telling: ca. 20 synlige bokser/kort når `CompanyOperationalBriefPanel` telles med indre cards.

### 3.2 Ansatte

- Route: `/admin/people`, `app/admin/people/page.tsx` + `app/admin/people/PeopleClient.tsx`.
- Hovedformål: vise ansatte, søke, invitere, eksportere og se invitasjoner.
- Data: serveren bruker `loadAdminContext()`, klienten kaller `/api/admin/people`, se `app/admin/people/page.tsx:39-44` og `app/admin/people/PeopleClient.tsx:98-121`.
- API henter `companies`, `profiles` med `role=employee`, og `employee_invites`, se `app/api/admin/people/route.ts:80-100`.
- Handlinger: `/admin/invite` link, lokal ansatte-CSV, single/bulk invite via `EmployeesTable`, reload og support, se `app/admin/people/PeopleClient.tsx:139-160` og `components/admin/EmployeesTable.tsx:198-303`.
- Status: reell og aktiv.
- Subjektiv boks-telling: ca. 7 hovedbokser, pluss modalbokser.

### 3.3 Lokasjoner

- Route: `/admin/locations`, `app/admin/locations/page.tsx`.
- Hovedformål: vise lokasjoner og aktivere/deaktivere leveringslokasjoner.
- Data: server `loadAdminContext()`, klient `LocationsPanel` kaller `/api/admin/locations?companyId=...`, se `app/admin/locations/page.tsx:86-91` og `components/admin/LocationsPanel.tsx:55-77`.
- API ignorerer i praksis client-sendt `companyId` og bruker `scope.companyId`, se `app/api/admin/locations/route.ts:51-68`.
- Handlinger: `Oppdater`, `Aktiver`/`Deaktiver` via `/api/admin/locations/status`, se `components/admin/LocationsPanel.tsx:79-110` og `components/admin/LocationsPanel.tsx:193-207`.
- Status: reell funksjon, men statusverdier er `ACTIVE`/`INACTIVE` i UI mens eldre DB constraint i bootstrap viser `ACTIVE`/`PAUSED`/`CLOSED`, se `components/admin/LocationsPanel.tsx:35-45` og `supabase/migrations/20260201000000_legacy_bootstrap_minimal.sql:82-93`. UKLART hva live schema tillater.
- Subjektiv boks-telling: 1 shell + N lokasjonskort + teknisk info.

### 3.4 Avtale

- Route: `/admin/agreement`, `app/admin/agreement/page.tsx`.
- Hovedformål: read-only avtalerammer, pris, binding, ukeplan, metrics og support.
- Data: `loadAdminContext()` og `fetchAgreementPageDataForAdmin(null)`, se `app/admin/agreement/page.tsx:322-357`.
- `fetchAgreementPageDataForAdmin()` gjør server-side fetch til `/api/admin/agreement`, se `lib/admin/fetchAgreementPageDataServer.ts:25-46`.
- API henter `companies`, `company_locations`, `company_current_agreement`, fallback `agreements`, day tiers, `profiles` counts og `orders` metrics, se `app/api/admin/agreement/route.ts:222-449`.
- Handlinger: read-only; supportrapport som primær knapp i en underseksjon, se `app/admin/agreement/page.tsx:258-279`.
- Status: reell read-only.
- Subjektiv boks-telling: ca. 5 kort + mange indre day cards.

### 3.5 Leveringsgrunnlag

- Route: `/admin/leveringsgrunnlag`, `app/admin/leveringsgrunnlag/page.tsx`.
- Hovedformål: read-only leveringsrammer uten pris/binding/superadmin-felt.
- Data: `loadAdminContext()`, `fetchAgreementPageDataForAdmin(null)`, `loadCompanyOperationalBrief()`, se `app/admin/leveringsgrunnlag/page.tsx:37-78`.
- Handlinger: lenker videre til `/week`, `/admin/orders`, `/admin#firma-operativt`, `/admin/agreement`, se `components/admin/AgreementDeliveryBasisView.tsx:167-185`.
- Status: reell, men overlappende med Avtale, Oversikt og Uke.
- Subjektiv boks-telling: 4 hovedkort + day cards.

### 3.6 Uke og bestillbarhet

- Route: `/admin/uke-bestillbarhet`, `app/admin/uke-bestillbarhet/page.tsx`.
- Hovedformål: vise synlige uker i `/week` og hvorfor dager er åpne/blokkerte.
- Data: `loadAdminContext()` og `loadCompanyWeekBookabilityOverview()`, se `app/admin/uke-bestillbarhet/page.tsx:38-76`.
- Loader bruker `visibleWeekStarts()`, `fetchAgreementDayTiersForCompany()`, `agreements`, `company_current_agreement` og `closed_dates`, se `lib/server/admin/loadCompanyWeekBookabilityOverview.ts:216-333`.
- Handlinger: read-only; relaterte lenker til `/week`, `/admin`, leveringsgrunnlag og ordrehistorikk, se `app/admin/uke-bestillbarhet/page.tsx:180-200`.
- Status: reell read-only.
- Subjektiv boks-telling: 1 grunnlagskort + 0-2 ukekort + 1 lenkekort.

### 3.7 Dagens brukere

- Route: `/admin/dagens-brukere`, `app/admin/dagens-brukere/page.tsx`.
- Hovedformål: vise dagens operative ansatte/ordre rader.
- Data: `loadAdminContext()` og `loadCompanyOperativeDayRoster()`, se `app/admin/dagens-brukere/page.tsx:44-86`.
- Loader bruker `loadOperativeKitchenOrders()`, `closed_dates`, lokasjonsnavn og profilnavn, se `lib/server/admin/loadCompanyOperativeDayRoster.ts:380-426`.
- Handlinger: date-filter via GET form; ingen ordreendringer, se `app/admin/dagens-brukere/page.tsx:94-107`.
- Status: reell read-only.
- Subjektiv boks-telling: 1 filter, 1 forklaringsboks, 1 tabell, 1 lenkebar.

### 3.8 Dagens levering

- Route: `/admin/dagens-levering`, `app/admin/dagens-levering/page.tsx`.
- Hovedformål: aggregere dagens operative ordre per lokasjon og slot.
- Data: samme `loadCompanyOperativeDayRoster()` som Dagens brukere, se `app/admin/dagens-levering/page.tsx:81-88`.
- Handlinger: date-filter via GET form; ingen manuell levering/ordreendring, se `app/admin/dagens-levering/page.tsx:96-109`.
- Status: reell read-only.
- Subjektiv boks-telling: 1 filter, 1 forklaring, 4 KPI-kort, opptil 3 tabellseksjoner, 1 lenkebar.

### 3.9 Økonomi

- Route: `/admin/insights`, `app/admin/insights/page.tsx`.
- Hovedformål: ROI, stabilitet, historikk og AI/demand-innsikt.
- Data: `loadAdminContext()` server-side, client fetcher `/api/admin/insights?range=...` og `/api/admin/demand-insights`, se `app/admin/insights/page.tsx:47-52` og `app/admin/insights/AdminInsightsClient.tsx:118-181`.
- API `/api/admin/insights` henter orders for valgt range, activity fra orders og employee count, se `app/api/admin/insights/route.ts:99-183`.
- API `/api/admin/demand-insights` henter orders, `companies.agreement_json` og `day_choices`, se `app/api/admin/demand-insights/route.ts:57-102`.
- Handlinger: range-knapper 7d/14d/30d, se `app/admin/insights/AdminInsightsClient.tsx:277-313`.
- Status: reell, men AI/demand og ROI er blandet i samme fane.
- Subjektiv boks-telling: 4 store seksjoner + 5 KPI-er + historikkrader.

### 3.10 Faktura (CSV)

- Route: ikke side; direkte link til `/api/admin/invoices/csv`, se `app/admin/AdminNav.tsx:40-42`.
- Hovedformål: laste ned CSV-fakturagrunnlag.
- Data: API henter aktiv agreement fra `agreements`, company, locations og active orders i periode, se `app/api/admin/invoices/csv/route.ts:198-337`.
- Handlinger: browser-nedlasting via `<a href="/api/admin/invoices/csv">`, se `app/admin/AdminNav.tsx:55-65`.
- Status: reell funksjon, men UX er ikke en side og mangler forklaring/preview.
- Subjektiv boks-telling: 0 på egen route; flere kort peker til den.

### 3.11 Historikk

- Route: `/admin/orders`, `app/admin/orders/page.tsx`.
- Hovedformål: ordreoversikt per dato/status.
- Data: server bruker egen `supabaseServer()`-gating og profile lookup, client `OrdersTable` kaller `/api/admin/orders` tre ganger per load: valgt status, `ACTIVE`, `CANCELLED`, se `app/admin/orders/page.tsx:45-76` og `components/admin/OrdersTable.tsx:155-170`.
- Handlinger: dato, status, refresh, CSV download via `/api/orders/export`, se `components/admin/OrdersTable.tsx:200-248`.
- Status: reell, men bruker eldre gating og UI, og status-select inneholder `DELETED` som API ikke tillater, se `components/admin/OrdersTable.tsx:213-221` og `app/api/admin/orders/route.ts:46-49`.
- Subjektiv boks-telling: 1 outer card, 1 prinsipp, 1 content card, 4 KPI-kort, tabell.

### 3.12 Aktivitet

- Route: `/admin/history`, `app/admin/history/page.tsx`.
- Hovedformål: siste operative endringer + eksportkort.
- Data: `loadAdminContext()` og `loadCompanyOperativeRecentHistory()`, se `app/admin/history/page.tsx:122-170`.
- Loader henter `audit_events`, siste `orders`, `company_locations` og evt. profiler for e-post, se `lib/server/admin/loadCompanyOperativeRecentHistory.ts:101-164`.
- Handlinger: lenker til ordrehistorikk, ukeplan, dagens brukere, dagens levering og CSV, se `app/admin/history/page.tsx:253-291`.
- Status: reell, men overlapper Historikk/Faktura/Dagens-flater.
- Subjektiv boks-telling: 2 hovedkort + N feed cards + 3 eksporttiles.

### 3.13 Kontrolltårn

- Route: `/admin/control-tower`, `app/admin/control-tower/page.tsx`.
- Hovedformål: supply-chain oversikt/forslag og "AI-beslutninger" i observe/assist-modus.
- Data: server `loadAdminContext()`, client GET `/api/admin/operations-tower?autonomy=...`, se `app/admin/control-tower/page.tsx:47-52` og `app/admin/control-tower/OperationsTowerClient.tsx:183-210`.
- API henter orders, company agreement_json/price, day_choices, company_locations, bygger forecast/procurement/production/delivery/global OS, se `app/api/admin/operations-tower/route.ts:59-290`.
- Handlinger: autonomi select, godkjenn hele plan, godkjenn/avvis beslutninger, oppdater plan; POST logger audit, se `app/admin/control-tower/OperationsTowerClient.tsx:212-260` og `app/api/admin/operations-tower/route.ts:326-404`.
- Status: reell, men svært bred og informasjons-tung.
- Subjektiv boks-telling: 12+ seksjoner, potensielt mange nested cards/lister.

## 4. Overlapp og duplisering

### 4.1 Ordredata: Oversikt vs Dagens brukere vs Dagens levering

- Oversikt viser "Operative ordre i dag (firma)" fra `CompanyOperationalBriefPanel`, se `components/admin/CompanyOperationalBriefPanel.tsx:103-147`.
- Dagens brukere viser samme operative ordregrunnlag som personliste via `loadCompanyOperativeDayRoster()`, se `app/admin/dagens-brukere/page.tsx:81-86`.
- Dagens levering bruker samme loader og samme `delivery_summary`, se `app/admin/dagens-levering/page.tsx:81-88`.
- Alle tre er avhengige av `loadOperativeKitchenOrders()` med samme query og dermed samme enum-bug, se `lib/server/kitchen/loadOperativeKitchenOrders.ts:72-77`.
- Forskjellen er presentasjon: Oversikt summariserer, Dagens brukere lister per ansatt, Dagens levering aggregerer per lokasjon/slot.

### 4.2 Avtale-fanen vs Avtale (ledger)-kort i Oversikt

- Oversikt `Avtale (ledger)` bruker `loadCompanyOperationalBrief()` og viser aktiv/pending ledger label fra `agreements`, se `app/admin/page.tsx:347-356` og `lib/server/admin/loadCompanyOperationalBrief.ts:196-227`.
- Oversikt viser også `Avtale (snapshot)` i `CompanyOperationalBriefPanel`, se `components/admin/CompanyOperationalBriefPanel.tsx:74-85`.
- Avtale-fanen bruker `/api/admin/agreement`, som først prøver `company_current_agreement` og fallback til `agreements`, se `app/api/admin/agreement/route.ts:258-303`.
- De viser delvis samme domene, men ikke samme kontrakt: Oversikt fremhever ledger/snapshot samtidig, Avtale-fanen bygger en samlet `AgreementPageData`.

### 4.3 Faktura (CSV) vs Økonomi

- Faktura CSV bruker aktiv `agreements`-rad og `orders.status=ACTIVE` i periode, se `app/api/admin/invoices/csv/route.ts:138-147` og `app/api/admin/invoices/csv/route.ts:289-337`.
- Økonomi bruker all orders i range og beregner total, cancellations, delivery stability og demand, se `app/api/admin/insights/route.ts:99-219`.
- Overlapp: begge leser ordre per firma og periode.
- Forskjell: Faktura er regnskapsgrunnlag med pris/tier, Økonomi er innsikt/ROI/stabilitet.

### 4.4 Quick links vs faktiske faner

- Oversikt har `quickLinks` til Avtale, Ansatte, Lokasjoner, Historikk, Insights og Kontrolltårn, se `app/admin/page.tsx:279-286`.
- Disse er allerede i `AdminNav`, se `app/admin/AdminNav.tsx:31-45`.
- `CompanyOperationalBriefPanel` har i tillegg relaterte lenker til `/week`, `/admin/uke-bestillbarhet`, `/admin/orders`, `/admin/agreement`, `/admin/leveringsgrunnlag`, `/admin/dagens-brukere`, `/admin/dagens-levering`, `/admin/history`, se `components/admin/CompanyOperationalBriefPanel.tsx:167-191`.
- Resultat: samme navigasjonsvalg eksponeres flere steder på samme skjerm.

## 5. Observert bug: `order_status` enum-mismatch

UI viser:

```text
OPERATIVE ORDRE I DAG (FIRMA)
invalid input value for enum order_status: "active"

ORDRE — FORKLARING
Ordrelesing feilet: invalid input value for enum order_status: "active"
```

Funn:

- Kilden er sannsynlig `loadOperativeKitchenOrders()`:
  - Query: `.from("orders").select("id,user_id,company_id,location_id,note,status,slot").eq("date", date).in("status", ["ACTIVE", "active"])`, se `lib/server/kitchen/loadOperativeKitchenOrders.ts:72-77`.
  - Hvis `public.order_status` ikke inneholder lowercase `active`, vil Postgres avvise queryen før resultater returneres.
- `/admin` root bruker denne loaderen via `loadCompanyOperationalBrief()`, se `lib/server/admin/loadCompanyOperationalBrief.ts:250-254`.
- `Dagens brukere` og `Dagens levering` bruker samme loader via `loadCompanyOperativeDayRoster()`, se `lib/server/admin/loadCompanyOperativeDayRoster.ts:380-382`.

Enum-definisjon i migrasjoner:

- Legacy bootstrap opprettet `public.order_status` med `'ACTIVE'` og `'CANCELED'`, se `supabase/migrations/20260201000000_legacy_bootstrap_minimal.sql:57-65`.
- Senere hardening legger til `'ACTIVE'`, `'CANCELLED'`, `'CANCELED'`, se `supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql:42-70`.
- Uppercase-normaliseringsmigrasjon definerer `public.order_status` som uppercase-only: `'DRAFT'`, `'SUBMITTED'`, `'LOCKED'`, `'PREPARED'`, `'DISPATCHED'`, `'DELIVERED'`, `'ACTIVE'`, `'CANCELLED'`, se `supabase/migrations/20260507172000_normalize_status_enums_uppercase.sql:65-87`.
- Samme migrasjon har kommentar "Created but not applied to live DB without explicit owner approval", se `supabase/migrations/20260507172000_normalize_status_enums_uppercase.sql:1-7`. UKLART om den er live, men observert feil indikerer at live enum ikke godtar lowercase `active`.

Fil som må fikses:

- Primært `lib/server/kitchen/loadOperativeKitchenOrders.ts:72-77`.
- Sekundært må alle callers verifiseres fordi samme helper brukes i `/admin`, kjøkken og operativ produksjon.
- IKKE fikset i denne auditen.

## 6. Avtale-fanen spesielt

Patch 5-helperen finnes:

- `getAgreementStatus()` ligger i `lib/auth/agreementStatus.ts:48-99`.
- Den leser `company_current_agreement` og `company_billing_accounts`, se `lib/auth/agreementStatus.ts:55-88`.
- `canCompanyOperate()` krever både aktiv avtale og ingen billing hold, se `lib/auth/agreementStatus.ts:101-107`.

Bruk i `/admin`:

- `app/admin/layout.tsx` bruker ikke `getAgreementStatus`.
- Layout har egen `hasActiveAgreement(companyId)` som leser `agreements.select("id").eq("company_id", companyId).eq("status", "ACTIVE")`, se `app/admin/layout.tsx:138-160`.
- Dermed brukes ikke felles Patch 5-helper i `/admin`-layout.

Hva skjer hvis Inger lander på `/admin` uten aktiv avtale:

- Hvis hun er `company_admin` med `company_id`, layout kaller `hasActiveAgreement()`.
- Hvis ingen `agreements.status=ACTIVE` finnes eller query feiler, redirecter layout til `/avtale-ikke-aktiv`, se `app/admin/layout.tsx:138-140` og `app/admin/layout.tsx:145-160`.
- Billing hold fra `company_billing_accounts` sjekkes ikke i layouten, fordi `getAgreementStatus()` ikke brukes.
- `loadAdminContext()` sjekker firmastatus, men ikke aktiv avtale, se `lib/admin/loadAdminContext.ts:301-329`.
- UKLART om `/avtale-ikke-aktiv` har safe read-only UI for denne rollen; den ruten er ikke auditert her.

## 7. Mobile-UX vurdering

Nav:

- `AdminNav` viser alle nav-items i en `flex flex-wrap` uten collapse, se `app/admin/AdminNav.tsx:50-52`.
- Det er 13 items inkludert direkte API-lenke, se `app/admin/AdminNav.tsx:31-45`.
- På 360px viewport vil typisk 1-2 faner per rad være synlige, avhengig av label-lengde. "Uke og bestillbarhet", "Leveringsgrunnlag" og "Faktura (CSV)" vil oppta mye bredde.
- Touch target i nav er minst 44px (`min-h-[44px]`), se `app/admin/AdminNav.tsx:12-18`.
- Nav wrapper, ikke scroller. Det unngår horisontal scroll, men gir høy nav-blokk før innhold.

Cards og grid:

- Root KPI-er går fra 1 kolonne til `sm:grid-cols-2` og `lg:grid-cols-3`, se `app/admin/page.tsx:333-367`.
- Main grid går til `lg:grid-cols-12`; på mobil blir alt én kolonne, se `app/admin/page.tsx:369-477`.
- `CompanyOperationalBriefPanel` har mange innercards som blir én kolonne eller 2 ved `sm`, se `components/admin/CompanyOperationalBriefPanel.tsx:74-101`.

Tabeller:

- Dagens brukere og Dagens levering bruker `overflow-x-auto`, ikke mobile stacking, se `app/admin/dagens-brukere/page.tsx:127-158` og `app/admin/dagens-levering/page.tsx:150-178`.
- `OrdersTable` bruker `overflow-x-auto` og `min-w-full`, se `components/admin/OrdersTable.tsx:289-335`.
- Dette kan være teknisk trygt mot viewport overflow, men bryter ønsket om mobile-first scannbarhet hvis brukeren må side-scroll i tabeller.

Estimert vertikal høyde for `/admin` Oversikt på mobil:

- Nav: ca. 5-7 rader med faner.
- Header + operational brief: ca. 2-4 skjermhøyder avhengig av error/ordredata.
- KPI-grids: ca. 6 stacked cards.
- Main + sidebar: Neste levering, Aktivitet, Systemstatus, Faktura, Support.
- Estimat: 6-10 mobil-screen-heights før hele Oversikt er lest.
- UKLART uten faktisk viewport-rendering.

## 8. Avhengigheter mot resten av systemet

### 8.1 RPC/funksjoner

- Ingen `supabase.rpc(` i `app/admin/**` toppfanene.
- Unntak: testside `app/admin/kitchen-test/test-client.tsx` kaller `supabase.rpc("get_kitchen_orders")`, se `app/admin/kitchen-test/test-client.tsx:27-33`.
- Ingen `supabase.rpc(` funnet i `app/api/admin/**`.

### 8.2 API-routes kalt fra admin-UI

Fra klienter under `app/admin/**`:

- `/api/admin/people` fra `app/admin/people/PeopleClient.tsx:98-121`.
- `/api/admin/locations` og `/api/admin/locations/status` fra `components/admin/LocationsPanel.tsx:55-110`.
- `/api/admin/insights` og `/api/admin/demand-insights` fra `app/admin/insights/AdminInsightsClient.tsx:118-181`.
- `/api/admin/operations-tower` GET/POST fra `app/admin/control-tower/OperationsTowerClient.tsx:183-260`.
- `/api/admin/orders` fra `components/admin/OrdersTable.tsx:77-93`.
- `/api/orders/export` fra `components/admin/OrdersTable.tsx:96-122` (ikke `api/admin`).
- `/api/admin/invite` fra `app/admin/invite/InviteClient.tsx:108-137`.
- `/api/admin/esg/summary`, `/api/admin/esg/latest-monthly`, `/api/admin/esg/report/pdf` fra bærekraft, se `app/admin/baerekraft/AdminEsgClient.tsx:59-90`, `app/admin/baerekraft/LatestMonthlyBox.tsx:48-79`, `app/admin/baerekraft/DownloadEsgPdfButton.tsx:15-20`.
- `/api/admin/me` fra legacy `app/admin/admin-client.tsx:37-65`.
- `/api/superadmin/*` fra legacy/superadmin pages under `app/admin`, se `app/admin/companies/CompaniesClient.tsx:41-110`, `app/admin/audit/AuditClient.tsx:59-65`, `app/admin/menus/MenusClient.tsx:68-126`.

### 8.3 Gating og server-side validation

Layout-gating:

- `app/admin/layout.tsx` gates unauthenticated, role, `company_id` og active agreement, se `app/admin/layout.tsx:109-142`.
- Superadmin får shell uten company_admin nav, se `app/admin/layout.tsx:126-128`.

Shared admin context:

- De fleste company_admin pages bruker `loadAdminContext({ enforceCompanyAdmin: true, returnBlockedState: true })`, f.eks. `app/admin/people/page.tsx:39-44`, `app/admin/agreement/page.tsx:322-327`, `app/admin/dagens-brukere/page.tsx:44-48`.
- `loadAdminContext()` bruker service-role admin client for robust profile/company/counts, se `lib/admin/loadAdminContext.ts:156-158`.

API route guards:

- `scopeOr401()`, `requireRoleOr403()` og `requireCompanyScopeOr403()` er standard for mange `/api/admin`-ruter, se `lib/http/routeGuard.ts:215-274`, `lib/http/routeGuard.ts:303-366`, `lib/http/routeGuard.ts:389-463`.
- `resolveAdminTenantCompanyId()` låser `company_admin` til `ctx.scope.companyId`, se `lib/http/routeGuard.ts:465-516`.

Edit-funksjoner funnet:

- Lokasjon status: `/api/admin/locations/status` validerer role, company scope, UUID, status og at lokasjonen tilhører firma før update, se `app/api/admin/locations/status/route.ts:27-87`.
- Invitasjoner: `EmployeesTable` og InviteClient sender til invite APIs; APIene er delvis lest, men ikke fullstendig i denne rapporten.
- Kontrolltårn POST logger godkjenning/feedback i audit, men utfører ikke auto-innkjøp/produksjon, se `app/api/admin/operations-tower/route.ts:326-404`.
- OrdersTable har CSV download via `/api/orders/export`; den API-en er ikke auditert her.

## 9. Hva som mangler eller er svakt

Placeholder/halvferdig:

- Oversikt "Aktivitet" er placeholder med "Ingen aktivitet å vise", se `app/admin/page.tsx:405-412`.
- Faktura (CSV) er direkte API-lenke uten forklarende side eller preview, se `app/admin/AdminNav.tsx:40-42`.
- Kontrolltårn inneholder mye simulert/estimatpreget innhold og policytekst, men ikke operativ utførelse, se `app/admin/control-tower/OperationsTowerClient.tsx:461-729`.
- `app/admin/dashboard/**` virker legacy og ikke i toppnav.
- `app/admin/companies`, `audit`, `menus`, `kitchen-test`, `kjokken` ligger under `app/admin` men er ikke company_admin-flate.

Informasjonsarkitektur:

- "Historikk" i nav peker til `/admin/orders`, mens "Aktivitet" peker til `/admin/history`; `/admin/history` har H1 "Historikk", se `app/admin/AdminNav.tsx:42-43` og `app/admin/history/page.tsx:176-183`. Dette er navneforvirring.
- "Økonomi" (`/admin/insights`) og "Faktura (CSV)" overlapper ordre-periode og økonomi, men har helt forskjellig UX.
- "Leveringsgrunnlag", "Uke og bestillbarhet", "Avtale" og Oversikt sin operational brief viser samme avtale/daymap/cutoff-domene i fire ulike former.
- Quick links og relaterte lenker dupliserer toppnav.

Ineffektivitet / query-duplisering:

- Root `/admin` kjører `loadAdminContext()` og `loadCompanyOperationalBrief()` hver page load med `force-dynamic`, se `app/admin/page.tsx:1-4` og `app/admin/page.tsx:206-257`.
- `loadAdminContext()` gjør flere count queries parallelt uten caching utover ubrukte `loadAdminContextCached`, se `lib/admin/loadAdminContext.ts:331-407` og `lib/admin/loadAdminContextCached.ts:1-8`.
- `OrdersTable` gjør tre API-kall per load/status/date endring, se `components/admin/OrdersTable.tsx:155-170`.
- Avtale-fanen server-fetcher egen API via HTTP fra server i stedet for å dele data-loader direkte, se `lib/admin/fetchAgreementPageDataServer.ts:25-46`.
- `fetchAgreementPageDataForAdmin()` brukes også i Leveringsgrunnlag, som samtidig henter `loadCompanyOperationalBrief()`, se `app/admin/leveringsgrunnlag/page.tsx:71-78`.
- Dagens brukere og Dagens levering laster samme operative roster, men separat per route, se `app/admin/dagens-brukere/page.tsx:81-86` og `app/admin/dagens-levering/page.tsx:81-86`.

Design-system svakheter:

- Ingen `ds-*` i leste admin-filer.
- Flere sider definerer lokale `SectionCard`, `GhostLink`, `PrimaryLink`, `Tile`, `Kpi` i stedet for én admin primitive.
- Inline styles finnes i `loading.tsx`, `error.tsx` og kontrolltårn progressbar.
- Flere pages bruker full custom background radial gradients i stedet for `AdminPageShell`, f.eks. `app/admin/locations/page.tsx:129-197`, `app/admin/insights/page.tsx:92-115`, `app/admin/history/page.tsx:171-335`, `app/admin/control-tower/page.tsx:83-105`.

Data-lag forskjell fra `/week`:

- `/week` bruker trolig felles agreement helpers; i denne auditen er direkte `/week` ikke lest, men admin bruker `visibleWeekStarts()` og daymap loaders i `loadCompanyOperationalBrief()`/`loadCompanyWeekBookabilityOverview()`, se `lib/server/admin/loadCompanyOperationalBrief.ts:20-21` og `lib/server/admin/loadCompanyWeekBookabilityOverview.ts:15`.
- `/admin/layout` bruker ikke `getAgreementStatus()` fra `lib/auth/agreementStatus.ts`, se `app/admin/layout.tsx:138-160`.
- `loadCompanyOperationalBrief()` bruker både `agreements` ledger, `company_current_agreement`, daymap og kitchen order loader, se `lib/server/admin/loadCompanyOperationalBrief.ts:196-256`.

## 10. Anbefalt opprydning

Dette er Cursors anbefaling, ikke en implementeringsoppgave.

### 10.1 Bug-fixer (kritisk)

1. Fjern lowercase `"active"` fra `loadOperativeKitchenOrders()` query eller normaliser på en måte som ikke sender ugyldig enum-verdi, se `lib/server/kitchen/loadOperativeKitchenOrders.ts:72-77`.
2. Verifiser alle callers: Oversikt, Dagens brukere, Dagens levering og kjøkken/produksjon.
3. Avklar `company_locations.status`: UI/API bruker `INACTIVE`, mens legacy constraint viser `ACTIVE`/`PAUSED`/`CLOSED`, se `components/admin/LocationsPanel.tsx:35-45`, `app/api/admin/locations/status/route.ts:21-24`, `supabase/migrations/20260201000000_legacy_bootstrap_minimal.sql:82-93`.
4. Fjern eller håndter `DELETED` i `OrdersTable` status-select, siden API bare tillater `ACTIVE`/`CANCELLED`, se `components/admin/OrdersTable.tsx:213-221` og `app/api/admin/orders/route.ts:46-49`.
5. Vurder å bytte `/admin/layout` til `getAgreementStatus()` slik at billing hold og felles avtalesemantikk brukes, se `app/admin/layout.tsx:138-160` og `lib/auth/agreementStatus.ts:48-107`.

### 10.2 Konsolidering

1. Slå sammen "Dagens brukere" og "Dagens levering" til én "Dagens drift" med tabs/segmenter internt, fordi begge bruker `loadCompanyOperativeDayRoster()`.
2. Slå sammen "Leveringsgrunnlag" og "Uke og bestillbarhet" eller gjør "Uke og bestillbarhet" til detaljseksjon under leveringsgrunnlag.
3. La "Avtale" være kontrakt/økonomi/binding read-only, og fjern ledger/snapshot-gjentakelse fra Oversikt eller gjør den til én statuslinje.
4. Gjør "Faktura (CSV)" til underhandling i "Økonomi" eller "Historikk", ikke toppnav-fane.
5. Fjern Quick links fra Oversikt hvis toppnav beholdes, eller erstatt med én primær "Åpne dagens drift".
6. Flytt superadmin/legacy-ruter ut av `app/admin` eller tydelig marker dem som legacy for å unngå at `/admin`-kartet blander roller.

### 10.3 Mobile-first re-design

1. Bytt 13-item wrap-nav til mobile disclosure: 4-5 primærvalg + "Mer", eller role-aware mobile menu.
2. På mobil bør Oversikt vise maks 3 signaler og 1 primær handling før fold: firma status, dagens drift, neste cut-off/levering.
3. Tabeller bør stackes til cards på mobil for Dagens brukere, Dagens levering og Historikk.
4. Kontrolltårn bør flyttes bak progressiv disclosure eller egen desktop-orientert arbeidsflate.
5. Fjern nested cards på Oversikt: Operational brief kan bli én kompakt statusstripe + én "Dagens drift" CTA.

### 10.4 Data-lag opprydning

1. Lag én server-loader for admin agreement/drift som returnerer avtale, daymap, cutoff og order summary én gang.
2. Del loader mellom Oversikt, Leveringsgrunnlag, Uke og Avtale i stedet for HTTP-fetch til egen API fra server.
3. Cache eller memoiser per request der samme context brukes flere ganger; `loadAdminContextCached` finnes, men root bruker `loadAdminContext()` direkte, se `lib/admin/loadAdminContextCached.ts:1-8` og `app/admin/page.tsx:206-211`.
4. Reduser `OrdersTable` fra tre API-kall til én endpoint-respons med table rows + active/cancelled counts.
5. Standardiser all company_admin API-gating på `routeGuard` og fjern eldre page-local rolleberegning i `/admin/orders`, `/admin/dashboard`, superadmin legacy pages.
6. Bruk `getAgreementStatus()` i layout og operative gates for avtale/billing-hold-paritet med `/week`.

## 11. Kort konklusjon

`/admin` er ikke én flate, men en blanding av company_admin command center, operative dagsvisninger, økonomi/AI, legacy dashboard, superadmin-sider og kitchen-test. Den største konkrete feilen er lowercase `"active"` i felles operative order loader. Den største UI-årsaken til "bokser på bokser" er at Oversikt forsøker å vise avtale, drift, ordre, faktura, support, status, invitasjoner og navigasjon samtidig, samtidig som de samme dataene gjentas i egne faner.

Anbefalt retning: hold `/admin` til 4-6 primære konsepter, flytt detaljer under progressive disclosure, og konsolider data-loaderne før UI-opprydding slik at Claude ikke må gjette hvilken kilde som er fasit.
