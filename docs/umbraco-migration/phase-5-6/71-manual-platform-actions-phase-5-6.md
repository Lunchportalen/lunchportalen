# Manual platform actions — Phase 5 & 6

Tasks that **cannot** be completed honestly **inside this repo** alone.

| action | why_manual | owner | prerequisite | blocking_severity |
|--------|------------|-------|--------------|-------------------|
| Create **API Users** (migration ETL, Delivery smoke, indexer) | Umbraco Cloud / Identity portal | Platform admin | Staging project exists | **Blocker** for execution |
| Rotate API User secrets on schedule / incident | Vendor console | Security + Platform admin | User inventory | **Blocker** if compromised |
| Assign **Umbraco groups** + **Workflow** stages to real editors | Backoffice admin UI | CMS admin | RBAC matrix signed | **Blocker** for pilot |
| Configure **AI provider** keys + proxy endpoint | Cloud host / Umbraco config | Platform admin + Security | Provider contract signed | **Blocker** for editor AI |
| Configure **log sinks** (SIEM) + retention | Infra vendor | Platform admin | Budget + policy | **Blocker** for audit signoff |
| Configure **alerting** on AI/ETL anomalies | Observability stack | Platform admin | Log sink exists | High |
| Confirm **non-prod MCP** network fencing | Workstation / VPN policy | Engineering manager | Security policy | Medium |
| Set **host-side secrets** for automation (CI, workers) | Secrets manager | Lead developer | API Users created | **Blocker** for jobs |
| Enable **Delivery + Media Delivery + index rebuild** evidence | Umbraco Cloud portal | Platform admin | Phase 4 checklist row 15 | **Blocker** per Phase 4 for migration execution |
| Implement **DB/API write freeze** in **actual** infra | Supabase / app deploy | Lead developer | Freeze decision date | **Blocker** for cutover |
| Sign **locale (B2)** and **media alt (PB6)** policies | Executive/editorial | Product + A11y | Workshops | **Blocker** for honest manifest/parity |
| Close **overlay scope (B1)** decision | Product + Architect | Stakeholder review | **Blocker** for overlay manifest rows |
| Close **plugin block inventory (B3)** | Engineering | Code scan + DB sample | **Blocker** for ETL completeness |
| **Workflow proof** on staging | CMS admin | Umbraco Workflow enabled | **Blocker** for governance parity |

**Note:** Claiming these are “done” without portal/infra access is **invalid** — record **evidence** links in exit checklists when required.
