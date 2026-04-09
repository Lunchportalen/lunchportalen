# CMS Control Plane — Baseline (faktabasert)

**Dato:** 2026-03-29  
**Referanser:** `REPO_DEEP_DIVE_REPORT.md`, `docs/audit/CMS_BOUNDARY_AND_RUNTIME_BOUNDARY_REPORT.md`, `docs/hardening/RESOLVED_BASELINE_ITEMS.md`, `docs/hardening/OPEN_PLATFORM_RISKS.md`, `docs/hardening/DELTA_AUDIT_FROM_BASELINE.md`, `docs/live-ready/LIVE_READY_PUBLISH_AND_CMS_SAFETY.md`, `docs/enterprise-ready/UNCONDITIONAL_ENTERPRISE_LIVE_DECISION.md`, kode: `app/api/backoffice/**`, `lib/cms/**`, `app/api/week/route.ts`.

---

## 1. Hva som faktisk er koblet til CMS / backoffice i dag

| Område | Bevis i repo |
|--------|----------------|
| **Content tree** | `app/api/backoffice/content/tree`, `app/(backoffice)/backoffice/content/_tree` — klassifisert som canonical i CMS-boundary-rapporten. |
| **Sider, varianter, publish** | `app/api/backoffice/content/pages/**`, `variant/publish` — Postgres-basert page-lag + publiseringsflyt. |
| **Media-bibliotek** | `app/api/backoffice/media/**` + `lib/cms/media/**`. |
| **Preview** | `app/(backoffice)/backoffice/preview/[id]`. |
| **Design / blokker** | `lib/cms/**`, stor `ContentWorkspace`-flate under `app/(backoffice)/backoffice/content/_components/`. |
| **AI-assistert redigering (CMS)** | `app/api/backoffice/ai/**`, paneler i content-workspace (rolle-/superadmin-avhengig). |
| **Sanity** | `studio/`, `@sanity/client`, menyer/måltidstyper og redaksjonell `weekPlan` — **ikke** samme lag som Postgres content pages. |
| **Global innhold / SEO-integrasjon i CMS-flyt** | `lib/cms/publishGlobal.ts`, `mergeSeoIntoVariantBody.ts`, growth-dokumentasjon i phase2. |

---

## 2. Hva som fortsatt lever «ved siden av» CMS (fragmentering)

| Område | Beskrivelse |
|--------|-------------|
| **Operativ kjerne** | Ordre, vinduer, tilgjengelighet: `app/api/order/**`, `lib/week/**` — **ikke** CMS-mutasjon. |
| **Firma / avtaler / profiler** | Primært **Supabase** (`profiles`, `company_current_agreement`, agreements) — eksponert via **admin/superadmin**-APIer, ikke én samlet CMS-«tenant tree». |
| **Growth (Social / SEO / ESG)** | Flere innganger: scripts, dedikerte API-ruter, backoffice/superadmin-flater — **TRANSITIONAL / DUPLICATE-yte** per `CMS_BOUNDARY_AND_RUNTIME_BOUNDARY_REPORT.md`. |
| **Sanity Studio** | Egen livssyklus; `weekPlan`-spor er **redaksjonelt**; employee-runtime er eksplisitt **ikke** `weekPlan` som sannhet (se `GET /api/week`). |
| **Billing / faktura** | `lib/billing/**`, cron — runtime truth, ikke CMS-eid. |

---

## 3. Baseline-problemer som er adressert siden gammel deep-dive

(Kilde: `docs/hardening/RESOLVED_BASELINE_ITEMS.md` + re-verifiserte kodekommentarer.)

1. **Fredagstid for ukesynlighet:** Kode retter seg mot **15:00** Oslo (baseline hadde 14:00 som CONTRADICTION).
2. **Employee `next`-allowlist:** Strammet til **kun** `/week*`-prefiks for employee (baseline tillot flere stier).

**Merk:** `REPO_DEEP_DIVE_REPORT.md` er fortsatt nyttig som **before snapshot**, men tall (f.eks. antall route handlers) kan være historiske — re-tell ved behov.

---

## 4. Åpne plattform-risikoer som fortsatt gjelder

(Kilde: `docs/hardening/OPEN_PLATFORM_RISKS.md` + `docs/enterprise-ready/UNCONDITIONAL_ENTERPRISE_LIVE_DECISION.md`.)

| ID | Tema | Kort |
|----|------|------|
| A1 | Middleware uten rolle | Cookie-sjekk; autoritative gates i layout/API. |
| A2 | Stor APIflate | Inkonsistent gating-risiko på sjeldne ruter. |
| A3 | `strict: false` | Type-svakhet. |
| B1 | «To spor for uke» | Sanity `weekPlan` vs meny/`mealType` — arkitektonisk oppmerksomhet; runtime for ansatt er dokumentert annet sted. |
| D1–D4 | Growth | DRY_RUN, forventning vs batch, ESG tom data, flere CMS-flater. |
| E1–E2 | Worker/cron | Delvise stubs, idempotens/drift. |

---

## 5. Hva som må samles inn under CMS control plane for sømløs opplevelse

**Mål:** CMS som **kontrollplan og redaksjonelt styringslag**, uten å flytte transaksjonell sannhet ut av Postgres der det svekker robusthet.

1. **Én narrativ IA** i backoffice: samme shell (`BackofficeShell` / `TopBar`), tydelig modulnavigasjon slik at firma-relatert innsyn, meny/uke, growth og status ikke føles som «andre apper».
2. **Eksplisitt kobling** company ↔ innhold/design scopes der produktet allerede støtter det (`lib/cms/getProductPlan`, capabilities) — uten ny parallell agreement-sannhet.
3. **Uke/meny:** Redaksjonell publisering og operativ konsum av `menu`/`mealType` må dokumenteres og UI-messig korreleres (se `CMS_WEEK_MENU_PUBLISHING.md` / `CMS_WEEK_RUNTIME_SYNC.md`).
4. **Growth-moduler:** LIVE / LIMITED / DRY_RUN / STUB merket ærlig i UI og docs (review-first).
5. **Enterprise-hardening:** Fail-closed der hull finnes; ingen store refaktorer uten egen mandate.

---

## 6. Konklusjon (baseline)

Systemet har et **reelt** enterprise-CMS-lag (content tree, media, page publish, design) **i samme Next-app** som operativ kjerne. Gapet er **produktopplevd sammenheng** og **ærlig modulstatus**, ikke fravær av CMS-kode. Neste steg er kontrollert konsolidering av flater og dokumenterte sannhetsgrenser — se øvrige filer i denne mappen.
