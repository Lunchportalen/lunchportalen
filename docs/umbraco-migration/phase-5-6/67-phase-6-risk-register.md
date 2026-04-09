# Phase 6 risk register

| ID | Description | Why it matters now | Owner | Mitigation | Severity | Confidence |
|----|-------------|-------------------|-------|------------|----------|------------|
| R6.1 | **API User over-privilege** | Blast radius; silent wide change | Security | Matrix `63`; separate users | High | High |
| R6.2 | **Browser secret exposure** | Account takeover | Lead developer | Server-only proxy; lint/check bundles | High | High |
| R6.3 | **AI capability creep** | Shadow governance | Editorial lead | Capability matrix + change control | Medium | Medium |
| R6.4 | **Prompt/policy drift** | Compliance failure | Security | Versioned `policy_version` | Medium | Medium |
| R6.5 | **Silent content mutation** | Trust loss | CTO | Logging anomaly alerts `64` | High | Medium |
| R6.6 | **Cross-tenant leakage** | Critical security | Security | Tenant-scoped data in prompts | High | Medium |
| R6.7 | **Missing audit trail** | Non-compliance | Platform admin | Required fields `64` | High | High |
| R6.8 | **Kill-switch failure** | Cannot stop incident | Platform admin | Runbook + synthetic test | Medium | Medium |
| R6.9 | **MCP misuse** | Live mutation | Engineering manager | `66` + access reviews | Medium | High |

**CSV mirror:** [`phase-6-risk-register.csv`](./phase-6-risk-register.csv)
