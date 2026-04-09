# Umbraco Cloud — fit check (Phase 0–1)

Brutal honesty: this document **assumes** Cloud until **portal-verified**. Nothing here claims provisioning is complete.

## Assumptions

1. **Umbraco Cloud** can host **dev / staging / live** with acceptable data residency and DPA for Norwegian/EU operations (confirm with vendor + legal).
2. **Headless Delivery API** and **Media Delivery API** are available and support the **separation** of public read from backoffice write for the chosen Umbraco major version on Cloud.
3. **Umbraco Workflow** can be licensed and enabled on the same Cloud project (or add-on path) for all editorial environments that need governance rehearsal.
4. **Network egress** from Next.js runtime (e.g. Vercel/Render/Azure) to Cloud Delivery endpoints is stable and allows **server-side only** secrets.
5. **Identity:** Editorial users log into **Umbraco Cloud backoffice**; application users do not “become” Umbraco users without explicit IAM design (Phase 2+).

## Required environments

| Environment | Purpose |
|-------------|---------|
| **Development** | Schema experiments, non-production content, integration dev |
| **Staging** | Parity testing, Workflow rehearsal, preview/Delivery integration tests against non-live data |
| **Live** | Production editorial + delivery |

Naming conventions: fixed in `10-platform-foundation-spec.md` — must be **one consistent scheme** across portal, DNS, and secrets.

## Access model assumptions

- **Humans:** Umbraco Cloud invites → backoffice; least privilege per group.
- **Automation:** **API Users** only — no sharing of human passwords with scripts.
- **CI/CD:** If used against Cloud, uses **API User** or vendor-approved deployment identity — not developer personal accounts.

## Deployment assumptions

- Next.js app deploy pipeline remains **independent** of Umbraco deploy but **coordinates** via env config (Delivery URLs, API keys, webhooks).
- Content **model** changes flow: dev → staging → live with a **governed** promotion (exact mechanics: **MANUAL PLATFORM ACTION** until documented from portal).

## Operational constraints

- Cloud **upgrade/maintenance windows** may affect editorial availability — need comms playbook (Phase 2+).
- **Rate limits / quotas** on Delivery/Media APIs may apply — must be validated under realistic traffic (Phase 2+ load assumptions).
- **Support and incident** ownership split: Cloud platform vs application team — RACI required before cutover.

## Risk if assumptions fail

| Failure | Impact |
|---------|--------|
| Workflow not available on chosen Cloud tier | **Governance parity impossible** — program blocker |
| Delivery/Media API not fit for Next consumption | Rework of integration architecture; timeline slip |
| Data residency / subprocessor rejection | Cannot use Cloud; **charter amendment** required (outside this task) |
| Secret leakage via client-side fetch | **INVALID** — must redesign to server-only |

## Cloud blockers

Items that **stop** Phase 2 until resolved (owner = platform/vendor + CTO):

1. **Workflow licensing** unavailable or not permitted on target Cloud plan.
2. **Headless Delivery** or **Media Delivery** not supported on the contracted Cloud SKU (version mismatch).
3. **Legal/DPA** rejection for Cloud processing of editorial content or PII in content.
4. **No API User** (or equivalent) model for least-privilege automation — forces brittle human-credentials automation (**forbidden** as standard).

## Cloud acceptable / not acceptable

| Acceptable | Not acceptable |
|------------|------------------|
| Server-side secrets for Delivery/Media API in Next runtime | Any secret embedded in client JS or browser storage for CMS management |
| Separate API Users per integration with minimal scopes | One “god” API User for all automations |
| Developer MCP on local/staging only | MCP connected to **live** editorial |
| Explicit manual steps documented as **MANUAL PLATFORM ACTION** | Pretending portal steps are done when they are not |

## What must be confirmed manually in the Umbraco Cloud portal

**MANUAL PLATFORM ACTION** — verify each item in the live portal (not in this repo):

- [ ] Project created; region/SKU documented.
- [ ] Dev / staging / live environments exist and naming matches spec.
- [ ] Custom hostnames / certificates (if any) planned or attached.
- [ ] **Workflow** product enabled and licensed where required.
- [ ] **Delivery API** enabled; content index rebuild procedure understood.
- [ ] **Media Delivery API** enabled separately (if applicable to version).
- [ ] **API Users** can be created with documented scopes.
- [ ] **Webhook** configuration surface available for future Phase 2+ (revalidate, etc.).
- [ ] **SSO** (if required): IdP app registration and Umbraco Cloud SSO settings — status documented as done/not done.

*This list is not exhaustive; it is the minimum honest Phase 0–1 bar.*
