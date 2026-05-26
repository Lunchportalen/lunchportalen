# REPO_DEEP_DIVE_REPORT — Lunchportalen

**Generert:** 2026-03-28  
**Metode:** Lesing av kildekode, migrasjoner, konfigurasjon og dokumentasjon i repoet. Ingen kjøring av apper eller endring av kode i denne økten.  
**Språk for påstander:** Hver hovedpåstand er merket **CONFIRMED** (direkte i kode/config), **INFERRED** (rimelig utledet), **MISSING** (ikke funnet), eller **CONTRADICTION** (motstrider referansekrav eller intern konsistens).

---

# 1. Executive summary

## 1.1 Hva systemet faktisk ser ut til å være (**CONFIRMED**)

- **Primær applikasjon:** Én **Next.js 15** App Router-monolitt (`next@15.5.10`, `react@19.2.3`, `package.json` L71–L102).
- **Data:** **Supabase (PostgreSQL)** med migrasjoner under `supabase/migrations/` (151+ `.sql`-filer observert).
- **Sekundær CMS:** **Sanity** (`@sanity/client` i avhengigheter) + eget **Sanity Studio** under `studio/` (skjema bl.a. `weekPlan`, `dish`).
- **Innbygd «enterprise» backoffice/CMS-editor** i samme Next-app: `app/(backoffice)/backoffice/content/` med stor komponentflate (blokkeditor, AI-paneler).
- **Betalingsintegrasjon:** **Stripe** (`stripe` npm-pakke, `lib/saas/billing.ts`, `app/api/saas/billing/webhook/route.ts`). **Ingen** treff på Vipps/Klarna i kodebasen (grep over `*.ts,*.tsx,*.sql,*.md`).

## 1.2 Viktigste arkitektoniske valg (**CONFIRMED**)

| Valg | Bevis |
|------|--------|
| Monolittisk Next.js med tynn middleware | `middleware.ts` — kun cookie-sjekk og redirect til `/login` for «beskyttede» stier (L24–L102). |
| Post-login landing og `next` allowlist på server | `app/api/auth/post-login/route.ts` + `lib/auth/role.ts` `allowNextForRole` / `landingForRole` |
| Multi-lag «plattform» i `lib/` | Svært stor `lib/ai/**` (~698 filer), mange cron-ruter under `app/api/cron/**`, backoffice under `app/(backoffice)/` |
| Kø/worker (valgfri) | `workers/worker.ts`, Redis (`redis` dependency), jobber delvis **stub** (f.eks. `ai_generate` logger kun) |

## 1.3 De 10 viktigste funnene

1. **Order/Week-kjernen** for ansatte er **serverstyrt** via `app/api/order/window/route.ts` med **`lib/week/availability.ts`** for ukesynlighet og **`getMenusByMealTypes`** mot Sanity `menu`-dokumenter — **ikke** en LLM som genererer ukemeny per bruker i denne flyten (**CONFIRMED** fra imports og kall i `window/route.ts` L700–714).
2. **Fredag-grensen for «denne uken»** er kodet som **fredag 14:00**, ikke 15:00 — se `lib/week/availability.ts` L5–L10, L149–L157 og kommentarer. **CONTRADICTION** mot ønsket forretningsregel (15:00) hvis den skal være autoritativ.
3. **Neste uke synlig fra torsdag 08:00** er **eksplisitt implementert** i `lib/week/availability.ts` `nextWeekOpens` (L163–L174) og brukt i `app/api/order/window/route.ts` (L681–682).
4. **Registrering** setter `companies.status: "pending"` og returnerer `status: "pending"` — `app/api/onboarding/complete/route.ts` L603–612, L734–741 (**CONFIRMED**).
5. **Superadmin-aktivering** via RPC `lp_company_activate`: `app/api/superadmin/company/[companyId]/activate/route.ts` L61 (**CONFIRMED**).
6. **14-dagers fakturagrunnlag** finnes som cron + motor: `app/api/cron/invoice-companies/route.ts` L1–3, `lib/billing/invoiceEngine.ts` `biweeklyInvoiceWindowFromToday` L26–30 (**CONFIRMED**). Kommentar sier månedlig Tripletex kan være «primær» i noen miljøer — **INFERRED** drift kompleksitet.
7. **Rollemodell** i kode: `lib/auth/role.ts` type `Role` L5 — `superadmin | company_admin | employee | driver | kitchen` (**CONFIRMED**).
8. **Ansatt `next`-allowlist** inkluderer **`/week`, `/orders`, `/min-side`** — **ikke** kun Week (`lib/auth/role.ts` L33–40). **CONTRADICTION** / **PARTIAL** mot ønsket «kun Week».
9. **APIflate** er stor: **557** `route.ts` under `app/api` (telt 2026-03-28). **INFERRED:** vedlikeholds- og sikkerhetsflate er betydelig.
10. **`typescript` `strict` er av** i `tsconfig.json` (`"strict": false`, L7) — **CONFIRMED** teknisk gjeld / type-svakhet.

## 1.4 De 10 største risikoene / hullene

1. **Fragmentert produkt:** Én forretningskjerne (lunsj/ordre) lever side om side med **hundrevis** av AI/cron/salg-moduler — **INFERRED** operasjonell og kognitiv kostnad (se også `docs/audit/full-system/SYSTEM_ARCHITECTURE_MAP.md` L22).
2. **Ønsket tidsregel (fre 15:00) vs kode (fre 14:00)** — risiko for feil forventning i marked og QA (**CONTRADICTION**).
3. **To parallelle «ukeplan»-spor:** Sanity `weekPlan`-dokument + cron `lock-weekplans` vs order-vindu som henter `menu` per `mealType` — **INFERRED** risiko for desynk og forvirring om «sannhet».
4. **Stripe/SaaS** i tillegg til Tripletex/faktura — **INFERRED** at økonomisk modell kan oppleves som **hybrid**, ikke ren B2B-faktura.
5. **Worker-kø:** delvise **stub**-håndteringer (`workers/worker.ts` L72–L74) — **CONFIRMED** at ikke alt er produksjonsklart uten videre.
6. **Skalerbarhet:** mange synkrone DB-spørringer og bred APIflate uten her dokumentert global rate-limit strategi per rute — **INFERRED** risiko; deler testes (tenant-isolasjon), men ikke full lasttest i denne rapporten.
7. **`strict: false`** — **INFERRED** høyere feilrate ved refaktor og API-kontraktfeil.
8. **Store flater med `any` og fallback** i onboarding (`app/api/onboarding/complete/route.ts` bruker `any` flere steder) — **CONFIRMED** mønster som svekker determinisme.
9. **Sikkerhet:** middleware sjekker kun **cookie finnes**, ikke rolle (**CONFIRMED** `middleware.ts` L86–L102); autoritative sjekker må ligge i layouts/API — **INFERRED** risiko hvis en rute glemmes.
10. **README rot** — `README.md` inneholder nesten ikke dokumentasjon (L1–L4). **MISSING** operatør-onboarding i rot.

## 1.5 Nærhet til ønsket Lunchportalen-modell

| Område | Vurdering |
|--------|-----------|
| Pending registrering + superadmin aktivering | **Høy** treff — eksplisitt i onboarding + activate RPC (**CONFIRMED**) |
| Basis/Luxus, dager, miks | **Implementert** i onboarding priser og `agreement_json` / meal contract — se onboarding og `app/api/order/window/route.ts` tier-logikk (**CONFIRMED** delvis; full sporbarhet krever flere filer) |
| Employee kun Week | **Lav** treff — `allowNextForRole` tillater flere stier (**CONTRADICTION**) |
| AI-generert ukeplan (som forretningskrav) | **Delvis / uklart** — mye AI i CMS/marketing; **employee order-vindu** bruker CMS-meny per måltidstype, ikke dokumentert LLM-ukeplan i `window`-flyten (**CONFIRMED** fra imports) |
| Ukesynlighet tor 08 / fre + overlapp | **Delvis** — tor 08 og overlapp **ja**; **fre 14:00 i kode** vs ønsket 15:00 (**CONTRADICTION**) |
| 14-dagers fakturering | **Implementert** som cron-vindu (**CONFIRMED**); mottaker/ERP er Tripletex-integrasjon der konfigurert — **INFERRED** |
| 50k × 200 ansatte | **Ikke bevist** av denne gjennomgangen — krever DB-indekser, belastningstester, køarkitektur; deler finnes (paginering i cron), men **MISSING** helhetsbevis |
| Umbraco-inspirert CMS | **Delvis** — blokkbasert innhold i DB/backoffice; **ikke** Umbraco-produkt (**CONFIRMED** annen stack) |

---

# 2. Repo map

## 2.1 Toppnivå (utvalg) (**CONFIRMED**)

| Sti | Rolle |
|-----|--------|
| `app/` | Next App Router — sider, `app/api/*` (557 `route.ts`) |
| `lib/` | Domenelogikk, HTTP, CMS-klienter, AI, billing, auth |
| `components/`, `src/components/` | UI — **dobbelt rot** via `tsconfig` paths (`@/components/*` → `./components/*` og `./src/components/*`) |
| `supabase/migrations/` | PostgreSQL schema/RLS |
| `studio/` | Sanity Studio + skjema |
| `tests/` | Vitest (+ Playwright e2e konfig i `package.json`) |
| `docs/` | Omfattende audit-/produkt-dokumentasjon (ikke alltid synk med gjeldende kode — **INFERRED**) |
| `workers/` | Redis-basert worker |
| `scripts/` | CI-guards, SEO, audit, db-verify |
| `archive/` | Arkivert materiale (`archive/README.md` referert) |

## 2.2 Aktivt vs «døde spor» (**INFERRED**)

- **Aktiv kjerne:** `app/api/order/**`, `app/(app)/week/**`, `lib/week/**`, `lib/agreements/**`, `middleware.ts`, `app/api/auth/post-login/route.ts`.
- **Stor eksperimentell/enterprise overflate:** `app/(backoffice)/backoffice/**`, `lib/ai/**`, mange `app/api/cron/*`, `app/api/ai/*` — **INFERRED** mye kan være produksjonskritisk for en underflate (f.eks. CMS), men ikke for kjernelunsj uten kartlegging per rute.
- **`app/api/something/route.ts`** — navn tyder på placeholder / test (**INFERRED**).

---

# 3. Teknologistack og kjøreoppsett

## 3.1 Stack (**CONFIRMED**)

| Lag | Teknologi | Bevis |
|-----|-----------|--------|
| Frontend | Next.js 15, React 19, Tailwind 3 | `package.json` |
| Backend | Next.js Route Handlers (`app/api`) | struktur |
| Database | Supabase/Postgres | `@supabase/ssr`, `@supabase/supabase-js`, migrasjoner |
| CMS | Sanity | `@sanity/client`, `studio/` |
| Cache/queue | Redis (valgfri) | `redis` dep, `lib/infra/redis`, `workers/worker.ts` |
| AI SDK | OpenAI | `openai` package |
| E-post | nodemailer, resend | `package.json` |
| PDF | pdf-lib | `package.json` |
| Betaling | Stripe | `stripe`, `lib/saas/billing.ts` |
| Tester | Vitest, Playwright | `package.json` scripts |

## 3.2 Versjoner (**CONFIRMED**)

- Node: `>=20.11.0` (`package.json` L68–L70)
- Next: `15.5.10`
- TypeScript: `^5.9.3`

## 3.3 Monolitt / headless (**CONFIRMED**)

- **Modulær monolitt:** én deploybar Next-app med mange domener i `lib/` og `app/api/`.
- **Headless CMS:** Sanity for enkelte innholdstyper; **mye** innhold ligger i **Postgres** (`content_pages`, `global_content` — se `docs/audit/full-system/SYSTEM_ARCHITECTURE_MAP.md` L17–L18).

## 3.4 Lokalt og prod (**CONFIRMED** + **INFERRED**)

- **Lokalt:** `npm run dev`, `npm run build`, `npm start` (`package.json`).
- **Enterprise build:** `npm run build:enterprise` — kjeder `agents:check`, `ci:platform-guards`, `audit:*`, `next build`, SEO-scripts (**CONFIRMED**).
- **Docker:** `Dockerfile` — `npm ci`, `npm run build`, `npm start`, port 3000 (**CONFIRMED**). **INFERRED:** krever build-time env som i prod.
- **Worker:** `npm run worker:queue` → `workers/worker.ts` (**CONFIRMED**).

---

# 4. Arkitektur i praksis

## 4.1 Runtime-flyt (forenklet) (**CONFIRMED**)

1. **Browser** → `middleware.ts`: hvis sti er «beskyttet» og mangler `sb-access-token` → redirect `/login?next=...` (L89–L99).
2. **Innlogging** → klient POST til `/api/auth/post-login` → setter cookies / redirect etter `allowNextForRole` (`lib/auth/role.ts`).
3. **Beskyttede sider** → layout/route handlers bruker `getAuthContext` (`lib/auth/getAuthContext.ts`) med DB-oppslag / cache (`lib/cache/authCache.ts` import L8).

## 4.2 Dataflyt — bestilling (**CONFIRMED**)

`EmployeeWeekClient` → `GET /api/order/window` → Supabase (ordre, profil, selskap) + Sanity (`getMenusByMealTypes`) + avtale JSON (`companies.agreement_json`).

## 4.3 CMS-lag vs operativ kjerne (**INFERRED**)

- **Grense:** Publisert markedsinnhold og globale header-data (`getGlobalHeader`, `content`-API) vs **ordre/tenant-sannhet** i Postgres.
- **Risiko:** Samme repo inneholder **begge** — «CMS»-AI og salgs-autonomi kan visuelt forveksles med driftskjerne (**INFERRED**).

---

# 5. Domenemodell

## 5.1 Sentrale entiteter (tabell)

| Entitet | Beskrivelse | Viktige felter (observert) | Relasjoner | Evidence |
|---------|-------------|----------------------------|------------|----------|
| `companies` | Tenant / firma | `status` (pending/active/…), `agreement_json`, `billing_hold` | → `profiles`, `orders`, `agreements` | `app/api/onboarding/complete/route.ts` insert; `app/(app)/week/page.tsx` select |
| `profiles` | Bruker↔firma | `company_id`, `location_id`, `role`, `is_active` | → auth user | `getAuthContext`, onboarding sync |
| `agreements` / `company_agreements` | Avtale-ledger | status, tier, dager, pris | → company | `lib/billing/invoiceEngine.ts`, superadmin routes |
| `orders` | Daglig bestilling | `date`, `status`, `company_id` | → company, user | `invoiceEngine.ts` L42–50 |
| Sanity `menu` | Meny per meal type | `mealType`, innhold | brukt av `getMenusByMealTypes` | `lib/cms/getMenusByMealTypes.ts` L14–25 |
| Sanity `weekPlan` | Ukeplan-dokument | `weekKey`, `days[]`, låsefelt | referanser til `dish` | `studio/schemas/weekPlan.ts` |

## 5.2 Manglende / uklare domeneobjekter (**MISSING** / **INFERRED**)

- **Én entydig «Invoice» per firma per periode** som forretningsobjekt — delvis dekket av cron + Tripletex; **klar domene-modell må utledes** fra `lib/billing` og `lib/integrations` (**INFERRED**).
- **Købasert ordreplinje** for ekstrem skala — **ikke** fullt dokumentert her (**MISSING** i forhold til 50k tenants).

---

# 6. Roller, auth og tilgangskontroll

## 6.1 Identitet (**CONFIRMED**)

- Supabase Auth JWT i cookie `sb-access-token` (middleware L86).
- `getAuthContext` kombinerer session med **profil** og ev. **system allowlist** e-post (`lib/auth/getAuthContext.ts` L11, `systemRoleByEmail`).

## 6.2 Roller (**CONFIRMED**)

`lib/auth/role.ts` L5–14 — faste strenger.

## 6.3 Layout-guards (eksempler) (**CONFIRMED**)

- `app/superadmin/layout.tsx` — krever `auth.role === "superadmin"` (grep-resultat).
- `app/admin/layout.tsx` — company_admin vs superadmin (grep).
- `app/(portal)/layout.tsx` — kun `employee` eller `company_admin` (L31–L33, L73–L75).

## 6.4 Employee «kun Week» (**CONTRADICTION**)

- `allowNextForRole` for employee tillater `/week`, `/orders`, `/min-side` — `lib/auth/role.ts` L33–40.
- Middleware beskytter også `/orders` eksplisitt — `middleware.ts` L31.

## 6.5 Gap mot ønsket modell

| Krav | Status |
|------|--------|
| Employee kun Week | **PARTIAL** — kode tillater mer i `next`-allowlist |
| Superadmin separert | **CONFIRMED** egne layouts/API |
| Server-side sannhet for tenant | **CONFIRMED** mønster i API (scope guards i `lib/http/routeGuard` — brukt i admin routes) |

---

# 7. Registrering, pending og godkjenning

## 7.1 Flyt (**CONFIRMED**)

1. `POST /api/onboarding/complete` oppretter `companies` med `status: "pending"` (L603–612).
2. Oppretter auth-bruker (company_admin) (L619–631).
3. Synker `profiles` med `is_active: false` (L308–317, L637–639).
4. Returnerer JSON `status: "pending"` (L734–741).

## 7.2 Aktivering (**CONFIRMED**)

- `POST /api/superadmin/company/[companyId]/activate` → RPC `lp_company_activate` (L61).

## 7.3 Invitasjoner etter aktivering (**CONFIRMED**)

- `app/api/admin/invite/route.ts`, `employee_invites` tabell (grep), `app/admin/invite/actions.ts`.

## 7.4 Avtale-godkjenning (ledger) (**CONFIRMED**)

- `app/api/superadmin/agreements/[agreementId]/approve/route.ts`, `reject/route.ts` med `runLedgerAgreementApprove` — superadmin-roller.

---

# 8. Avtaler, abonnement og prislogikk

## 8.1 Prisnivå (**CONFIRMED**)

- Onboarding: `priceExVatForTier` — **90 / 130 eks mva** for BASIS vs LUXUS (`app/api/onboarding/complete/route.ts` L77–80).

## 8.2 Miks per dag (**CONFIRMED**)

- `AgreementDay` per ukedag med `tier` (`app/api/onboarding/complete/route.ts` L15–25).
- Order-vindu: `dayTiers` fra avtale-state (`app/api/order/window/route.ts` — `buildDayModel` path).

## 8.3 Hvem endrer avtale (**CONFIRMED** / **INFERRED**)

- **Superadmin:** omfattende mutasjons-API under `app/api/superadmin/agreements/**`.
- **Company admin:** `GET` lesing `app/api/admin/agreement/route.ts` `requireRoleOr403(..., ["company_admin", "superadmin"])` (L193) — **ingen** `POST` i samme fil observert (fil ender med GET-handler).

---

# 9. Week-siden og uke-/synlighetslogikk

## 9.1 UI (**CONFIRMED**)

- `app/(app)/week/page.tsx` — serverkomponent som sjekker rolle, `requireActiveAgreement`, company status, rendrer `EmployeeWeekClient`.
- Metadata sier avbestilling stenger 08:00 (L18–L21).

## 9.2 API (**CONFIRMED**)

- `EmployeeWeekClient` konsumerer `/api/order/window` (filkommentar `page.tsx` L1; client L21).

## 9.3 Synlighetsregler (**CONFIRMED**)

| Regel | Implementasjon |
|-------|----------------|
| Neste uke fra torsdag 08:00 | `lib/week/availability.ts` `nextWeekOpens` L163–174 |
| Denne uke skjules etter fredag | `isAfterFriday1400` — **14:00** L149–157 |
| Overlapp | `visibleWeekStarts` legger til begge uker når betingelser er oppfylt L218–227 |

**CONTRADICTION:** Ønsket forretningsregel sa fredag **15:00** — kode bruker **14:00** (også Sanity-skjema felt-tittel «fredag 14:00» `studio/schemas/weekPlan.ts` L66–69).

## 9.4 AI for ukemeny i denne flyten (**MISSING** som LLM-generering)

- `window` henter **meny-dokumenter** fra Sanity basert på **meal type** fra avtale — se `getMenusByMealTypes` (L700–714 i window route). **Ikke** påvist at `openai` kalles fra `window/route.ts` i lest utdrag.

---

# 10. Ansattflyt

## 10.1 Hva ansatte kan (**CONFIRMED**)

- Bestille/avbestille via API-er under `app/api/order/*` med cutoff 08:00 (f.eks. `set-day/route.ts`, `cancel/route.ts` — grep «08:00»).

## 10.2 Andre skjermer (**CONTRADICTION**)

- Post-login allowlist inkluderer **`/orders`** og **`/min-side`** (`lib/auth/role.ts` L33–40).
- `(portal)` layout tillater både employee og company_admin — men routing avhenger av hvilke ruter som ligger under `(portal)` (kun `layout.tsx` funnet — **INFERRED** begrenset bruk).

---

# 11. Super admin-flater og operativ drift

## 11.1 Flater (**CONFIRMED** fra struktur)

- `app/superadmin/**` — selskaper, faktura, system, agreements, brukere, osv.
- API: `app/api/superadmin/**` — mange moduler.

## 11.2 Endringsrettigheter (**CONFIRMED**)

- Firma status — `app/api/superadmin/companies/set-status/route.ts`.
- Aktivering — `company/[companyId]/activate`.
- Brukere — `app/api/superadmin/users/*`, `delete`, `disable`, etc.

---

# 12. CMS og blokkbygging

## 12.1 Umbraco-lignende mønstre (**CONFIRMED**)

- Blokkbaserte sider i DB (`content_pages` — dokumentert i `SYSTEM_ARCHITECTURE_MAP.md` L17).
- Backoffice workspace: `app/(backoffice)/backoffice/content/_components/` — stor mengde `ContentWorkspace*` filer.

## 12.2 Sanity Studio (**CONFIRMED**)

- `studio/schemas/weekPlan.ts` — strukturert ukeplan med validering (5 dager, unike datoer) L138–146.

## 12.3 Blanding av domene og CMS (**INFERRED**)

- Samme repo håndterer **marketing CMS** og **operativ lunsj** — krever disiplin for ikke å blande forretningslogikk inn i presentasjonsblokker.

---

# 13. AI i CMS / AI-funksjoner

## 13.1 Omfang (**CONFIRMED**)

- `lib/ai/**` — **698** filer (glob-telling).
- Mange API-ruter: `app/api/ai/**`, `app/api/backoffice/ai/**`, `app/api/cron/*` (AI-relaterte).

## 13.2 Bruksområder observert (**CONFIRMED** utvalg)

- CMS-hjelp: `app/api/backoffice/ai/cms-menu/route.ts` (grep viser basis/luxus).
- Design/SEO: `app/api/backoffice/ai/design-optimizer/apply/route.ts`, `seo-intelligence`, etc.
- **OpenAI-klient:** `lib/ai/getClient.ts` (typisk mønster — ikke dybdelest her).

## 13.3 Robusthet (**INFERRED**)

- **Governance scripts** i CI: `npm run ai:check`, `check:ai-internal-provider` — indikerer bevisst kontroll; **ikke** garanti for alle paths.

---

# 14. Fakturering og betalingsmodell

## 14.1 Stripe (**CONFIRMED**)

- SaaS-flyt: `lib/saas/billing.ts`, webhooks `app/api/saas/billing/webhook/route.ts`.
- UI: `app/saas/billing/SaasBillingClient.tsx` (grep).

## 14.2 Vipps/Klarna (**MISSING**)

- Ingen treff i repo på vipps/klarna (grep utført).

## 14.3 14-dagers fakturagrunnlag (**CONFIRMED**)

- `app/api/cron/invoice-companies/route.ts` — kommentar L1–3.
- `lib/billing/invoiceEngine.ts` — vindu siste 14 dager L26–30.

## 14.4 Tripletex (**CONFIRMED**)

- `lib/integrations/tripletexEngine` referert fra `lib/ai/revenueEngine.ts` og `lib/billing/invoiceEngine.ts` (grep tidligere).

---

# 15. API-er, integrasjoner og eksterne avhengigheter

## 15.1 Interne API-er (**CONFIRMED**)

- **557** `route.ts` under `app/api` (PowerShell-telling).

## 15.2 Eksterne (**CONFIRMED** fra kode / deps)

| Tjeneste | Bruk |
|----------|------|
| Supabase | Auth + DB |
| Sanity | CMS fetch/write |
| OpenAI | AI features |
| Stripe | Billing |
| Redis | Kø/idempotens (valgfri) |
| Resend / nodemailer | E-post |
| Tripletex | ERP/faktura (konfigurasjonsavhengig) |

## 15.3 Cron (**CONFIRMED** utvalg)

- `app/api/cron/invoice-companies`, `week-visibility`, `lock-weekplans`, `system-motor`, mange flere — **INFERRED** tung operasjonell overflate.

---

# 16. Databaser, migrasjoner og vedvarende lagring

## 16.1 Database (**CONFIRMED**)

- PostgreSQL via Supabase — `supabase/migrations/*.sql` (151+ filer).

## 16.2 Sentrale tabeller (**CONFIRMED** brukt i kode)

- `companies`, `profiles`, `orders`, `agreements`, `employee_invites`, `outbox` — fra siterte filer.

## 16.3 Skaleringsrisiko (**INFERRED**)

- Cron som itererer alle companies i batches (500) — `invoice-companies/route.ts` L50–70 — kan bli treg ved svært mange firma uten shard/partition strategi.
- **MISSING** i denne rapporten: full indeksgjennomgang.

---

# 17. Ytelse, skalering og driftsevne

| Tema | Vurdering |
|------|-----------|
| 50 000 firma × 200 ansatte | **Ikke verifisert** — ingen bevis i denne rapporten for horisontal skalering, lesereplikaer eller tenant-sharding |
| N+1 | **INFERRED** risiko i enkelte API-er uten profiling |
| Køer | Redis + worker finnes; deler **stub** |
| Tenant-isolasjon | Tester finnes (`tests/tenant-isolation*.test.ts`, `tests/rls/**`) — **CONFIRMED** at det er et mål |

---

# 18. Sikkerhet og personvern

## 18.1 Middleware (**CONFIRMED**)

- Sjekker ikke roller — kun cookie — `middleware.ts` L86–88.

## 18.2 API (**INFERRED**)

- `requireRoleOr403`, `scopeOr401` brukt i admin/superadmin — **må** være konsistent på alle ruter (**risiko** ved glipp).

## 18.3 GDPR (**CONFIRMED**)

- Ruter som `app/api/user/gdpr/export/route.ts`, `delete` — eksisterer i fil-liste.

---

# 19. Testing og kvalitet

## 19.1 Dekning (**CONFIRMED** tilstedeværelse)

- Auth: `tests/auth/post-login-api.test.ts`, `postLoginRedirectSafety.test.ts`
- Order: `tests/api/order-flow-api.test.ts`, `order-window-dayModel.test.ts`
- Billing: `tests/billing/invoiceEngineWindow.test.ts`
- AI: mange `tests/ai/*.test.ts`
- Tenant: `tests/tenant-isolation.test.ts`, `tests/rls/**`

## 19.2 Mangler (**INFERRED**)

- E2E-dekning ukjent uten å kjøre Playwright — **MISSING** i denne rapporten.
- `strict: false` — svekker statisk garanti.

## 19.3 TODO / hacks (**INFERRED**)

- Stor kodebase — ikke systematisk scannet for `TODO` i denne økten.

---

# 20. Gap-analyse mot ønsket Lunchportalen-modell

| Krav | Status | Evidence | Kommentar |
|------|--------|----------|-----------|
| Pending ved firmaregistrering | **Implemented** | `onboarding/complete` L603–612, L734–741 | |
| Super admin-godkjenning før aktivering | **Implemented** | `activate/route.ts` L61 + `is_active: false` onboarding | Profil inaktiv til aktivert |
| Company admin inviterer etter godkjenning | **Implemented** | `admin/invite`, `employee_invites` | Avhengig av faktisk firma-status i praksis |
| Ansatte kun Week | **Partial / Contradiction** | `lib/auth/role.ts` L33–40 | Tillater `/orders`, `/min-side` |
| AI-generert ukeplan | **Unclear / Partial** | `window` bruker Sanity `menu` | Ikke dokumentert LLM i order-vindu |
| Company admin velger dager ved registrering | **Implemented** | Onboarding `AgreementDays` | |
| Company admin velger abonnement/nivå ved registrering | **Implemented** | `PlanTier`, priser 90/130 | |
| Miks basis/luxus | **Implemented** | Onboarding + `dayTiers` i window | |
| Kun super admin kan endre avtale | **Partial** | Superadmin mutations; company admin GET på agreement | Avhengig av at alle mutasjons-API-er er korrekt gated |
| Kun super admin kan slette firma/brukere | **Partial** | Superadmin delete routes; verifiser company_admin ikke kan | Krever full audit av admin/user-delete |
| Ukesynlighet tor 08 / fre overlapp | **Partial** | `availability.ts` | **Fre 14:00 i kode vs 15:00 ønsket** |
| 14-dagers fakturering til company admin | **Implemented** | `invoice-companies`, `invoiceEngine` | Tripletex/Stripe kompleksitet |
| Ingen Vipps/Klarna | **Implemented** (ingen kode) | grep tom | Stripe finnes likevel |
| Umbraco-/blokkinspirert CMS | **Partial** | Backoffice + DB content | Ikke Umbraco-produkt |
| Skalerbarhet 50k × 200 | **Unclear** | — | Ikke bevist |
| AI i CMS-et | **Implemented** | `app/api/backoffice/ai/*`, `lib/ai/*` | Omfang stort |

---

# 21. Konkrete kodehotspots (prioritert)

| Rang | Fil | Hvorfor viktig | Hva den avslører |
|------|-----|----------------|-------------------|
| 1 | `middleware.ts` | Auth-grense | Cookie-only gate |
| 2 | `app/api/auth/post-login/route.ts` | Landing | `safeNextPath`, roller |
| 3 | `lib/auth/role.ts` | RBAC for next | Employee-ruter tillatt |
| 4 | `lib/auth/getAuthContext.ts` | Server auth | Profil + rolle |
| 5 | `app/api/onboarding/complete/route.ts` | Livssyklus | Pending, priser, profiler |
| 6 | `app/api/superadmin/company/[companyId]/activate/route.ts` | Aktivering | RPC |
| 7 | `lib/week/availability.ts` | Ukesynlighet | Tor 08, fre 14 |
| 8 | `app/api/order/window/route.ts` | Kjerne UI-data | Meny, uker, tiers |
| 9 | `app/(app)/week/page.tsx` | Week UI | Agreement-krav |
| 10 | `app/(app)/week/EmployeeWeekClient.tsx` | Brukeropplevelse | API-konsum |
| 11 | `lib/billing/invoiceEngine.ts` | Faktura | 14-dagers vindu |
| 12 | `app/api/cron/invoice-companies/route.ts` | Drift | Batch alle companies |
| 13 | `lib/saas/billing.ts` | Stripe | SaaS-modell |
| 14 | `studio/schemas/weekPlan.ts` | CMS ukeplan | Redaksjonell modell |
| 15 | `app/api/cron/lock-weekplans/route.ts` | Låsing | Sanity weekPlan |
| 16 | `workers/worker.ts` | Kø | Stub-jobs |
| 17 | `supabase/migrations/*.sql` | Schema | Sannhet på DB-nivå |
| 18 | `app/api/superadmin/companies/set-status/route.ts` | Drift | Status enum |
| 19 | `lib/http/routeGuard.ts` | API sikkerhet | scope/role |
| 20 | `package.json` | Verktøykjede | build:enterprise |
| 21 | `docs/audit/full-system/SYSTEM_ARCHITECTURE_MAP.md` | Arkitektur | Ærlig beskrivelse av fragmentering |
| 22 | `app/api/admin/agreement/route.ts` | Admin avtale | Lesing for company_admin |
| 23 | `lib/cms/getMenusByMealTypes.ts` | Menykilde | Sanity query |
| 24 | `app/api/cron/week-visibility/route.ts` | Synlighet | Sanity menuContent |
| 25 | `tsconfig.json` | Kvalitet | `strict: false` |

---

# 22. Konklusjon

## 22.1 Hva repoet egentlig er i dag (**CONFIRMED** + **INFERRED**)

Et **enterprise-tungt** norsk B2B-lunsjprodukt bygget som **én Next.js-monolitt** med **Supabase** som autoritativ driftsdatabase, **Sanity** for deler av innhold, og en **svært stor** sekundærflate for AI, growth og backoffice-CMS.

## 22.2 Nær ønsket mål

- **Sterk treff:** pending onboarding, superadmin-aktivering, basis/luxus + dager, mye av ukesynlighet (torsdag 08), 14-dagers fakturagrunnlag-cron, omfattende admin/superadmin.

## 22.3 Feil retning / avvik

- **Fredag 14:00 vs 15:00** i kjernelogikk.
- **Employee-routing** tillater mer enn Week i `allowNextForRole`.
- **Økonomi:** Stripe/SaaS ved siden av Tripletex/faktura — kan være riktig fordeling, men **ikke** «ren» faktura-modell uten videre.

## 22.4 Hva som bør avklares først (**INFERRED**)

1. **Én autoritativ definisjon** av «ukeplan» (Sanity `weekPlan` vs `menu`+`agreement_json` vs eventuell LLM).
2. **Rettskriving** av fredag cut-off (14 vs 15) på tvers av `lib/week`, Sanity-skjema og kommunikasjon.
3. **Employee navigasjon** vs forretningskrav (kun Week).

## 22.5 Best gjennomført (**INFERRED**)

- **Deterministisk ukesynlighet** i `lib/week/availability.ts` (klart skrevet, testbar).
- **Onboarding** med eksplisitte priser og pending-status.
- **Enterprise CI** (`build:enterprise`) som viser modenhetstenkning.

## 22.6 Ærlig totalvurdering

Repoet er **funksjonelt rikt på kapabilitet**, men **arkitektonisk krevende**: høy flateareal (500+ API-ruter, ~700 AI-filer), **svak TypeScript-strictness**, og **flere parallelle spor** for menyer/ukeplan. Det **matcher delvis** den ønskede forretningsmodellen, men **ikke punktvis** på ansatt-navigasjon og fredagstid. Uten lasttest og domene-avklaringer er **50k tenants** et **mål**, ikke en observerbar egenskap i koden alene.

---

# VEDLEGG A – BEVISREGISTER (utdrag)

| Filsti | Linje / symbol | Funn | Seksjon |
|--------|----------------|------|---------|
| `package.json` | L71–L101 | next, react, supabase, sanity, stripe, openai, redis | §3 |
| `middleware.ts` | L24–34, L86–99 | Beskyttede stier, cookie redirect | §4, §18 |
| `lib/auth/role.ts` | L17–41 | landing + employee allowlist | §6, §20 |
| `app/api/onboarding/complete/route.ts` | L603–612, L734–741 | pending company + response | §7, §20 |
| `app/api/superadmin/company/[companyId]/activate/route.ts` | L61 | `lp_company_activate` | §7 |
| `lib/week/availability.ts` | L5–10, L149–183 | Regler inkl. fre 14:00, tor 08 | §9, §20 |
| `app/api/order/window/route.ts` | L681–714, L700–714 | `canSeeNextWeek`, meny-fetch | §9 |
| `lib/billing/invoiceEngine.ts` | L26–30 | 14-dagers vindu | §14 |
| `app/api/cron/invoice-companies/route.ts` | L1–3, L46–66 | Biweekly cron, loop companies | §14, §17 |
| `studio/schemas/weekPlan.ts` | L66–69 | «fredag 14:00» label | §9 |
| `workers/worker.ts` | L49–74 | Stub jobs | §3, §17 |
| `tsconfig.json` | L7 | `"strict": false` | §19 |
| `docs/audit/full-system/SYSTEM_ARCHITECTURE_MAP.md` | L1–22 | Arkitektur-karakteristikk | §1, §12 |

---

# VEDLEGG B – KODEUTDRAG

## B.1 Middleware (cookie-gate)

```65:102:middleware.ts
export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  // ...
  const accessToken = req.cookies.get("sb-access-token")?.value;
  res.headers.set("x-lp-mw-user", accessToken ? "1" : "0");

  if (!accessToken) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.search = "";
    u.searchParams.set("next", buildNextParam(pathname, searchParams));
    const redir = NextResponse.redirect(u, { status: 303 });
    // ...
    return redir;
  }

  return res;
}
```

## B.2 Employee `next` allowlist

```25:41:lib/auth/role.ts
export function allowNextForRole(role: Role, nextPath: string | null): string | null {
  if (!nextPath) return null;

  if (role === "superadmin") return nextPath.startsWith("/superadmin") ? nextPath : null;
  if (role === "company_admin") return nextPath.startsWith("/admin") ? nextPath : null;
  if (role === "driver") return nextPath.startsWith("/driver") ? nextPath : null;
  if (role === "kitchen") return nextPath.startsWith("/kitchen") ? nextPath : null;

  // employee allowlist (E5: week + orders + profile surface)
  if (
    nextPath.startsWith("/week") ||
    nextPath.startsWith("/orders") ||
    nextPath.startsWith("/min-side")
  ) {
    return nextPath;
  }
  return null;
}
```

## B.3 Pending onboarding

```603:612:app/api/onboarding/complete/route.ts
    const insCompany = await SB.from("companies")
      .insert({
        name: company_name,
        orgnr,
        status: "pending",
        plan_tier: dominantTier,
        employee_count,
        agreement_json,
      })
      .select("id")
      .single();
```

## B.4 Ukesynlighet (fredag 14:00 / torsdag 08)

```149:183:lib/week/availability.ts
export function isAfterFriday1400(now: Date) {
  const p = osloParts(now);

  // Weekend must be treated as "after Friday"
  if (p.weekday === 6 || p.weekday === 0) return true;

  // Friday after 14:00
  return p.weekday === 5 && hhmmToMin(p) >= 14 * 60;
}

export function nextWeekOpens(now: Date) {
  const p = osloParts(now);

  if (p.weekday === 5 || p.weekday === 6 || p.weekday === 0) return true;

  // Thursday from 08:00
  if (p.weekday === 4) return hhmmToMin(p) >= 8 * 60;

  return false;
}

export function canSeeNextWeek(now: Date) {
  return nextWeekOpens(now);
}
```

## B.5 14-dagers fakturavindu

```26:30:lib/billing/invoiceEngine.ts
export function biweeklyInvoiceWindowFromToday(): { periodStart: string; periodEndExclusive: string } {
  const endExclusive = osloTodayISODate();
  const periodStart = addDaysISO(endExclusive, -14);
  return { periodStart, periodEndExclusive: endExclusive };
}
```

## B.6 Order-vindu: neste uke + menyhenting

```681:714:app/api/order/window/route.ts
    const openNextWeek = canSeeNextWeek(now);
    const thisWeekStartISO = isoFromDateOsloWall(weekStartMon(now));
    const nextWeekStartISO = addDaysISO(thisWeekStartISO, 7);
    // ...
    const [{ data: compJsonRow }, ppBasis, ppLuxus] = await Promise.all([
      admin.from("companies").select("agreement_json").eq("id", sc.company_id).maybeSingle(),
      getProductPlan("basis"),
      getProductPlan("luxus"),
    ]);
    const mealContract = parseMealContractFromAgreementJson((compJsonRow as any)?.agreement_json);
    const productPlans = { BASIS: ppBasis, LUXUS: ppLuxus };
    const mealKeys = new Set<string>();
    for (const k of ppBasis?.allowedMeals ?? []) mealKeys.add(normalizeMealTypeKey(k));
    for (const k of ppLuxus?.allowedMeals ?? []) mealKeys.add(normalizeMealTypeKey(k));
    if (mealContract?.plan === "basis") mealKeys.add(normalizeMealTypeKey(mealContract.fixed_meal_type));
    if (mealContract?.plan === "luxus") {
      for (const v of Object.values(mealContract.menu_per_day)) mealKeys.add(normalizeMealTypeKey(v));
    }
    const menuByMealType = await getMenusByMealTypes([...mealKeys]);
```

## B.7 Sanity CMS `weekPlan` (redaksjonelt)

```58:70:studio/schemas/weekPlan.ts
    defineField({
      name: "becomesCurrentAt",
      title: "Blir aktiv uke (fredag 14:00)",
      type: "datetime",
      readOnly: true,
    }),
```

## B.8 AI-worker stub

```49:74:workers/worker.ts
async function runTypedJob(job: JobEnvelope): Promise<void> {
  switch (job.type) {
    case "retry_outbox": {
      // ... fetch /api/cron/outbox
      return;
    }
    case "send_email":
      logLine({ kind: "send_email_stub", deliveryId: job.deliveryId });
      return;
    case "ai_generate":
      logLine({ kind: "ai_generate_stub", deliveryId: job.deliveryId });
      return;
```

---

*Slutt på rapport.*
