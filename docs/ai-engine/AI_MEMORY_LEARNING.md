# AI memory & learning — operational wiring

The AI memory layer is wired so the system learns from real CMS outcomes: what gets applied, saved, published, and which experiment variants perform better.

## What gets learned

| Learning signal | Table | Kind / shape | When |
|-----------------|--------|-------------|------|
| **Suggestion applied** | `ai_memory` | `kind: "outcome"`, `payload.area: "suggestion_applied"`, tool, pageId, variantId, appliedKeys | User applies an AI suggestion via apply route or design-suggestion/log-apply (layout). |
| **Content published** | `ai_memory` | `kind: "outcome"`, `payload.area: "content_published"`, pageId, variantId, env | Variant is published to prod (variant publish API). |
| **Release executed** | `ai_memory` | `kind: "outcome"`, `payload.area: "release_executed"`, releaseId, count | A scheduled release is executed. |
| **SEO intelligence** | `ai_memory` | `kind: "seo_learning"`, payload: score, suggestionCount, pageId | SEO intelligence is run on a page (score + suggestion count stored). |
| **Experiment outcomes** | `ai_experiment_memory` | Per-variant rows: experiment_id, variant, outcome (winner \| runner_up \| other), views, clicks, conversions, primary_metric, snapshot_at | An experiment is marked completed in backoffice (PATCH status → completed); winner detection runs and results are stored. |

## Where learning is written

- **lib/ai/memory/recordOutcome.ts** — Best-effort helpers that write to `ai_memory`: `recordSuggestionApplied`, `recordContentPublished`, `recordReleaseExecuted`, `recordSeoLearning`. Failures are opsLogged; they never throw to the caller.
- **lib/ai/memory/aiMemory.ts** — Low-level `insertAiMemory`, `insertAiMemoryBatch`, `listAiMemory` (unchanged).
- **lib/ai/experiments/experimentMemory.ts** — `insertExperimentMemoryBatch` used when an experiment is completed.
- **lib/ai/capabilities/storeExperimentLearning.ts** — Builds `ai_experiment_memory` records from detection result; invoked from experiment PATCH when status becomes completed.

## Live flows that feed memory

1. **Apply flow** — `POST /api/backoffice/ai/apply`: after logging to `ai_activity_log`, calls `recordSuggestionApplied` (tool, pageId, variantId, appliedKeys).
2. **Design suggestion apply** — `POST /api/backoffice/ai/design-suggestion/log-apply`: after `ai_activity_log`, calls `recordSuggestionApplied` with tool `layout_suggestions`.
3. **Variant publish** — `POST /api/backoffice/content/pages/[id]/variant/publish` (env=prod): after audit log, calls `recordContentPublished`.
4. **Release execute** — `POST /api/backoffice/releases/[id]/execute`: after `executeRelease`, calls `recordReleaseExecuted`.
5. **SEO intelligence** — `POST /api/backoffice/ai/seo-intelligence`: after `ai_activity_log` insert, calls `recordSeoLearning` (score, suggestionCount, pageId).
6. **Experiment completed** — `PATCH /api/backoffice/experiments/[id]` with `status: "completed"`: after `updateExperiment`, loads stats, runs `detectWinningVariant`, `storeExperimentLearning`, then `insertExperimentMemoryBatch` (best-effort; PATCH still succeeds if learning write fails).

## How this improves future AI behavior

- **Suggestions**: By querying `listAiMemory({ kind: "outcome" })` or filtering payload.area = `suggestion_applied`, prompts or ranking can favor tools and patch types that users actually apply.
- **Publish / release**: Outcome entries show which pages/variants reach prod; can inform which content paths are worth optimizing.
- **SEO**: `seo_learning` entries give a history of scores and suggestion counts per page; trends and high-impact pages can be prioritized.
- **Experiments**: `ai_experiment_memory` holds winner/runner_up/other per variant; future A/B or CRO suggestions can use historical winners and metrics (e.g. prefer variants similar to past winners).

All writes are best-effort (except apply route, where only the activity log is required for success); learning failures do not block the user-facing operation.
