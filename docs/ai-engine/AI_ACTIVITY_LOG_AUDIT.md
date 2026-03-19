# AI activity log — audit and consistency (CMS)

Summary of the AI logging hardening work: broken paths fixed, flows logged, migration, and intentional gaps.

## Broken paths fixed

The `ai_activity_log` table has a `CHECK (action IN (...))` constraint. Several routes were inserting action values that were **not** in the allowlist, causing inserts to fail (and either 500s or silent drops).

| Action (before fix)                 | Used in                                      | Status   |
|-------------------------------------|----------------------------------------------|----------|
| `suggest_failed`                    | `POST /api/backoffice/ai/suggest` (on error) | **Fixed** — added to constraint |
| `design_suggestions_generated`       | `POST /api/backoffice/ai/layout-suggestions` | **Fixed** — added to constraint |
| `page_compose`                      | `POST /api/backoffice/ai/page-builder`       | **Fixed** — added to constraint |
| `seo_intelligence_scored`          | `POST /api/backoffice/ai/seo-intelligence`   | **Fixed** — added to constraint |
| `design_suggestion_applied`        | `POST /api/backoffice/ai/design-suggestion/log-apply` | **Fixed** — added to constraint |

**Migration:** `supabase/migrations/20260404000000_ai_activity_log_actions_cms.sql` extends the action constraint to include all of the above plus the new actions used by the routes that did not log before.

## Flows now logged

| Flow                | Route / source                    | Action                        | Tool / metadata notes |
|---------------------|------------------------------------|-------------------------------|------------------------|
| Suggest (success)   | `POST /api/backoffice/ai/suggest`  | `suggest`                     | tool from body; usage, suggestionId in metadata |
| Suggest (failure)   | `POST /api/backoffice/ai/suggest`  | `suggest_failed`              | tool from body; error slice in metadata |
| Apply               | `POST /api/backoffice/ai/apply`   | `apply`                      | tool from body; applied patch in metadata |
| Page builder        | `POST /api/backoffice/ai/page-builder` | `page_compose`          | `page_builder`; blockCount, hasStructuredInput, pageType |
| Block builder       | `POST /api/backoffice/ai/block-builder` | `block_build`           | `block_builder`; hasBlock, page_id/variant_id when provided |
| Layout suggestions  | `POST /api/backoffice/ai/layout-suggestions` | `design_suggestions_generated` | `layout_suggestions`; count |
| Layout apply        | `POST /api/backoffice/ai/design-suggestion/log-apply` | `design_suggestion_applied` | `layout_suggestions`; kind, suggestionTitle |
| SEO intelligence    | `POST /api/backoffice/ai/seo-intelligence` | `seo_intelligence_scored` | `seo_intelligence`; score, suggestionCount |
| Text improve        | `POST /api/backoffice/ai/text-improve` | `text_improve`            | `text_improve`; action (improve/shorten) |
| CTA improve         | `POST /api/backoffice/ai/cta-improve` | `cta_improve`             | `cta_improve`; action, blockId |
| Image prompts       | `POST /api/backoffice/ai/image-generator` | `image_prompts`          | `image_generate`; promptCount, purpose |
| Image metadata      | `POST /api/backoffice/ai/image-metadata` | `image_metadata`        | `image_metadata`; mediaItemId when set |
| Editor-AI metrics  | `POST /api/editor-ai/metrics`      | `editor_ai_metric`           | type (e.g. ai_action_triggered); feature, pageId, variantId, etc. in metadata |
| Experiment event    | `POST /api/backoffice/experiments/event` | `experiment_event`      | experiment_ingest; experimentId, variant, event |
| Job completed       | Jobs runner                        | `job_completed`              | tool from job; jobId in metadata |
| Job failed          | Jobs runner                        | `job_failed`                 | tool from job; error, attempts in metadata |
| Agent run           | Agents (registry, runner, contentHealthDaily) | `agent_run`        | agent tool name in tool + metadata |

Apply actions are traceable to **user** (`created_by`), **page** (`page_id`), **variant** (`variant_id` where used), **tool**, and **outcome** (in metadata: applied patch, score, count, error, etc.).

## Migration added

- **File:** `supabase/migrations/20260404000000_ai_activity_log_actions_cms.sql`
- **Change:** `ALTER TABLE public.ai_activity_log` — drop existing `ai_activity_log_action_check`, add new check including:
  - `suggest`, `suggest_failed`, `apply`
  - `job_completed`, `job_failed`, `agent_run`
  - `experiment_event`, `editor_ai_metric`
  - `design_suggestions_generated`, `page_compose`, `seo_intelligence_scored`, `design_suggestion_applied`
  - `text_improve`, `cta_improve`, `block_build`, `image_prompts`, `image_metadata`

No new tables or columns; existing `ai_activity_log` / `ai_suggestions` / `ai_jobs` structure unchanged.

## Code updates

- **lib/ai/logging/aiExecutionLog.ts** — `ALLOWED_ACTIONS` updated to match the DB constraint (single source of truth for allowed action strings in code).
- **Routes** — text-improve, cta-improve, block-builder, image-generator, image-metadata now perform a best-effort insert into `ai_activity_log` on success; insert failures are opsLogged and do not change the HTTP response.

## Intentional gaps

- **Screenshot builder** (`/api/backoffice/ai/screenshot-builder`): not wired to ai_activity_log in this pass; can be added later with action e.g. `screenshot_build` and a constraint update if desired.
- **Suggestions list/status** (e.g. `/api/backoffice/ai/suggestions`, `[id]`, `[id]/status`): read/status only; no new log events.
- **Health/status/capability routes** (`/api/backoffice/ai/health/*`, `/api/backoffice/ai/status`, `/api/backoffice/ai/capability`): no audit log; operational only.
- **Suggest motor** (experiment + image_candidates branches): already log with action `suggest`; no change.
- **Failure logging**: Only suggest route logs explicit failures (`suggest_failed`). Other routes log success only; failures can be inferred from absence of a success row or from editor_ai_metric / observability events where applicable.

## Verification

After applying the migration:

1. Run a suggest (success and failure), apply, page-builder, block-builder, layout-suggestions, log-apply, seo-intelligence, text-improve, cta-improve, image-generator, image-metadata, and an editor-ai metric event; confirm one row per success (and suggest_failed on suggest error) in `ai_activity_log` with the expected `action` and `tool`.
2. Run `typecheck`, `lint`, `build:enterprise` per project gates.
