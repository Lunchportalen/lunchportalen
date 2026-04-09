# Automation API User and scope matrix

**Least privilege mandatory.** No broad admin automation by default.  
**CSV mirror:** [`api-user-scope-matrix.csv`](./api-user-scope-matrix.csv)

| identity_name | purpose | environment | is_api_user | scope_boundaries | allowed_operations | forbidden_operations | rotation_owner | audit_requirement | emergency_disable_path |
|---------------|---------|-------------|-------------|------------------|--------------------|------------------------|----------------|---------------------|------------------------|
| `au-migration-etl-staging` | Staging bulk import | Staging | Yes | Subtree `/content/migration-staging` (example) | Create/update **draft** nodes per manifest | Publish; delete production; user admin | Platform admin | Per-run log to SIEM | Revoke secret + disable job |
| `au-migration-etl-live` | Live import **only** if approved | Live | Yes | Narrowest DT allowlist | Update **draft** only | Publish **unless** signed break-glass | CTO delegate | Full audit | Revoke secret |
| `au-delivery-readonly-smoke` | Verify Delivery JSON | Staging/Live | Yes | **Delivery API read** only | GET published content | Any Management write | Lead developer | CI artifact | Rotate read key |
| `au-webhook-verifier` | Signature verify (app side) | Staging/Live | N/A app secret | Webhook secret in **server env only** | Verify HMAC | N/A | Platform admin | Access logs | Rotate webhook secret |
| `au-search-indexer` | External index | TBD | Yes | Delivery read + optional Management **read** | Read | Write **unless** explicitly approved | Security | Job logs | Disable indexer |
| `au-ci-content-snapshot` | PR preview data | Dev | Yes | Dev environment only | Read | Live access | Lead developer | Minimal | Delete user |
| `shared-mega-admin-key` | **FORBIDDEN** | — | — | — | — | **Any** | — | — | **Do not create** |

## Rules (from Phase 0–1 reinforced)

1. **New integration ⇒ new API User** (or documented extension).
2. **Separate** credentials per environment.
3. **Automation does not approve Workflow** unless Security exception with expiry.
4. **Never** embed in Next client bundle.

## Handoff to implementation

Exact Umbraco Cloud **scope names** are **version/product specific** — fill after environment exists; this matrix defines **intent** and **boundaries**.
