# Evidence archive — localized generator & GO tracks

**Status:** Index · docs-only  
**Reconciliation authority:** [`go-truth-state-reconciliation-2026-07-10.md`](./go-truth-state-reconciliation-2026-07-10.md)

This directory archives operator evidence for the localized fixed menu generator rollout, SOT gates, and related GO decisions. Evidence PRs are **docs-only** unless explicitly noted.

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded in markdown evidence.**

---

## Reconciliation & readiness

| Document | Role |
|----------|------|
| [`go-truth-state-reconciliation-2026-07-10.md`](./go-truth-state-reconciliation-2026-07-10.md) | **Authoritative truth index** — 21 markets, E2E, billing, SOT gates |
| [`final-scoped-sot-cutover-readiness-check.md`](./final-scoped-sot-cutover-readiness-check.md) | Pre-F4 scoped SOT readiness (#475) |
| [`final-sot-readiness-audit.md`](./final-sot-readiness-audit.md) | Gate E audit (#470) |
| [`final-phase-c-rollout-summary-readiness-audit.md`](./final-phase-c-rollout-summary-readiness-audit.md) | Phase C completion (#458) |
| [`localized-generator-launch-readiness-review.md`](./localized-generator-launch-readiness-review.md) | Launch readiness review |

---

## SOT gates (A–F)

| Gate | Document | PR chain |
|------|----------|----------|
| Staging matrix | [`localized-generator-9-locale-staging-matrix-evidence.md`](./localized-generator-9-locale-staging-matrix-evidence.md) | Staging operator run |
| B — Publish proof | [`localized-generator-publish-workflow-proof-evidence.md`](./localized-generator-publish-workflow-proof-evidence.md) | #469 |
| C — Rollback drill | [`localized-generator-rollback-drill-evidence.md`](./localized-generator-rollback-drill-evidence.md) | #468 |
| Visibility → MSDI | [`localized-generator-visibility-materialization-proof-evidence.md`](./localized-generator-visibility-materialization-proof-evidence.md) | #471 |
| F1 — Dry-run | [`localized-generator-sot-dry-run-proof-evidence.md`](./localized-generator-sot-dry-run-proof-evidence.md) | #474 |
| F4 — Scoped cutover | [`danish-sot-cutover-f4-evidence.md`](./danish-sot-cutover-f4-evidence.md) | #478 (partial · contained) |

---

## Phase B — single-provider apply

| Document | Locale |
|----------|--------|
| [`phase-b-melhus-production-apply-evidence.md`](./phase-b-melhus-production-apply-evidence.md) | nb-NO |
| [`phase-b-melhus-2031-08-04-apply-evidence.md`](./phase-b-melhus-2031-08-04-apply-evidence.md) | nb-NO |
| [`phase-b-provider-2-sv-se-onboarding-evidence.md`](./phase-b-provider-2-sv-se-onboarding-evidence.md) | sv-SE |
| [`phase-b-sv-se-production-apply-evidence.md`](./phase-b-sv-se-production-apply-evidence.md) | sv-SE |

---

## Phase C — per-locale evidence

| Locale | Onboarding | Generator apply |
|--------|------------|-----------------|
| da-DK | [`phase-c-da-dk-provider-onboarding-evidence.md`](./phase-c-da-dk-provider-onboarding-evidence.md) | [`phase-c-da-dk-generator-apply-evidence.md`](./phase-c-da-dk-generator-apply-evidence.md) |
| fi-FI | [`phase-c-fi-fi-onboarding-apply-evidence.md`](./phase-c-fi-fi-onboarding-apply-evidence.md) | [`phase-c-fi-fi-generator-apply-evidence.md`](./phase-c-fi-fi-generator-apply-evidence.md) |
| en-GB | [`phase-c-en-gb-onboarding-apply-evidence.md`](./phase-c-en-gb-onboarding-apply-evidence.md) · [`phase-c-en-gb-onboarding-dryrun-evidence.md`](./phase-c-en-gb-onboarding-dryrun-evidence.md) | [`phase-c-en-gb-generator-apply-evidence.md`](./phase-c-en-gb-generator-apply-evidence.md) |
| de-DE | [`phase-c-de-de-onboarding-apply-evidence.md`](./phase-c-de-de-onboarding-apply-evidence.md) · [`phase-c-de-de-onboarding-dryrun-evidence.md`](./phase-c-de-de-onboarding-dryrun-evidence.md) | [`phase-c-de-de-generator-apply-evidence.md`](./phase-c-de-de-generator-apply-evidence.md) |
| fr-FR | [`phase-c-fr-fr-onboarding-apply-evidence.md`](./phase-c-fr-fr-onboarding-apply-evidence.md) | [`phase-c-fr-fr-generator-apply-evidence.md`](./phase-c-fr-fr-generator-apply-evidence.md) |
| es-ES | [`phase-c-es-es-onboarding-apply-evidence.md`](./phase-c-es-es-onboarding-apply-evidence.md) | [`phase-c-es-es-generator-apply-evidence.md`](./phase-c-es-es-generator-apply-evidence.md) |
| it-IT | [`phase-c-it-it-onboarding-apply-evidence.md`](./phase-c-it-it-onboarding-apply-evidence.md) | [`phase-c-it-it-generator-apply-evidence.md`](./phase-c-it-it-generator-apply-evidence.md) |

Planning: [`phase-c-9-country-launch-readiness-plan.md`](./phase-c-9-country-launch-readiness-plan.md)

---

## Production launch & monitoring

| Document | Role |
|----------|------|
| [`localized-generator-production-evidence.md`](./localized-generator-production-evidence.md) | Generator production verification |
| [`production-launch-decision-audit.md`](./production-launch-decision-audit.md) | Launch decision |
| [`production-launch-publish-evidence.md`](./production-launch-publish-evidence.md) | Publish evidence |
| [`post-launch-monitoring-read-only.md`](./post-launch-monitoring-read-only.md) | Post-launch monitoring |
| [`pr430-production-smoke-evidence.md`](./pr430-production-smoke-evidence.md) | Provider mirror preflight (#431) |
| [`final-production-launch-owner-signoff.md`](./final-production-launch-owner-signoff.md) | Owner signoff |

---

## Related runbooks

- [`docs/runbooks/localized-generator-sot-rollout-readiness.md`](../runbooks/localized-generator-sot-rollout-readiness.md)
- [`docs/runbooks/phase-c-9-country-provider-rollout.md`](../runbooks/phase-c-9-country-provider-rollout.md)
- [`docs/engineering/localized-generator-sot-cutover-design.md`](../engineering/localized-generator-sot-cutover-design.md)
- [`docs/PROTECTED_GOLDEN_PATH.md`](../PROTECTED_GOLDEN_PATH.md)
