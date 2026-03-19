# Observability – sannhet

**Hva som persisteres, hva som ikke gjør det, og kontrakt for editor-AI metrics.**

## 0. SLO, SLI og operativ status (system)

- **Kilde:** `lib/observability/` (types, sloRegistry, sli, alertEvaluator, statusAggregator).
- **API:** `GET /api/superadmin/system/status` (superadmin) returnerer én sannhetskilde: `status`, `checks`, `slos`, `alerts`, `openIncidentsByType`, `reasons`.
- **UI:** Superadmin → System → kortet «SLO og alarmer».
- **Runbook:** `docs/SLO_ALERTING_RUNBOOK.md` – definerte SLO-er, hvordan de måles, hva som utløser alarmer, operatørhandlinger, begrensninger (ingen ekstern varsling ennå).

## 1. Klient

- **Kilde:** `domain/backoffice/ai/metrics/logEditorAiEvent.ts`.
- **Alle** eventtyper fra `EditorAiEvent` (editor_opened, ai_action_triggered, ai_result_received, ai_patch_applied, ai_save_after_action, **ai_error**, **media_error**, **builder_warning**, **content_error**) sendes til `POST /api/editor-ai/metrics` med `keepalive: true`. Ingen event sendes til annen URL for persistens.
- I dev: ved `!res.ok` eller fetch-feil logges advarsel til console. Ingen stille discard i klient.

## 2. Backend

- **Rute:** `app/api/editor-ai/metrics/route.ts`.
- **Godkjente typer:** VALID_TYPES (editor_opened, ai_action_triggered, ai_result_received, ai_patch_applied, ai_save_after_action) **og** OBSERVABILITY_TYPES (ai_error, media_error, builder_warning, content_error). Ingen av disse avvises med 400.
- **Lagring:** Én rad per request i `ai_activity_log`: `action = 'editor_ai_metric'`, `tool = event.type`, `metadata` inkluderer pageId, variantId, feature, patchPresent, timestamp, og for observability-events: message, kind, count.
- **Ved insert-feil:** Returnerer **500** med `METRICS_INSERT_FAILED`. Ingen stille best-effort; request får tydelig feil.
- **AI suggest:** `POST /api/backoffice/ai/suggest` returnerer **500** (SUGGESTION_INSERT_FAILED / SUGGESTION_LOG_FAILED) ved feil på ai_suggestions eller ai_activity_log. Ingen fake success.
- **AI apply (audit):** `POST /api/backoffice/ai/apply` returnerer **500** (APPLY_LOG_FAILED) ved feil på ai_activity_log. Ingen stille drop.

## 3. Hva som ikke aggregeres (per i dag)

- Ingen separat aggregeringsjobb eller dashboard som viser ai_error/media_error/builder_warning/content_error i UI. Data ligger i `ai_activity_log` og kan spørres via SQL. KPI (AI Activation Rate, AI Assisted Save Rate) er dokumentert i docs/ai-engine/EDITOR_AI_METRICS.md med eksempel-SQL.

## 4. Kontrakt

- **Request:** POST, JSON body med minst `type`, `timestamp`. For observability: `message`, `kind`, `count` lagres når sendt.
- **Response 200:** `{ ok: true, rid, data: { ok: true } }`.
- **Response 4xx/5xx:** Standard jsonErr med rid, message, status, error. 500 ved METRICS_INSERT_FAILED.
