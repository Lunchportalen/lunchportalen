# Whole Repo Audit Report

**Repository:** Lunchportalen (`c:\prosjekter\lunchportalen`)  
**Audit utført:** 2026-03-27  
**Metode:** Statisk kartlegging (git, grep, glob), dybdelesing av kritiske stier, kjøring av typecheck/lint/test/sanity:live/build (se `COMMANDS_RUN_AND_RESULTS.md`).

---

## 1. Executive summary

Dette er **ikke** en sømløs, konsentrert enterprise-CMS-plattform på nivå med Umbraco — det er en **Next.js-monolitt** med en **klar kjerneforretning** (lunsj, ordre, tenant) som er **oversvømmet** av **parallell plattformvekst**: **295 filer i `lib/ai` alene**, **314 API-ruter**, og en **CMS-editor på ~6400 linjer i én fil**. Sterke sider finnes: **RLS-migreringer**, **omfattende Vitest** (1133 tester grønne), **strukturert HTTP/RID-respons** (`lib/http/respond.ts`), og **enterprise CI** (`ci-enterprise.yml` med hemmeligheter og gates). Svak siden dominerer: **arkitektonisk koherens**, **vedlikeholdbarhet**, og **redaksjonell modenhet** — ikke fordi enkeltkomponenter er "dårlige", men fordi **systemet har vokst uten tilstrekkelig plattformdisiplin**. **Lokal `next build` feilet med heap OOM** (exit 134) — operasjonell risiko. **Konklusjon:** Mot målet "sømløs, robust, konsistent plattformkvalitet" er prosjektet **underkjent**. Typecheck og tester passerer, men **plattformmodenhet** er **strukturelt** begrenset.

---

## 2. Scope og metode

| Område | Dekket |
|--------|--------|
| Frontend (App Router) | Ja — `app/` 624 filer |
| Backoffice/CMS | Ja — særlig `app/(backoffice)/backoffice/content/` |
| API | Ja — 314 `route.ts` |
| Database | Ja — `supabase/migrations` (stikkprøver + `global_content`) |
| Auth | Ja — `middleware.ts`, `app/api/auth/post-login/route.ts` |
| CI/CD | Ja — `.github/workflows`, `package.json` scripts |
| Sanity | Ja — `lib/sanity/client.ts`, `studio/` |
| Tester | Ja — kjørt `npm run test:run` |
| E2E | **Nei** — ikke kjørt (krever server) |

**Filer i repo:** **1892** sporet (git). **TS/JS:** **1504**.  
**Analyse:** Full tre-inventar + målrettet dybdelesing; **ikke** bokstav-for-bokstav av alle filer.

**Ikke verifisert:** Full `build:enterprise` lokalt; Playwright E2E; produksjonslast; full a11y-audit; alle RLS-baner under runtime.

---

## 3. Arkitekturoversikt

**Faktisk byggestein:** Én Next.js-app med Supabase som primær database og et **innebygd** backoffice for innhold (ikke separat Umbraco-lignende shell). **Sanity** er til stede som klient og **studio**-mappe, men **hoved-CMS for markedsinnhold** er **PostgreSQL-basert** (`content_*`, `global_content`, `jsonb`).

**Domener (faktisk):**

1. **Kjerne:** Ordre, uke, kjøkken, sjåfør, onboarding — **koblet til** `profiles.company_id`.
2. **Admin/superadmin:** Firma, avtaler, fakturagrunnlag, system — **frozen flows** i AGENTS.md.
3. **CMS/markedsinnhold:** Blokker, sider, globale innholdsrekker — **stor React-komponent** + mange API-ruter.
4. **Parallell "AI/growth/sales" plattform:** `lib/ai` + titalls API-ruter — **konkurrerende** med kjerne-CMS om oppmerksomhet.

**Koblingsproblem:** **Ingen knapp arkitekturgrense** mellom kjerne og eksperimentell flate — alt lever i samme repo, samme bundler, samme kognitiv overflate.

---

## 4. Kritiske flyter ende-til-ende

| Flyt | Implementasjon | Hovedfiler | Svakhet |
|------|----------------|------------|---------|
| Auth gate | Cookie `sb-access-token` i middleware; redirect til `/login` | `middleware.ts` | OK for "innlogget ja/nei"; roller **ikke** i middleware (designvalg) |
| Post-login | `POST /api/auth/post-login` + `safeNextPath` | `app/api/auth/post-login/route.ts` | Eksperiment-cookie i samme bane |
| CMS edit | Massiv klient + `app/api/backoffice/content/**` | `ContentWorkspace.tsx` | **Monolitt** |
| Publish/preview | Tester for parity | `tests/cms/publicPreviewParity.test.ts` | `@ts-nocheck` |
| Global header | `global_content` draft/published | Migrering `20260421000000_global_content.sql` | **RLS åpner for authenticated** — må verifiseres mot faktisk klient |

---

## 5. Funn per område

### 5.1 Domene / arkitektur

- **Fragmentert modell:** `jsonb` + blokker + AI-logger + salgs-pipeline — **få harde domenegrenser i kode**.
- **295 `lib/ai`-filer** — **bevis** på at AI er blitt et **parallelt økosystem**, ikke et modulært tillegg.

### 5.2 Frontend

- **`ContentWorkspace.tsx` ~6401 linjer** — **funn:** `Get-Content ... | Measure-Object -Line`.
- ESLint: **mange** `exhaustive-deps` warnings i samme fil (lint-logg) — teknisk gjeld som **ikke** er kosmetisk.

### 5.3 Backend / API

- **314** `app/api/**/route.ts` — **for stor flate** for profesjonell governance uten stor stab.
- `app/api/something/route.ts` — **dårlig navn** + `any` i `ok`/`err` (`data?: any`) — **kontraktsløshet**.

### 5.4 Database / persistens

- **Styrke:** Migreringer, `global_content` med `CHECK` constraints på `key` og `status`.
- **Risiko:** `global_content` RLS lar `authenticated` mutere med brede policies — **se RISK_REGISTER R7**.

### 5.5 Auth / sikkerhet

- **Styrke:** `safeNextPath` blokkerer `/login` loop og `next` til `/api` (`post-login/route.ts` linjer 51–78).
- **Risiko:** Stor APIflate øker sannsynlighet for **enkelt-endepunkt** feil authz.

### 5.6 CMS / editor

- **Under Umbraco-nivå** for **editor UX** — ikke pga. piksler, men pga. **monolitt** og **hook-kaos** (lint).

### 5.7 Performance

- **Build OOM** — `npm run build` heap limit (exit 134) — **blokkerende** for drift på ressurssvake miljøer.
- Mange `<img>` i editor — ESLint warnings.

### 5.8 UX / designsystem / a11y

- **Ikke systematisk verifisert** i denne auditen (krever manuell a11y + mobile matrix per AGENTS.md S1).
- **Indirekte:** `ContentWorkspace` størrelse **motvirker** konsistent UX.

### 5.9 Testing

- **Styrke:** `1133` tester passerte.
- **Svakhet:** `tests/cms/publicPreviewParity.test.ts` bruker `// @ts-nocheck` (linje 7).

### 5.10 CI/CD og drift

- **Styrke:** `ci-enterprise.yml` med hemmeligheter og Node 20.
- **Svakhet:** `lint:ci` i `package.json` er `next lint || exit 0` — **skjuler lint-feil** hvis brukt som "grønn".

---

## 6. Root cause analysis (kjernefunn)

**Symptom:** "Alt ligger i samme repo", vanskelig å endre, vanskelig å stole på editor, vanskelig å bygge lokalt.

**Teknisk årsak:**

1. **Monolittisk editor** — `ContentWorkspace.tsx` (~6401 linjer).
2. **API-eksposjon** — 314 ruter uten tilsvarende **domenegrense**.
3. **Parallell AI-plattform** — 295 filer i `lib/ai` uten **kompensasjon** i **modulær arkitektur** på tvers.

**Strukturell årsak:** **Manglende plattformdisiplin** — produktet har **vokst** med features (AI, growth, sales autonomy) **før** innholds- og redaksjonslaget var **frosset** i modulære grenser.

**Konsekvens:**

- **Bruker:** Ustabile kanttilfeller, tregere iterasjon.
- **Redaktør:** Uforutsigbar UX sammenlignet med moden CMS.
- **Utvikler:** Umulig dyp code review på enkel PR.
- **Drift:** Bygg/minne-problemer; stor flate for incidents.

**Umbraco vs dette:** Umbraco **skiller** innholdsmodell, editor, og pipeline **eksplisitt**. Her er **kode** og **JSON** i samme **mega-komponent**.

---

## 7. Toppfunn – prioritert liste (≥20)

| # | Tittel | Severity | Symptomer | Root cause | Berørte filer / bevis | Konsekvens | Anbefalt retning |
|---|--------|----------|-----------|------------|------------------------|------------|------------------|
| 1 | **Monolittisk CMS-editor** | Critical | Treg utvikling, umulig review | Ingen hard grense på UI-modul | `ContentWorkspace.tsx` ~6401 linjer | Regresjonsrisiko | Splitt i moduler |
| 2 | **Heap OOM ved build** | Critical | Build krasjer | Massiv graf / minne | `npm run build` exit 134 | Deploy blokkert på svake maskiner | Øk heap / splitt |
| 3 | **314 API-ruter** | High | Inkonsistens, authz-feil | Ingen konsolidering | `git ls-files app/api/**/route.ts` | Angrepsflate | API-konsolidering |
| 4 | **295 lib/ai filer** | High | Uoversiktlig drift | Parallell plattform | `git ls-files lib/ai` | Kostnad | Grenser + flag |
| 5 | **Duplikat system motor route** | High | Feil vedlikehold | Copy utenfor `app/` | `superadmin/system/repairs/run/route.ts` + `app/api/...` | To sannheter | Slett én |
| 6 | **RLS åpner for authenticated** på `global_content` | High–Critical* | Potensielt datalekkasje/tilgrising | Policy-design | `20260421000000_global_content.sql` | Sikkerhet | Review + stram inn |
| 7 | **`any` i API** | Medium | Type-sprø kontrakter | Slakk | `app/api/something/route.ts` | Feil i prod | Zod + typer |
| 8 | **`@ts-nocheck` i parity-test** | Medium | Falsk trygghet | Latskap i test | `tests/cms/publicPreviewParity.test.ts` | Regresjon | Fiks typer |
| 9 | **ESLint `eslint-disable` spredt** | Medium | Skjulte regelbrudd | Pragmatikk | `grep eslint-disable` | Kvalitet | Reduser |
| 10 | **`as unknown as` spredt** | Medium | Runtime-feil | DB-JSON | `lib/ai/recommendationActions.ts` m.fl. | Ustabilitet | Skjemalag |
| 11 | **`console.*` i produksjonskode** | Medium | Støy | Logging | `grep console.` — mange filer | Observability | Strukturert logg |
| 12 | **`lint:ci` maskerer lint** | Medium | Falsk grønn | Script | `package.json` `lint:ci` | CI-kvalitet | Ikke bruk som gate |
| 13 | **Sanity studio deprecations** | Medium | Forvirring | Historikk | `studio/lunchportalen-studio/DEPRECATED.md` | Onboarding | Én dokumentasjon |
| 14 | **`next lint` deprecated** | Low | Fremtidig brudd | Next 16 | lint output | Verktøy | Migrer ESLint CLI |
| 15 | **`<img>` vs `Image`** | Medium | LCP / CLS | Editor valg | ESLint warnings | Performance | `next/image` |
| 16 | **Eksperiment i auth flow** | Medium | Kompleksitet | Produktvalg | `post-login` + `lp_exp` | Feilflate | Isoler |
| 17 | **Studio `node_modules`** | Medium | Repro | Nested install | `studio/**/node_modules` | Drift | Dokumenter |
| 18 | **Manglende E2E i audit** | Medium | Ukjent | — | `e2e/` | Regresjon | Kjør CI |
| 19 | **God hooks i ContentWorkspace** | High | Subtile bugs | Størrelse | ESLint warnings | Feil i prod | Refaktor |
| 20 | **Single package** | Low | Ingen modulær versjonering | Valg | `package.json` | Release | Ev. pakker senere |
| 21 | **JSONB som sannhetsspeil** | Medium | Drift | Fleksibilitet | `global_content.data` | Inkonsistens | Schema |
| 22 | **117+ `console` matches** | Medium | Støy | — | `grep` output mode count | Drift | Sentraliser |

\*Severity avhenger av om klienter skriver direkte til Supabase — **ikke verifisert** end-to-end.

---

## 8. Scoring (0–10)

| Kategori | Score | Kommentar |
|----------|-------|-----------|
| Domain clarity | **4** | Kjerne klar; resten fragmentert |
| Architectural coherence | **3** | AI + API + CMS kolliderer |
| CMS/editor maturity | **4** | Tester + DB, men editor monolitt |
| Preview/publish reliability | **6** | Tester finnes; TS-gjeld i tester |
| Frontend robustness | **4** | 6k-linje komponent |
| Backend/API quality | **5** | Respond-pattern + altfor mange ruter |
| Data integrity | **6** | Migreringer; JSONB-risiko |
| Security posture | **5** | Mønstre OK; flate + RLS må verifiseres |
| Performance | **4** | Build OOM; img warnings |
| UX consistency | **5** | **Ikke verifisert** fullt; struktur svekker |
| Accessibility | **N/A** | **Ikke verifisert** — ikke scoret |
| Testability | **7** | Mange tester |
| Maintainability | **3** | Monolitt + filantall |
| Extensibility | **4** | Hooks/plugins finnes; overskygget |
| Operational maturity | **6** | CI bra; lokal build svak |
| **Overall platform maturity** | **4** | Under profesjonell "sømløs plattform" |

### PASS/FAIL-matrise (kriterium: ≥8 i alle kritiske kategorier)

Kritiske kategorier: **Domain clarity**, **Architectural coherence**, **CMS/editor maturity**, **Security posture**, **Maintainability**.

| Kategori | ≥8? |
|----------|-----|
| Domain clarity | **FAIL** |
| Architectural coherence | **FAIL** |
| CMS/editor maturity | **FAIL** |
| Security posture | **FAIL** |
| Maintainability | **FAIL** |

**Resultat:** **FAIL** — prosjektet er **underkjent** mot dette målet.

---

## 9. Hva som gjør løsningen underkjent

Det er **ikke** én bug. Det er **strukturelle valg**:

1. **Tillatt en enkeltfil å bli en hel redaksjonell applikasjon** (`ContentWorkspace.tsx`).
2. **Tillatt API- og AI-vekst uten tilsvarende modularisering** (314 ruter, 295 AI-filer).
3. **Akseptert teknisk gjeld i kontrakttester** (`@ts-nocheck`).
4. **Operasjonell skjørhet** (build OOM) som undergraver tillit til leveranse.

---

## 10. Hva som må til for å nærme seg Umbraco-nivå

Ikke generiske råd — **konkrete strukturer**:

1. **Document type**-lag: eksplisitt schema per type, **én** serialiserings-/valideringssti.
2. **Tynn editor**: skjermer/modal per oppgave, ikke 6000 linjer.
3. **Tjenestelag for mutasjon** — UI sender **kommandoer**, ikke manipulerer JSON overalt.
4. **Én kilde** for system motor og repairs — **fjern duplikatfil**.
5. **Kontrakttester uten** `@ts-nocheck`.

---

## 11. Repair vs Re-architect vs Migrate

| Strategi | Fordeler | Ulemper | Risiko | Sannsynlighet | Tid |
|----------|----------|-----------|--------|---------------|-----|
| **A. Reparere** | Beholder stack; rask gevinst på duplikat, heap, tests | Løser ikke strukturell flom | Lav–Medium | **Høy** for små deler | Uker–måneder |
| **B. Re-arkitektur** (samme stack) | Skiller domener; reduserer API | Krever disiplin og tid | Medium | **Medium** | Måneder |
| **C. Delvis migrering** (f.eks. ekte CMS for marketing) | Tydelig redaktør-UX | To systemer, integrasjon | Høy | **Lav–Medium** | Kvartal+ |

---

## 12. Endelig anbefaling

**Hovedretning: B — Re-arkitektur innenfor Next + Supabase**, kombinert med **A — akutte** fixes (duplikat, build-minne, RLS-review, splitt editor).

**Full migrering** av CMS til ekstern plattform (C) er **ikke** nødvendig for å vinne **struktur**, men kan vurderes **kun** hvis redaksjonell UX fortsatt feiler etter **6–12 mnd** med disiplinert opprydding.

**Eksplisitt:** Dagens struktur er **for svak** til å "lappes" kun med UI; **kjernen** må **modulæriseres**.

---

## 13. Appendix

### 13.1 Obligatoriske spørsmål — svar

1. **Kjernefeil i arkitektur?** Parallell plattformvekst (AI + API + mega-editor) **uten** harde domenegrenser.
2. **Source of truth uklar?** Ja — innhold i **JSONB** vs **blokkkontrakter** vs **editor state**; **to** system motor-filer.
3. **Mest amatørmessig inntrykk?** **6k+ linjer** i én CMS-komponent; **duplikat route** utenfor `app/`.
4. **10 største tekniske risikoer (3–6 mnd)?** OOM, authz på stor API-flate, RLS misbruk, editor-regresjoner, AI-drift, data drift i JSON, observability gaps, E2E hull, dependency hell i studio, kontrakt-sprø mock, performance i editor.
5. **Områder under profesjonell standard?** **APIflate**, **editor-modulærhet**, **arkitektonisk konsolidering**, **lokal build** (på denne maskinen).
6. **Hva kan reddes?** Kjerneordre/tenant, RLS-tester, HTTP-kontrakter, CI-gates — **solid fundament**.
7. **Hva bør re-arkitekteres?** CMS editor-lag, API-konsolidering, AI-grenser.
8. **Hva bør kastes?** Duplikat `superadmin/.../route.ts` (etter verifisering); `lint:ci` som blokerende gate; `@ts-nocheck` i parity-test.
9. **Svakere enn Umbraco fordi?** Mangler **modulær redaksjonell UI**, **tydelig innholdsmodell** uten JSON-spill, og **disiplinert utvidelser**.
10. **5 raske grep med størst løft?** (1) Splitt `ContentWorkspace`, (2) fjern duplikat route, (3) `NODE_OPTIONS` + build dokumentasjon, (4) RLS review, (5) fjern `@ts-nocheck` i parity-test.
11. **Kosmetisk vs strukturell?** ESLint img-warnings: mer **kosmetisk/perf**. **6k-linje fil** og **314 ruter**: **strukturelt**.
12. **Problemer som fortsetter etter UI-puss?** Ja — APIflate, AI-vekst, build, data drift.
13. **Vokst uten plattformretning?** **Ja** — volumtall i `lib/ai` og `app/api` er bevis.
14. **Drift/CI/svakere enn akseptabelt?** Drift: **build OOM lokalt**. CI: **sterk** (enterprise). **Gap** mellom lokal og CI mulig.
15. **Godkjent eller underkjent?** **UNDERKJENT** mot sømløs plattformkvalitet.

### 13.2 Referanser

- `package.json` — scripts, `lint:ci` definisjon  
- `middleware.ts`  
- `app/api/auth/post-login/route.ts`  
- `supabase/migrations/20260421000000_global_content.sql`  
- `lib/cms/blocks/blockContracts.ts`  
- `lib/sanity/client.ts`  
- `app/api/something/route.ts`  
- `superadmin/system/repairs/run/route.ts` + `app/api/superadmin/system/repairs/run/route.ts`  
- `tests/cms/publicPreviewParity.test.ts`  
- `docs/audit/full-system/COMMANDS_RUN_AND_RESULTS.md`
