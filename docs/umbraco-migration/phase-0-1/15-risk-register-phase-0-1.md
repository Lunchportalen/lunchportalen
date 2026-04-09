# Risk register — Phase 0–1 only

| ID | Description | Why it matters now | Owner | Mitigation | Severity | Confidence |
|----|-------------|-------------------|-------|------------|----------|------------|
| R1 | **Cloud fit mismatch** (features, region, plan) | Wrong product path wastes Phase 2+ engineering | CTO | Complete `04-cloud-fit-check.md` portal confirmations; escalate to vendor early | High | STRONG INFERENCE |
| R2 | **Unresolved authority drift** (legacy editors still “own” site content) | Violates sole-authority cutover rule | Product + CTO | Sign `02-authority-boundary-matrix.md`; track legacy write paths as explicit sunset list (Phase 2) | High | CONFIRMED |
| R3 | **Workflow license / enablement delay** | Governance parity cannot be promised | Product + CTO | Purchase/enable early on **staging**; block Phase 2 go-live claims until proven | High | STRONG INFERENCE |
| R4 | **SSO ambiguity** (who logs into Umbraco, IdP ownership) | Onboarding editorial users fails at scale | Security + IT | Decide SSO in vs out for Phase 2; document in portal | Medium–High | POSSIBLE |
| R5 | **API User over-privilege** | Compromise = content tampering or data exfiltration | Security + CTO | Enforce `11-access-rbac-and-api-users.md`; review each key | High | CONFIRMED |
| R6 | **AI access mis-design** (browser secrets, silent publish) | Security + compliance failure | Security + CTO | Lock `06-ai-and-access-model.md`; architecture review before any AI in Cloud | High | CONFIRMED |
| R7 | **Hidden legacy write paths** (cron, scripts, admin tools) | Accidental dual authority post-cutover | CTO | Inventory in Phase 2; grep/release checklist for `/api/backoffice/content` writers | High | STRONG INFERENCE |
| R8 | **Preview/delivery prerequisites not locked** | Wrong caching or draft leakage live | CTO | `13-preview-delivery-foundation-prereqs.md` signed; no Phase 2 preview work without Delivery on staging | Medium–High | STRONG INFERENCE |

## Use

- Review in **Phase 0 sign-off** and **Phase 1 exit**.
- Add rows only for **Phase 0–1** concerns; migrate tactical risks to program RAID when Phase 2 starts.
