# Manual platform actions — Phase 7

Tasks that **cannot** be completed inside this repo honestly. Each row: **action** · **why manual** · **owner** · **prerequisite** · **blocking severity**.

| # | Action | Why manual | Owner | Prerequisite | Blocking severity |
|---|--------|------------|-------|--------------|---------------------|
| P7-1 | **Create / invite** pilot Umbraco users (Authors, Approvers) | Identity lives in IdP / Umbraco Cloud | Platform admin | Pilot cohort list ([`71`](./71-pilot-scope-and-cohort.md)) | **Blocker** |
| P7-2 | **Assign** user groups / Workflow roles | Umbraco Cloud RBAC | CMS admin | [`35`](../phase-2-3/35-rbac-workflow-editor-matrix.md) signed | **Blocker** |
| P7-3 | **Verify** Workflow stages match matrix | Cloud UI / config | CMS admin | Phase 4 PB4 / B4 closed or accepted | **Blocker** |
| P7-4 | **Provision** staging Next env (Delivery URL, secrets, preview) | Hosting / Vercel/Render/etc. | Platform admin + Lead dev | Phase 4 contracts | **Blocker** |
| P7-5 | **Smoke-test** Delivery + Media Delivery + index | Cloud portal + APIs | Platform admin | Phase 4 checklist row 15 | **Blocker** |
| P7-6 | **Configure** preview URL / signing | Umbraco ↔ host DNS + secrets | Platform admin + Security | Phase 4 `43` | **Blocker** for S6 |
| P7-7 | **Seed or import** representative staging content | CMS operational | Migration lead + CMS admin | ETL dry-run or manual | **Blocker** |
| P7-8 | **Set up** support channel (tag, board) | Org tooling | Support owner | — | **Blocker** |
| P7-9 | **Schedule** training sessions | Calendar | Editorial lead | [`73`](./73-training-and-enablement-plan.md) | **Blocker** |
| P7-10 | **Grant** read access to **audit / logs** for evidence | SIEM / Cloud logs | Security + Platform admin | [`64`](../phase-5-6/64-ai-logging-audit-and-kill-switch.md) / X7 | **High** if AI in pilot |
| P7-11 | **Confirm** no **production** pilot execution | Governance | CTO | Charter | **Blocker** if violated |
| P7-12 | **Webhook** endpoint registration on staging | External URL | Lead dev | Phase 4 `46` | **High** for S11 SLA claims |

## Notes

- **P7-11:** Phase 7 pack assumes **staging-only** execution; production pilot requires **separate** written approval (outside this document set).
