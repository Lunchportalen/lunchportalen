# Åpne plattform-risikoer (post-baseline, post-2D)

**Formål:** Ærlig liste over det som **fortsatt** kan skade sikkerhet, drift eller tillit ved pilot/live — uten å late som fasearbeid har fjernet kjernefare.

---

## A. Auth og grenser

| ID | Risiko | Hvorfor det fortsatt gjelder |
|----|--------|------------------------------|
| A1 | **Middleware kjenner ikke rolle** | Cookie-sjekk på beskyttede stier; feil eller manglende layout/API-gate på én rute → potensielt lekkasje. |
| A2 | **Stor APIflate (~561 route handlers)** | Høy sannsynlighet for inkonsistent `scopeOr401` / `requireRoleOr403` på eldre eller sjeldne ruter. |
| A3 | **`strict: false`** | Høyere risiko for uoppdagede kontraktsfeil og `undefined`-feil i produksjon. |

---

## B. Operativ kjerne (ordre / uke)

| ID | Risiko | Merknad |
|----|--------|---------|
| B1 | **To spor for «uke»** (Sanity `weekPlan` vs meny/`mealType`) | Kan gi desynk eller forvirring — **ikke** løst av growth-faser. |
| B2 | **End-to-end Week-sannhet** | Kode ser konsistent ut; **pilot-QA** nødvendig (fredag 15:00, tor 08:00, samme-dag 08:00). |

---

## C. Billing / økonomi

| ID | Risiko | Merknad |
|----|--------|---------|
| C1 | **Hybrid Stripe + Tripletex/faktura** | Drift og forventningsstyring — utenfor 2D; baseline pekte på kompleksitet. |
| C2 | **Cron-fakturavindu** | Avhenger av secrets, tidssone, og at selskapsdata er korrekt — **miljøverifikasjon**. |

---

## D. Growth: Social / SEO / ESG (2D)

| ID | Risiko | Merknad |
|----|--------|---------|
| D1 | **Social:** tro på ekstern publisering | Policy/kanal-stubs — feil forventning hvis ikke kommunisert. |
| D2 | **SEO:** tro at metadata er «live» uten publish-flyt | Review-first i design; fortsatt menneskelig/prosessrisiko. |
| D3 | **ESG:** feiltolkning av tom data som «bra» | UI prøver å merke «ikke nok data»; copy/markedsføring må følge DB. |
| D4 | **Økt CMS-overflate** | Flere backoffice-ruter → vedvarende behov for **rolle- og tenant-review**. |

---

## E. Worker / kø / cron

| ID | Risiko | Merknad |
|----|--------|---------|
| E1 | **Delvise jobb-stubs** (`send_email`, `ai_generate`, …) i worker | Ikke alt er produksjonsklart uten videre. |
| E2 | **Cron drift / dobbelkjøring** | Krever overvåkning og idempotens-review per jobb. |

---

## F. Skalerbarhet og performance

| ID | Risiko | Merknad |
|----|--------|---------|
| F1 | **Ingen dokumentert lasttest for «målark»** | Pilot må definere **kapasitetsantakelser** eksplisitt. |
| F2 | **Tunge synkrone API-er** | Risiko under pigg; krever profiling i pilot — **NEEDS RE-VERIFICATION**. |

---

## G. Nye risikoer introdusert av fasearbeid (2D)

- Flere **leseskriver** og **CMS-flater** (social, SEO, ESG) → mer kode å vedlikeholde og sikre.  
- **Ingen** ny ordre-/faktura-sannhet er bevisst introdusert — risiko er primært **flater + forventninger**, ikke ny DB-sannhet for kjernen.
