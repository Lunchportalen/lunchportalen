# Umbraco migration — Phase 0–1 package

This folder contains an **execution-grade** sign-off and foundation pack for the **Headless Umbraco on Umbraco Cloud + Next.js shell** program.

## Scope boundary (hard)

- **In scope:** Phase 0 (decision lock) and Phase 1 (clean platform foundation) only.
- **Out of scope:** Content models, ETL, preview implementation, content migration, runtime application changes, and any Phase 2+ delivery work except where named as a **dependency** or **blocker**.

## Contents

| File | Purpose |
|------|---------|
| [01-ADR-headless-umbraco-target.md](./01-ADR-headless-umbraco-target.md) | Architecture Decision Record — locked target and consequences |
| [02-authority-boundary-matrix.md](./02-authority-boundary-matrix.md) | Single source of truth per concern (current → target) |
| [03-scope-boundary.md](./03-scope-boundary.md) | What moves, what stays, what is excluded, what is forbidden |
| [04-cloud-fit-check.md](./04-cloud-fit-check.md) | Umbraco Cloud assumptions, risks, manual confirmations |
| [05-workflow-governance-decision.md](./05-workflow-governance-decision.md) | Umbraco Workflow as governance parity requirement |
| [06-ai-and-access-model.md](./06-ai-and-access-model.md) | Editor AI, API Users, MCP, audit, kill-switch |
| [07-phase-0-signoff-checklist.md](./07-phase-0-signoff-checklist.md) | Phase 0 sign-off by role |
| [10-platform-foundation-spec.md](./10-platform-foundation-spec.md) | Environments, roles, foundation sequence |
| [11-access-rbac-and-api-users.md](./11-access-rbac-and-api-users.md) | RBAC, API Users, forbidden combinations |
| [12-secrets-and-environment-matrix.md](./12-secrets-and-environment-matrix.md) | Secrets/config for Phase 1 only |
| [13-preview-delivery-foundation-prereqs.md](./13-preview-delivery-foundation-prereqs.md) | Delivery/Media API and preview prerequisites (no implementation) |
| [14-manual-platform-actions.md](./14-manual-platform-actions.md) | Tasks that **cannot** be completed inside this repo |
| [15-risk-register-phase-0-1.md](./15-risk-register-phase-0-1.md) | Phase 0–1 risks only |
| [16-phase-1-exit-checklist.md](./16-phase-1-exit-checklist.md) | Hard gate before Phase 2 |

## How to use

1. Complete **Phase 0** sign-offs (`07-phase-0-signoff-checklist.md`) against `01`–`06` and `02`–`05` in particular.
2. Execute **Phase 1** foundation per `10`–`14`, tracking **MANUAL PLATFORM ACTION** items honestly.
3. Do not enter **Phase 2** until `16-phase-1-exit-checklist.md` is fully satisfied.

## Related repo context (read-only pointers)

- Editorial workflow contract (legacy dual persistence): `docs/umbraco-parity/CP8_EDITORIAL_WORKFLOW_CONTRACT.md`
- Management vs delivery surfaces: `docs/umbraco-parity/U30X_READ_R3_MANAGEMENT_VS_DELIVERY_PROOF.md`
- AI governance posture (current app): `docs/umbraco-parity/U17_AI_GOVERNANCE_AND_POSTURE.md`
- Operational menu publish chain (legacy): `docs/cms-control-plane/CMS_NATIVE_MENU_PUBLISH_CONTROL.md`

These documents describe **today’s** system. The **target authority** for public website CMS content after cutover is **Umbraco only**, per the ADR in this folder — not as a debate, but as program law.
