# Editor-AI metrics

Kort dokumentasjon av client-side editor-AI-eventer for beregning av **AI Activation Rate** og **AI Assisted Save Rate**. **Trinn 2 er aktiv:** eventer sendes til `POST /api/editor-ai/metrics` og lagres i `ai_activity_log`. Ingen stille drop: ved insert-feil returnerer ruten 500 (METRICS_INSERT_FAILED).

## Eventtyper som logges

| Event | Betydning |
|-------|-----------|
| `editor_opened` | Bruker åpnet editoren for en side (én gang per side per økt). |
| `ai_action_triggered` | Bruker startet en AI-handling (Improve Page, SEO, Generate sections, inline SEO/Hero/CTA, osv.). |
| `ai_result_received` | AI-respons mottatt; `patchPresent` angir om et gyldig patch ble levert. |
| `ai_patch_applied` | Patch ble brukt og editor-state ble oppdatert. |
| `ai_save_after_action` | Bruker lagret manuelt etter at en AI-handling hadde blitt utført (siste handling ble merket). |

Alle eventer har `pageId`, `variantId` (null i trinn 1), `timestamp` og ingen sensitiv data (ingen prompts, forslagstekst eller sideinnhold).

## Hvor de logges

- **editor_opened**: `ContentWorkspace.tsx` – `useEffect` ved `effectiveId`, én gang per side (ref for å unngå spam).
- **ai_action_triggered**: I hver AI-handler (`handleAiImprovePage`, `handleAiSeoOptimize`, `handleAiGenerateSections`, `handleAiStructuredIntent`) rett før `callAiSuggest`; inline vs panel skilles via `fromInline` / `fromPanel`.
- **ai_result_received**: I `callAiSuggest` etter at responsen er tolket og payload er tilgjengelig; kun når `metricsFeature` er satt. `patchPresent = isAIPatchV1(payload.patch)`.
- **ai_patch_applied**: I `callAiSuggest` inne i `if (applied.ok)` etter at `applyParsedBody` og `setAiLastAppliedTool` er kalt.
- **ai_save_after_action**: I `onSave` (manuell lagring) når `aiLastActionFeature` er satt; etter logging nulles `aiLastActionFeature`.

## Feature-mapping

- Improve Page → `improve_page`
- SEO fra panel → `seo_optimize`; inline (meta-felt) → `seo_inline`
- Generate sections → `generate_sections`
- Structured intent fra panel → `structured_intent`; inline hero → `hero_inline`; inline CTA → `cta_inline`
- CRO: run analysis → `cro_analysis`; apply suggestion → `cro_apply`; dismiss → `cro_dismiss` (same auth gate; see docs/backoffice/CRO_PERMISSIONS.md)

## Beregning av KPI (senere)

- **AI Activation Rate**  
  = antall **editor_opened**-økter med minst én **ai_action_triggered**  
  ÷ antall **editor_opened**

- **AI Assisted Save Rate**  
  = antall **ai_save_after_action**  
  ÷ antall **ai_action_triggered**

## Begrensninger (klient)

- Logging blokkerer aldri editoren og kaster ikke i UI (logEditorAiEvent er best-effort, never throws).
- Ved 401/403 eller 500 fra metrics-API vises kun advarsel i dev-console; UI viser ikke feil for metrics.

---

## Serverpersistens (trinn 2)

Metrics sendes best-effort til `POST /api/editor-ai/metrics` og lagres i **ai_activity_log**. Ruten bruker scopeOr401 og requireRoleOr403(superadmin | company_admin). CRO-events bruker samme gate; ingen egen CRO-rute.

- **action:** `editor_ai_metric`
- **tool:** `event.type` (f.eks. `editor_opened`, `ai_action_triggered`, …)
- **metadata:** kun `{ pageId, variantId, feature, patchPresent, timestamp }` — ingen prompts, forslagstekst eller sideinnhold.

**Validering i route:** Body må være et objekt; `type` og `timestamp` er påkrevd. Valgfrie felter: `pageId`, `variantId`, `feature`, `patchPresent`. `feature` må være en av de godkjente (bl.a. `improve_page`, `seo_optimize`, `cro_analysis`, `cro_apply`, `cro_dismiss` — se VALID_FEATURES i route). Payload med flere enn 24 nøkler avvises.

**Observability-events (må aksepteres av ruten):** Klienten sender også disse typene; backend må **ikke** avvise dem med 400. Lagre eller logg dem slik at feil ikke forsvinner stille:
- `ai_error` – feature?, message, kind?
- `media_error` – message, kind: fetch | upload | alt
- `builder_warning` – feature: screenshot_builder | page_builder, message, count?
- `content_error` – message, kind: save | load | parse

Hvis ruten i dag kun godtar «happy path»-typer, utvid valideringen slik at disse typene enten lagres i ai_activity_log (med eget action/tool-format) eller sendes til samme loggkanal. Se `domain/backoffice/ai/metrics/editorAiMetricsTypes.ts` for full union `EditorAiEvent`.

### AI Activation Rate (SQL)

Antall editor-økter med minst én `ai_action_triggered` delt på antall `editor_opened`:

```sql
WITH opened AS (
  SELECT created_by, page_id, date_trunc('day', created_at) AS day
  FROM ai_activity_log
  WHERE action = 'editor_ai_metric' AND tool = 'editor_opened'
),
triggered AS (
  SELECT created_by, page_id, date_trunc('day', created_at) AS day
  FROM ai_activity_log
  WHERE action = 'editor_ai_metric' AND tool = 'ai_action_triggered'
),
sessions_with_trigger AS (
  SELECT DISTINCT o.created_by, o.page_id, o.day
  FROM opened o
  INNER JOIN triggered t ON (o.created_by IS NOT DISTINCT FROM t.created_by AND o.day = t.day)
)
SELECT
  (SELECT count(*) FROM opened) AS total_opened,
  (SELECT count(*) FROM sessions_with_trigger) AS sessions_with_ai,
  round(100.0 * (SELECT count(*) FROM sessions_with_trigger) / nullif((SELECT count(*) FROM opened), 0), 2) AS activation_rate_pct;
```

### AI writes (suggest / apply) — ingen fake success

- **POST /api/backoffice/ai/suggest:** Lagrer forslag i `ai_suggestions` og logger i `ai_activity_log`. Ved feil på insert returnerer ruten **500** (SUGGESTION_INSERT_FAILED eller SUGGESTION_LOG_FAILED). Klienten får da ikke 200 og viser feil; ingen «brukt» uten sporbarhet.
- **POST /api/backoffice/ai/apply:** Logger apply i `ai_activity_log`. Ved feil returnerer ruten **500** (APPLY_LOG_FAILED). Ingen stille drop av audit.

### AI Assisted Save Rate (SQL)

Antall `ai_save_after_action` delt på antall `ai_action_triggered`:

```sql
SELECT
  (SELECT count(*) FROM ai_activity_log WHERE action = 'editor_ai_metric' AND tool = 'ai_save_after_action') AS saves_after_ai,
  (SELECT count(*) FROM ai_activity_log WHERE action = 'editor_ai_metric' AND tool = 'ai_action_triggered') AS actions_triggered,
  round(100.0 * (SELECT count(*) FROM ai_activity_log WHERE action = 'editor_ai_metric' AND tool = 'ai_save_after_action')
    / nullif((SELECT count(*) FROM ai_activity_log WHERE action = 'editor_ai_metric' AND tool = 'ai_action_triggered'), 0), 2) AS assisted_save_rate_pct;
```
