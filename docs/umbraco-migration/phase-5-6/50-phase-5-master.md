# Phase 5 master — migration engine + data cut

## 1. Scope statement (migrated CMS content only)

Phase 5 defines **how** public website **CMS editorial content** (per Phase 2–3) moves from **legacy sources** into **Umbraco** with:

- A **signed migration manifest** (no silent field loss or undocumented transforms).
- **ETL design** including idempotency, replay, dry-run, checkpoints, and failure semantics.
- **Parity validation** rules (what “good” means before humans sign content).
- **Media and URL/redirect** migration rules for **CMS-owned** assets and routes.
- **Legacy write freeze** and **read-only enforcement** design for migrated types — **no permanent dual write**.
- **Observability and audit requirements** for migration runs (not implementation of Umbraco product audit — that remains editorial truth post cutover).

**Operational data** (menu, menuContent, weekPlan, orders, tenants, billing, immutable logs, etc.) is **out of scope** for CMS migration and must not be pulled into Umbraco via Phase 5 ETL.

## 2. What Phase 5 owns

| Area | Deliverable |
|------|-------------|
| Boundaries | [`51-migration-scope-and-boundary.md`](./51-migration-scope-and-boundary.md) |
| Contract rows | [`52-source-to-target-migration-manifest.md`](./52-source-to-target-migration-manifest.md) + [`migration-manifest.csv`](./migration-manifest.csv) |
| ETL semantics | [`53-etl-design-idempotency-and-replay.md`](./53-etl-design-idempotency-and-replay.md) |
| Quality gate | [`54-content-parity-validation-and-diff-rules.md`](./54-content-parity-validation-and-diff-rules.md) + [`parity-rules.csv`](./parity-rules.csv) |
| URLs/media | [`55-media-redirect-and-url-migration-spec.md`](./55-media-redirect-and-url-migration-spec.md) |
| Authority cut | [`56-legacy-write-freeze-and-readonly-enforcement.md`](./56-legacy-write-freeze-and-readonly-enforcement.md) |
| Risks / exit | [`57-phase-5-risk-register.md`](./57-phase-5-risk-register.md), [`58-phase-5-exit-checklist.md`](./58-phase-5-exit-checklist.md) |

## 3. What Phase 5 explicitly does NOT do

- **Redesign** document types, element types, field ownership, Workflow stages, or Delivery/Preview/Media/cache contracts (Phase 2–4 locked).
- **Implement** ETL code, run production/staging ETL, or mutate live data.
- **Implement** Next.js Delivery/preview consumers, webhooks, or cutover toggles.
- **Use AI** to decide canonical migrated content or as the default transformation path (optional human-reviewed remediation only — see [`70-phase-5-6-boundary-contract.md`](./70-phase-5-6-boundary-contract.md)).
- **Solve** editor-facing AI product design beyond **migration-adjacent** logging boundaries (Phase 6).

## 4. Dependency on signed Phase 0–4 outputs

| Dependency | Why |
|------------|-----|
| Phase 2–3 content model + field disposition | Defines **target** properties and **forbidden** blob authority |
| Phase 2–3 `25-field-disposition-register.md` + CSV | Every disposition must appear in manifest with transform + validation |
| Phase 4 published/preview/media/cache/webhook **contracts** | Migration must not assume different Delivery shapes or secret placement |
| Phase 4 `51-open-blockers-phase-4.md` | Unresolved PB1–PB6 **carry forward**; they constrain manifest completeness and parity |

Until Phase 4 **exit criteria** are satisfied **or** each blocker has **named owner + decision date + risk acceptance** (per Phase 4 rules), **honest** “ready to execute migration” is **not** claimed.

## 5. Hard gate: no real migration execution before Phase 5 exit

**No bulk load, no production cut, no irreversible legacy deprecation** for migrated content types may begin until:

1. [`58-phase-5-exit-checklist.md`](./58-phase-5-exit-checklist.md) is **fully YES**.
2. [`72-open-blockers-phase-5-6.md`](./72-open-blockers-phase-5-6.md) has **no undocumented blocker-grade ambiguity** (each item closed or explicitly accepted with owner/date).

Phase 5 completion = **design + contracts + gates explicit**. It does **not** mean ETL has run.

## 6. Relationship to Phase 7

Phase 7 (pilot / editorial acceptance / rollout sequencing) starts only after Phase 5 **and** Phase 6 readiness per [`73-phase-5-6-readiness-for-phase-7.md`](./73-phase-5-6-readiness-for-phase-7.md), **and** upstream Phase 4 gates as applicable.
