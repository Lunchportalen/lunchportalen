# AI and access model (Phase 0–1 lock)

## Editorial (human) access

- **Umbraco backoffice** is the only **production** context for **editor-facing AI** that **mutates or proposes** changes to **migrated public website CMS content**.
- Where the product requires a token for AI features, use **the current editor’s backoffice session** (product-native) or a **server-side proxy** owned by the Umbraco/Cloud boundary — **never** expose management or provider secrets to the browser for privileged operations.

## External automation access

- **Dedicated API Users** with **least privilege** — one credential set per integration purpose (e.g. “staging content smoke”, “search index”, **not** one mega-key).
- **Management API** (if used): callable **only** from **server-side** automation with **documented** scopes; **forbidden** from browser or mobile clients.

## Developer MCP

- **Local/staging only.**
- **Never** part of production editorial workflow.
- **Never** holds production secrets in developer machines beyond personal dev rules (still: no live mutation as standard practice).

## No browser-exposed management secrets

Any design where **Delivery API keys**, **API User client secrets**, **webhook signing secrets**, or **AI provider keys** ship to the client bundle or are readable from DevTools is **INVALID** and must be redesigned to **server-only** configuration.

## No silent AI publish

- AI may **suggest** or **draft** per product/policy.
- **Publish** or **production-visible apply** requires **human workflow** (Umbraco Workflow) unless a **future** Security-signed exception exists for a **specific** batch job — default for Phase 0–1: **no AI publish**.

## Attribution

Every AI-assisted change must be attributable to:

- a **named Umbraco user** (interactive), or  
- a **service identity** (batch) recorded in logs with **correlation ID** / **run ID**.

Anonymous or unattributable AI application to live content is **forbidden**.

## Prohibited actions

| Prohibited | Rationale |
|------------|-----------|
| Client-side calls to Management API with secrets | Secret exfiltration / account takeover |
| Shared personal admin account for CI/automation | No attribution; violates least privilege |
| Production MCP editing live content | Program lock |
| AI overriding Workflow | Governance bypass |
| Training on customer content without legal basis | Data governance violation (default: no) |

## Required logging / audit

- **Umbraco:** product audit/history for content and workflow (authoritative for editorial).
- **Application:** retain operational audit for orders/tenants/etc.; AI **orchestration** that remains in Next during transition must log **rid**/correlation until decommissioned.
- **Cross-boundary:** document where to investigate “who changed the homepage” post-migration — answer must be **Umbraco**, not legacy Postgres editor.

## Kill-switch requirement

- **AI features** must have an **operational kill-switch** (feature flag or env) that **disables** AI endpoints/proxy **without** redeploying editorial content — owner: CTO + Security.
- **Incident playbook:** who flips switch, who communicates to editorial (Phase 2+ runbook; **requirement** locked now).

## Relation to current repo (`U17`)

`docs/umbraco-parity/U17_AI_GOVERNANCE_AND_POSTURE.md` describes **today’s** Next `/api/backoffice/ai/*` posture. **Target:** editor-facing AI for **site content** **moves** to **Umbraco context**; legacy Next AI routes for that scope are **retired** at cutover. Operational AI (if any) remains governed separately and must not become a **shadow editorial** path.
