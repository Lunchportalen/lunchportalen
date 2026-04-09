# CMS Control Plane — Runtime boundaries

**Dato:** 2026-03-29

## 1. Hva CMS skal eie (control plane)

- **Content tree** og navigasjon i redaksjonell struktur (Postgres-basert backoffice).
- **Sider, blokker, varianter**, preview vs published state, og **publish-handlinger** innenfor `app/api/backoffice/content/**`.
- **Media** (opplasting, referanser, oppløsning mot publisert innhold).
- **Design scopes** og visuell DNA (phase2a tokens — innenfor eksisterende komponenter).
- **Sanity-objekter** der produktet bruker Sanity (menyer, retter, redaksjonell `weekPlan`): redaksjonell sannhet i Sanity Studio / publiserings-API — med eksplisitt skille mot operativ runtime.
- **AI-assistert redigering** som **forslag** / patch med roller — ikke ordre eller faktura.

## 2. Hva runtime skal eie (operational truth)

- **Auth/session** og **profiler** (`profiles.company_id`, `location_id`, roller).
- **Ordre**, ordrehendelser, vinduer (`order/window`), **ikke** blandet med CMS save.
- **Avtaler** som faktisk styrer pris/tier/delivery days i API (Supabase/RPC).
- **Fakturagrunnlag / billing motor** og betalingswebhooks.
- **Audit events** og sporbarhet for sensitive handlinger.
- **Cron/worker** jobber som mater aggregater — med idempotens der påkrevd.

## 3. Flows som må synkroniseres (ikke «dobbelt sannhet», men koordinert)

| Flow | CMS-rolle | Runtime-rolle |
|------|-----------|----------------|
| Meny per `mealType` | Redigeres i Sanity / CMS-kjeden; publisert meny leses av `getMenusByMealTypes` e.l. | `GET /api/week` og `order/window` **konsumerer** publisert meny innenfor avtale |
| Ukesynlighet (tor 08, fre 15, …) | Kommunikasjon/copy kan ligge i CMS | **Algoritme** i `lib/week/availability.ts` er autoritativ |
| SEO på side | Metadata i variant/publish | Public renderer + scripts — etter publish |
| ESG tall | Presentasjon i UI | Aggregater fra DB/cron — CMS **forklarer**, endrer ikke fakta uten pipeline |

## 4. Flows som skal være read-only i CMS (eller review-only)

- **Avtalefelter** som styrer økonomi/leveringsdager: vis som read-only eller krev dedikert admin API — **ikke** skjult i content save.
- **Ordrehistorikk**, faktura: read-only speil eller lenke til admin/superadmin.
- **ESG:** tolkning review-first; ikke «grønnvask» tom data.

## 5. Flows som skal kunne publiseres / reviewes fra CMS

- **Content pages** (full pipeline: draft → preview → publish).
- **Menyinnhold** (Sanity) — med klar **operativ** konsekvens: «etter publish brukes dette av uke-API».
- **Redaksjonell weekPlan** — hvis produktet fortsatt bruker den for marketing/cron; **ikke** forveksle med employee `GET /api/week` kilde uten produktendring.
- **Growth** poster forutsatt policy og DRY_RUN der ikke ekte kanal.

---

**Hard rule:** Ingen ny «parallell week truth» i Postgres eller Sanity uten eksplisitt deprecating av eksisterende kjede og migrasjonsplan.
