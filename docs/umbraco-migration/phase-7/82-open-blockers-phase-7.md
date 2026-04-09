# Open blockers — Phase 7 signoff

**Only real items** that prevent **honest Phase 7 signoff** if unresolved. Carried from earlier phases **without** re-litigation.

**Policy:** If an item is **closed**, remove the row and add **date + link** to evidence (do not leave stale rows).

## Upstream carry-forward (Phase 2–3 / 4 / 5–6)

| ID | Blocker | Blocks Phase 7 because | Owner | Target resolution |
|----|---------|------------------------|-------|-------------------|
| **U-B1** | **`appShellPage` / overlays** ([`37`](../phase-2-3/37-open-questions-and-blockers.md) B1 / [`51`](../phase-4/51-open-blockers-phase-4.md) PB1 / [`72`](../phase-5-6/72-open-blockers-phase-5-6.md) X1) | Pilot “whole site” claims ambiguous; manifest incomplete for overlay routes | Product owner + Solution architect | Written decision + pilot scope update |
| **U-B2** | **Public locale strategy** ([`B2`](../phase-2-3/37-open-questions-and-blockers.md) / PB2 / X2) | S5 vs S5-alt; preview/publish culture checks | CTO + Product owner | Signed locale policy |
| **U-B3** | **Plugin block inventory** ([`B3`](../phase-2-3/37-open-questions-and-blockers.md) / PB3 / X3) | Unknown blocks → false parity | Migration lead + Lead developer | Closed inventory or signed quarantine |
| **U-B4** | **Workflow proof on staging** ([`B4`](../phase-2-3/37-open-questions-and-blockers.md) / PB4 / X4) | Cannot validate S7–S10 | Platform admin + CMS admin | Staging matches [`35`](../phase-2-3/35-rbac-workflow-editor-matrix.md) |
| **U-PB5** | **Delivery + Media + index evidence** ([`51`](../phase-4/51-open-blockers-phase-4.md) PB5 / X5) | S10/S11 not authoritative | Platform admin | Dated verification per Phase 4 exit row 15 |
| **U-PB6** | **Media alt / SVG policy** ([`51`](../phase-4/51-open-blockers-phase-4.md) PB6 / X6) | S4 acceptance ambiguous | Product + Accessibility | Sign L1–L3 or defer |
| **U-X7** | **Log retention destination** ([`72-open-blockers-phase-5-6`](../phase-5-6/72-open-blockers-phase-5-6.md) X7) | AI/audit evidence incomplete if editor AI in pilot | Platform admin + Security | SIEM/store + retention |
| **U-X8** | **AI subprocessors / DPA** ([`72-open-blockers-phase-5-6`](../phase-5-6/72-open-blockers-phase-5-6.md) X8) | Legal basis for editor AI | Legal + Security | Agreement on file |
| **U-X9** | **Legacy write-freeze monitoring** ([`72-open-blockers-phase-5-6`](../phase-5-6/72-open-blockers-phase-5-6.md) X9) | Cannot prove **A6** ([`76`](./76-editorial-acceptance-metrics-and-evidence.md)) in prod-relevant way | Lead developer + Platform admin | Metrics per [`56`](../phase-5-6/56-legacy-write-freeze-and-readonly-enforcement.md) |

## Phase 7 execution blockers (local)

| ID | Blocker | Blocks because | Owner | Target resolution |
|----|---------|----------------|-------|-------------------|
| **P7-A** | Pilot **accounts / groups** not provisioned | Cannot run [`72`](./72-editorial-scenario-matrix.md) | Platform admin | [`80`](./80-manual-platform-actions-phase-7.md) |
| **P7-B** | **Training** not completed | Invalid autonomy metrics | Editorial lead | [`73`](./73-training-and-enablement-plan.md) |
| **P7-C** | **Phase 4/5/6 exit** not **YES** per program ([`73-phase-5-6-readiness-for-phase-7`](../phase-5-6/73-phase-5-6-readiness-for-phase-7.md)) | Pilot not program-approved | CTO | Close upstream exits or formal NO-GO |

## Formal acceptance of unresolved upstream

If a blocker remains open, Phase 7 **pack** may still exist, but **signoff** requires **named owner + decision date + risk acceptance** logged in this file:

| Blocker ID | Accepted by | Date | Expiry | Link to evidence |
|------------|-------------|------|--------|------------------|
| *(none until signed)* | | | | |

## Current Phase 7 status (documentation state)

This repository’s Phase 4/5/6 **exit checklists** are **templates** (YES/NO not filled in repo). Until **signed** with evidence links, **honest** Phase 7 signoff remains **NOT READY** — see [`83`](./83-phase-7-exit-checklist.md).
