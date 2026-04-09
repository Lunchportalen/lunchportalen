# Developer MCP boundary and non-production rules

## 1. Positioning

**Developer MCP** is an **engineering productivity** tool for **local/staging** use. It is **not** part of production editorial workflow and **must not** be marketed or trained as an editor feature.

## 2. Who may use it

| Allowed | Not allowed |
|---------|-------------|
| Engineers with **corporate** machine policy | Editorial contractors without Security briefing |
| **Local** + **staging** environments | **Live** Umbraco mutations as **standard** practice |

## 3. What it may access

- **Staging** Umbraco **read** for debugging Delivery shape (if credentials provisioned).
- **Local** dev databases **without** production PII snapshot (or masked).

## 4. What it must never access

| Forbidden | Why |
|-----------|-----|
| **Live** Management API write tokens | Program lock |
| **Production** secrets in MCP server config committed to repo | Secret leak |
| **Customer PII** bulk exports | GDPR / policy |

## 5. No production editorial workflow use

- Editors **do not** use MCP.
- **No** MCP step in **Workflow** diagrams.

## 6. Audit / logging expectations

- MCP server access logs (if available) reviewed **quarterly**.
- Any **staging** write via MCP must have **ticket** reference (engineering).

## 7. Disabling outside allowed environments

| Control | Detail |
|---------|--------|
| **Network** | MCP server binds **localhost** only in dev |
| **Secrets** | Production keys **not** present in dev tools profile |
| **CI** | No MCP in production deploy pipelines |

## 8. Relation to Phase 6 exit

[`68-phase-6-exit-checklist.md`](./68-phase-6-exit-checklist.md) requires **explicit** boundary documentation — satisfied by this file + acknowledgment in runbooks.
