# Umbraco migration — Phase 5 and Phase 6 pack

This folder contains an **execution-grade contract/spec pack** for **Phase 5** (migration engine + data cut) and **Phase 6** (editor-facing AI + access governance). It does **not** implement migrations, ETL code, preview, Delivery consumers, or cutover.

## Hard boundary

| Phase | Owns | Does not own |
|-------|------|----------------|
| **5** | Migration engine design, source→target manifest, ETL boundaries, idempotency/replay/dry-run, parity validation rules, media/redirect migration rules, legacy write freeze + read-only enforcement, migration observability/audit **requirements** | Content model redesign, preview/Delivery implementation, cutover execution, editorial pilot/training, operational data in CMS |
| **6** | Editor AI operating model (Umbraco context), automation identities (API Users), scopes, logging/audit/kill-switch, prompt/policy framework, Developer MCP non-prod boundary, separation editor AI / automation / domain AI | Migration ETL logic, transforming canonical migrated truth via AI, bypassing Workflow |

Phases **may run in parallel** only where responsibilities stay separated per [`70-phase-5-6-boundary-contract.md`](./70-phase-5-6-boundary-contract.md).

## Upstream contracts (source of truth)

| Pack | Path |
|------|------|
| Phase 0–1 | [`../phase-0-1/00-README.md`](../phase-0-1/00-README.md) |
| Phase 2–3 | [`../phase-2-3/00-README.md`](../phase-2-3/00-README.md) |
| Phase 4 | [`../phase-4/00-README.md`](../phase-4/00-README.md) |

**Phase 5 treats Phase 2–4 field ownership, document/element types, Delivery/Media/Preview/cache contracts as fixed.** Phase 6 treats Phase 0–1 AI/access locks as fixed. No redesign of those contracts occurs here.

## Artifact index — Phase 5

| File | Purpose |
|------|---------|
| [`50-phase-5-master.md`](./50-phase-5-master.md) | Phase 5 scope, ownership, dependencies, execution gate |
| [`51-migration-scope-and-boundary.md`](./51-migration-scope-and-boundary.md) | Sources in/out of scope, write vs read paths, anti–scope-creep |
| [`52-source-to-target-migration-manifest.md`](./52-source-to-target-migration-manifest.md) | Manifest specification (+ optional CSV) |
| [`53-etl-design-idempotency-and-replay.md`](./53-etl-design-idempotency-and-replay.md) | ETL design: extract/transform/load, idempotency, checkpoints |
| [`54-content-parity-validation-and-diff-rules.md`](./54-content-parity-validation-and-diff-rules.md) | Parity dimensions, diff rules, signoff |
| [`55-media-redirect-and-url-migration-spec.md`](./55-media-redirect-and-url-migration-spec.md) | CMS media, URLs, redirects, collisions |
| [`56-legacy-write-freeze-and-readonly-enforcement.md`](./56-legacy-write-freeze-and-readonly-enforcement.md) | Freeze declaration, enforcement, evidence |
| [`57-phase-5-risk-register.md`](./57-phase-5-risk-register.md) | Phase 5 risks only |
| [`58-phase-5-exit-checklist.md`](./58-phase-5-exit-checklist.md) | Binary gate for Phase 5 signoff |

## Artifact index — Phase 6

| File | Purpose |
|------|---------|
| [`60-phase-6-master.md`](./60-phase-6-master.md) | Phase 6 scope, three-lane boundary, workflow non-weakening |
| [`61-ai-operating-model-and-boundary.md`](./61-ai-operating-model-and-boundary.md) | Lanes A/B/C: purpose, allowed/forbidden, identity |
| [`62-editor-ai-capability-matrix.md`](./62-editor-ai-capability-matrix.md) | Editor-facing capabilities (+ optional CSV) |
| [`63-automation-api-user-and-scope-matrix.md`](./63-automation-api-user-and-scope-matrix.md) | API Users and scopes (+ optional CSV) |
| [`64-ai-logging-audit-and-kill-switch.md`](./64-ai-logging-audit-and-kill-switch.md) | Logging, retention, alerts, kill-switch |
| [`65-prompt-policy-and-prohibited-actions.md`](./65-prompt-policy-and-prohibited-actions.md) | Prompt classes, PII, no silent publish |
| [`66-developer-mcp-boundary-and-nonprod-rules.md`](./66-developer-mcp-boundary-and-nonprod-rules.md) | MCP local/staging only |
| [`67-phase-6-risk-register.md`](./67-phase-6-risk-register.md) | Phase 6 risks only |
| [`68-phase-6-exit-checklist.md`](./68-phase-6-exit-checklist.md) | Binary gate for Phase 6 signoff |

## Cross-phase artifacts

| File | Purpose |
|------|---------|
| [`70-phase-5-6-boundary-contract.md`](./70-phase-5-6-boundary-contract.md) | Hard separation, handoffs, anti-patterns |
| [`71-manual-platform-actions-phase-5-6.md`](./71-manual-platform-actions-phase-5-6.md) | Tasks that cannot be completed inside the repo |
| [`72-open-blockers-phase-5-6.md`](./72-open-blockers-phase-5-6.md) | Real unresolved blockers for signoff |
| [`73-phase-5-6-readiness-for-phase-7.md`](./73-phase-5-6-readiness-for-phase-7.md) | Gate before pilot / editorial acceptance (Phase 7) |

## Optional structured files (machine-readable mirrors)

| File | Mirrors |
|------|---------|
| [`migration-manifest.csv`](./migration-manifest.csv) | Manifest rows (subset; full narrative in `52`) |
| [`parity-rules.csv`](./parity-rules.csv) | Parity dimensions and thresholds |
| [`api-user-scope-matrix.csv`](./api-user-scope-matrix.csv) | Automation identities |
| [`ai-capability-matrix.csv`](./ai-capability-matrix.csv) | Editor AI candidates |
| [`phase-5-risk-register.csv`](./phase-5-risk-register.csv) | `57` |
| [`phase-6-risk-register.csv`](./phase-6-risk-register.csv) | `67` |

## Intentionally deferred (later phases)

- **Phase 7+:** Pilot, training, production cutover runbooks, time-bounded dual-read if any, redirect catalog **execution**, Next.js Delivery/preview **implementation** (owned by Phase 4 contract + product delivery).
- **Not here:** Operational domain migration into CMS, SSO implementation, full plugin block **implementation** in Umbraco (inventory completion is a blocker, not this pack’s implementation).
- **Forbidden:** Treating Developer MCP as production editorial tooling; AI as migration authority; browser-held Management or provider secrets.

## Related repo pointers (legacy behavior, read-only)

- Editorial workflow / dual persistence: `docs/umbraco-parity/CP8_EDITORIAL_WORKFLOW_CONTRACT.md`
- AI governance (current app): `docs/umbraco-parity/U17_AI_GOVERNANCE_AND_POSTURE.md`
- Legacy CMS tables: `content_pages`, `content_page_variants`; APIs under `app/api/backoffice/content/`
