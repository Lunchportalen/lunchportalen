# Phase 2C0 — Company admin runtime plan (control tower)

**Rolle:** `company_admin` — tenant scope: server-sannhet `profiles.company_id` (AGENTS.md C3).  
**Employee-operativ sannhet:** `/week` — skal ikke endres i 2C0/2C implementasjon som beskrevet her.

## 1. Eksisterende `/admin`-ruter (kartlagt)

Hovedfiler under `app/admin/**` (representativ liste; full liste: søk i repo):

| Område | Rute(r) | Formål |
|--------|---------|--------|
| Dashboard / avtale | `/admin` (`page.tsx`) | KPI, helse, invitasjoner, lenker |
| Nav (minimal) | `AdminNav.tsx` | **Kun** Avtale (`/admin`), Ansatte (`/admin/users`), Historikk (`/admin/orders`) |
| Ansatte | `/admin/users`, `/admin/people`, `/admin/ansatte`, `/admin/employees` | Flere innganger — **IA bør samles** i 2C+ |
| Lokasjoner | `/admin/locations` | Lokasjonsliste |
| Ordre / historikk | `/admin/orders` | Ordrehistorikk (admin-kontekst) |
| Innsikt | `/admin/insights`, `/admin/dashboard` | Metrikker |
| Avtale | `/admin/agreement` | Avtaleinnsyn |
| Bærekraft | `/admin/baerekraft` | ESG-rapporter |
| Historikk / revisjon | `/admin/history`, `/admin/audit` | Audit |
| Kontrolltårn (supply) | `/admin/control-tower` | `OperationsTowerClient`, `loadAdminContext` |
| Invitasjoner / onboarding | `/admin/invite`, `/admin/firma-onboarding`, `/admin/companies` | Onboardingflyt |
| Menyer | `/admin/menus` | Menyadministrasjon |
| Kjøkken-test | `/admin/kitchen-test`, `/admin/kjokken` | Test/klient-sider |

**Obs:** Global navigasjon (`AdminNav`) dekker ikke lokasjoner, faktura, økonomi — disse finnes som ruter men er **ikke** «én tower» ennå.

## 2. Eksisterende API-er (`app/api/admin/**`) — relevante

| Domene | Eksempler på ruter | Status (høy nivå) |
|--------|-------------------|-------------------|
| Scope / me | `me`, `auth`, `dashboard` | Brukes til kontekst |
| Ansatte | `employees/*`, `people`, `users` | Liste, disable, invitasjoner, eksport |
| Lokasjoner | `locations`, `locations/status`, `locations/export`, `locations/audit` | CRUD-aktivitet avhengig av rute |
| Avtale | `agreement`, `agreements`, `agreements/current` | Firmaavtale |
| Ordre / leveranser | `orders`, `deliveries`, `deliveries/status` | Historikk / status |
| Økonomi / innsikt | `insights`, `insight`, `metrics/*`, `demand-insights` | Aggregater |
| Faktura (eksport) | `invoices/csv` | CSV-eksport — **ikke** full fakturamotor i admin-laget |
| ESG | `esg/*` | Rapporter |
| Firma | `company/status/set` | **Sensitiv** — må ikke dupliseres utenfor én flate |
| Støtte | `support/report` | Rapportering |

**Fakturamodell:** B2B / 14-dager forblir som i dag — planen skal **ikke** innføre ny billing-motor i 2C0.

## 3. Produktkrav vs repo (gap-analyse)

| Krav | Finnes | Delvis / UI-only | Mangler / usikkert |
|------|--------|------------------|---------------------|
| **Ansatte** | Ja — flere sider + API | Overlapp `users`/`people`/`employees` | Én klar «tower»-IA |
| **Lokasjoner** | Ja — side + API | — | Ev. sammenheng med control-tower KPI |
| **Økonomi** | Delvis — metrics/insights | Noe kan være dekorativt uten fasit | Avklar «system truth» mot regnskap |
| **Fakturaer** | CSV-eksport + superadmin-fakturaflater | Company admin trenger **lesbar** oversikt | Full fakturavisning avhenger av billing |
| **Avtaleinnsyn** | `agreement` + `agreements/current` | — | Binding-felter i DB? |
| **Oppsigelse / fornyelse** | Usikkert i denne kartleggingen | Mulig kun tekst/lenke | **Krever produkt/juridisk spes** + ev. metadata |
| **Påminnelse 3 mnd før binding** | Ikke sett som ferdig cron | — | **Cron + varsling + datamodell** (høy risiko) |

## 4. Source of truth (kanonisk for company admin)

| Data | Sannhet |
|------|---------|
| Tenant | `profiles.company_id` (server) |
| Kontekst last | `loadAdminContext` / `getAuthContext`-mønster i layouts |
| Ordre / historikk | Eksisterende ordre-API — ikke dupliser tall i parallell cache |
| Avtale | `agreements` / `agreement`-endepunkter — én inngang for mutasjoner |

## 5. Anbefalt retning (uten implementering nå)

1. **Kartlegg consumer map:** én tabell «side → API → risiko» før kode.
2. **Unifiser navigasjon:** én admin-IA med control tower-inngang (allerede `control-tower` + `/admin` dashboard) uten nye ruter hvis mulig.
3. **Ikke** dupliser `company/status/set` eller billing-mutasjoner i flere flater.
4. **Binding / oppsigelse / cron:** egen 2C-del med eksplisitt DB-review — **sist** i sekvens.

## 6. Tester å bygge ut i senere fase (referanse)

- `tests/tenant-isolation-admin-people.test.ts`
- `tests/tenant-isolation-agreement.test.ts`
- `tests/auth/adminOrdersRoleGuard.test.ts`  
Utvid per ny tower-funksjon: tenant A ser aldri B; company_admin ser kun eget selskap.
