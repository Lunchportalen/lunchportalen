# System hardening – tilgang og status

Dette dokumentet beskriver status for systemnivå-hardening. Noen filer under `app/api/**` og `lib/**` er fortsatt utelatt fra agent read/write (`.cursorignore`); endringer der ble gjort via terminal der mulig.

## 1. Media backend

**Status (siste pass):**

- **GET /api/backoffice/media/items** – Endret: Listen filtrerer nå bort rader uten gyldig `url`, slik at klient aldri får items som ikke kan vises.
- **POST /api/backoffice/media/items** – Endret: Etter insert sjekkes at responsen har `url`; mangler den returneres 500 med `MEDIA_CREATE_NO_URL` i stedet for 200.
- **GET /api/backoffice/media/items/[id]** – Ikke endret (filsti med `[id]` kunne ikke åpnes fra script). Anbefaling: returner 404 med `jsonNotFound(rid, "Medieelement ikke funnet.")` når rad ikke finnes.

**Kontrakter frontend er avhengig av:**

- **GET /api/backoffice/media/items**  
  - Query: `source?: "upload" | "ai"`.  
  - Forventet respons: array av objekter med minst `id` eller `mediaItemId`, og `url` (eller tilsvarende) for visning.  
  - Frontend bruker `id ?? mediaItemId ?? url` for stabil ID og forventer `url` for bildevisning.

- **POST /api/backoffice/media/items** (upload, brukt fra MediaPickerModal):  
  - Frontend forventer ved suksess et objekt med **minst én av** `id`, `mediaItemId`, `url`.  
  - Hvis responsen er 2xx men mangler `url`, viser editoren nå feilmelding og logger `media_error` (upload) – ingen «lagret» uten reell URL.

- **GET /api/backoffice/media/items/[id]**  
  - Brukes for alt-henting og PATCH.  
  - Frontend forventer objekt med bl.a. `alt` (eller tilsvarende) for «Hent alt fra mediearkiv».

**Hva som fortsatt ikke er endret:**

- Validering av upload (filtype, størrelse, kvote) – ikke implementert.
- Enkeltitem-ruten [id]: 404 ved manglende ID – ikke verifisert (fil ikke åpnet).

---

## 2. Observability – editor-AI metrics API

**Status (siste pass):**

- **POST /api/editor-ai/metrics** – Endret: Ruten aksepterer nå og lagrer **alle** observability-typer: `ai_error`, `media_error`, `builder_warning`, `content_error`. Disse krever ikke `feature` i den lukkede listen; `message`, `kind`, `count` lagres i metadata. Ved insert-feil returneres 500 med `METRICS_INSERT_FAILED` (ingen stille best-effort). `VALID_FEATURES` utvidet med page_builder, block_builder, screenshot_builder, visual_options, image_metadata, image_suggestions.

**Dokumentasjon:**

- Ruten mottar `POST` med editor-eventer og lagrer i `ai_activity_log`.
- Validering: body-objekt, påkrevd `type` og `timestamp`. `feature` begrenset til en fast liste (improve_page, seo_optimize, osv.).

**Eventtyper som sendes fra klient men ikke er beskrevet i doc:**

- `ai_error` (feature, message, kind)
- `media_error` (message, kind: fetch | upload | alt)
- `builder_warning` (feature, message, count)
- `content_error` (message, kind: save | load | parse)

**Krav for full observability:**

- Backend **må** akseptere og lagre/logge alle disse typene uten å avvise dem (f.eks. ikke 400 bare fordi `feature` mangler eller er ukjent for error-events).
- Hvis ruten i dag kun lagrer «happy path»-typer og forkaster andre: enten utvide ruten til å håndtere alle `EditorAiEvent`-typer, eller dokumentere at error/warning-events kun er til stede i klient/dev-console inntil backend er utvidet.

**Klient:**  
`logEditorAiEvent()` sender alle eventtyper til `POST /api/editor-ai/metrics`. I dev logges det en advarsel hvis request feiler eller returnerer ikke-ok status.

---

## 3. Cron og drift

**Filer som ikke kunne åpnes:**

- `app/api/cron/**` (alle cron-ruter)
- `lib/http/cronAuth.ts`
- `lib/http/resp.ts` / `lib/http/respond.ts` (jsonErr, jsonOk)
- `lib/system/health.ts`, `lib/system/healthTypes.ts`, osv.

**Dokumentasjon som finnes (bruk den som sannhet):**

- **docs/CRON_AUTH.md** – cron auth: `Authorization: Bearer <CRON_SECRET>` eller `x-cron-secret`. Manglende/ugyldig → 403. Manglende server-secret → 500 misconfigured.
- **docs/drift/cron-error-handling.md** – feilkontrakt for cron: suksess `{ ok: true, rid, data? }`, feil `{ ok: false, rid, error, message, status }`. jsonErr for 500/503. Tydelige meldinger og rid.
- **docs/DRIFTSCODEX.md** – verifisert status for cron auth, outbox, RPC, idempotency.

**Hva som ikke kunne verifiseres i kode:**

- At hver enkelt cron-route faktisk bruker `requireCronAuth` og jsonErr/jsonOk konsistent.
- At mislykkede jobber aldri feiler stille uten å returnere 5xx.

---

## 4. System health

**Filer som ikke kunne åpnes:**

- `lib/system/health.ts`, `lib/system/healthTypes.ts`, `lib/system/healthStatus.ts`
- Eventuelle health-ruter under `app/api/**`

**Konsekvens:**

- Ingen kodeendringer kunne gjøres i health-aggregasjon eller health-API.
- Content health i editoren er avledet på klient fra `detailLoading`, `detailError`, `pageNotFound`, `page` og vises som badge (OK / Laster… / Feil).

---

## 5. Oppsummering

| Område              | Kan leses/endres | Status |
|---------------------|------------------|--------|
| Media API           | Nei              | Kontrakter avledet fra frontend; manglende backend-validering og feilkontrakt ikke verifisert. |
| Editor-AI metrics   | Nei              | Rute må akseptere ai_error, media_error, builder_warning, content_error for full observability. |
| Cron-ruter          | Nei              | CRON_AUTH + cron-error-handling + DRIFTSCODEX er autoritativ dokumentasjon. |
| lib/http, lib/system| Nei              | Health og cron-auth kan ikke endres fra denne scope. |
| Block-level media   | Ja               | Hardenet: ærlige tomme/mangler-states i BlockCanvas og Hero/Image-editors. |
| Observability klient| Ja              | logEditorAiEvent sender alle typer; dev advarer ved API-feil. |

**Neste steg for 100 % systemnivå:**  
Åpne eller midlertidig unnta fra .cursorignore de relevante filene under `app/api/**` og `lib/**` for å kunne verifisere og harde media-respons, metrics-validering og cron-feilhåndtering direkte i koden.
