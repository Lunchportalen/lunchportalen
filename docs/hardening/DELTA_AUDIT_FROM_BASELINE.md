# Delta audit — fra REPO_DEEP_DIVE_REPORT til nåstatus

**Dato:** 2026-03-28  
**Before snapshot:** `REPO_DEEP_DIVE_REPORT.md` (samme dato) — brukt som baseline, **ikke** som automatisk sannhet om dagens kode uten re-verifikasjon.  
**After snapshot:** Lesing av repo 2026-03-28 (kode + eksisterende fasedokumentasjon).

---

## Klassifikasjonsnøkkel

| Klasse | Betydning |
|--------|-----------|
| **RESOLVED** | Baseline-problemet er fjernet eller vesentlig endret i kode; re-verifisert. |
| **PARTIAL** | Forbedret eller dokumentert; fortsatt risiko eller hull. |
| **STILL OPEN** | Baseline gjelder i stor grad uendret. |
| **SUPERSEDED** | Baselinepåstand erstattet av nyere fakta (ny kilde er autoritativ). |
| **NEEDS RE-VERIFICATION** | Krever kjøring i miljø, lasttest eller manuell QA — ikke fullt bevist fra statisk lesing. |

---

## 1. Employee / Week / fredagstid

| Baselinepunkt | Klasse | Kommentar |
|---------------|--------|-----------|
| Fredag **14:00** vs ønsket **15:00** i `lib/week/availability.ts` | **RESOLVED** (mot baseline-tekst) | Dagens kode: `isAfterFriday1500`, kommentar «fredag 15:00», `isAfterFriday1400` deprecert alias (**re-verifisert** i fil). Baseline var **CONTRADICTION** mot kodeversjon den refererte — nå konsistent 15:00. |
| «Employee kun Week» vs `allowNextForRole` med `/orders`, `/min-side` | **RESOLVED** (mot baseline) | Dagens `lib/auth/role.ts`: employee-branch returnerer kun `nextPath.startsWith("/week")` (**re-verifisert**). |
| En sannhet for Week (API + UI) | **PARTIAL** | `lib/week/availability.ts` er tydelig; ordre-vindu + `EmployeeWeekClient` fortsatt **NEEDS RE-VERIFICATION** end-to-end i pilot. |
| To spor ukeplan (Sanity `weekPlan` vs meny per `mealType`) | **STILL OPEN** | Arkitektonisk tema i baseline; ikke «løst» av dokumentasjon alene. |

---

## 2. Content tree / media

| Baselinepunkt | Klasse | Kommentar |
|---------------|--------|-----------|
| CMS/blokker i Postgres + stor backofficeflate | **PARTIAL** | 2B/2D dokumenterer tre, media, SEO; **API-sprawl** og kompleksitet vokser med nye ruter. |
| Manglende operatør-README | **STILL OPEN** | Rot-README tynn; delvis dekket av `docs/phase*` — **ikke** erstatning for go-live runbook. |

---

## 3. Tårn (control / company / kitchen / driver / superadmin)

| Baselinepunkt | Klasse | Kommentar |
|---------------|--------|-----------|
| Fragmentert produkt / mange moduler | **PARTIAL** | 2C ga IA + capabilities; superadmin/backoffice har fortsatt stor flate. |
| Control tower | **PARTIAL** | Eksisterende API (`/api/backoffice/control-tower`, superadmin-varianter); modenhet **NEEDS RE-VERIFICATION** under last. |

---

## 4. Social / SEO / ESG (fase 2D)

| Område | Klasse | Kommentar |
|--------|--------|-----------|
| Social calendar CMS | **PARTIAL** | `social_posts`, `/backoffice/social`, API — **runtime**; ekstern publisering fortsatt policy-begrenset (stub/kanaler). |
| SEO growth surface | **PARTIAL** | `/backoffice/seo-growth`, `seo-intelligence` — review-first; avhenger av innholds-`PATCH`. |
| ESG surface | **PARTIAL** | `/backoffice/esg`, delt snapshot-fetch — **read-only**; sannhet i DB/cron uendret av UI. |
| Nye risikoer fra 2D | **INFERRED** | Flere backoffice-ruter og klientflate → større **angrepsflate** hvis auth glippes (mitigeres av superadmin-only der definert). |

---

## 5. Middleware / auth-grense

| Baselinepunkt | Klasse | Kommentar |
|---------------|--------|-----------|
| Middleware sjekker cookie, ikke rolle | **STILL OPEN** | `middleware.ts` — fortsatt mønster; autoritative sjekker i layout/API (**CONFIRMED** intent). |
| Beskyttede stier inkl. `/orders`, `/kitchen`, … | **STILL OPEN** | Middleware beskytter bredt; **employee** landing/next begrenset til `/week` i `allowNextForRole` — men `/orders` fortsatt **beskyttet sti** i middleware (tilgang krever fortsatt layout/API-logikk for «hvem får inn»). **NEEDS RE-VERIFICATION** for ønsket produktoppførsel. |

---

## 6. Strict typing

| Baselinepunkt | Klasse | Kommentar |
|---------------|--------|-----------|
| `tsconfig.json` `"strict": false` | **STILL OPEN** | Bekreftet — fortsatt teknisk gjeld. |

---

## 7. Worker / cron

| Baselinepunkt | Klasse | Kommentar |
|---------------|--------|-----------|
| Worker delvis stub (`ai_generate`, `send_email`, …) | **PARTIAL** | `workers/worker.ts` — `retry_outbox` er reell sti; flere jobbtyper logger fortsatt som stub. |
| Mange cron-ruter | **STILL OPEN** | Operasjonell modenhet (secrets, drift, idempotens) **NEEDS RE-VERIFICATION** per miljø. |

---

## 8. API «sprawl»

| Baselinepunkt | Klasse | Kommentar |
|---------------|--------|-----------|
| ~557 `route.ts` | **SUPERSEDED** (telling) | **561** filer under `app/api/**/route.ts` (2026-03-28) — samme **orden av størrelse**, høy vedlikeholdsflate. |

---

## 9. Skalerbarhet (50k × 200)

| Baselinepunkt | Klasse | Kommentar |
|---------------|--------|-----------|
| Ikke bevist i deep-dive | **STILL OPEN** | Ingen ny dokumentert lasttest i denne revisjonen; pilot-kapasitet må defineres separat. |

---

## 10. Oppsummering ærlig

- **Faktisk løst mot baseline-tekst:** fredag **15:00** i ukesynlighet; employee **`next`** begrenset til **`/week`** (baseline sa noe annet om allowlist).
- **Fortsatt åpent:** `strict: false`, middleware uten rolle, stor APIflate, worker-stubs, dual weekPlan-spor, skaleringsbevis.
- **Nytt siden baseline:** CMS Social, SEO, ESG-flater (2D) — økt funksjonalitet med kontrollert scope men **økt overflate** for sikkerhetsreview.
