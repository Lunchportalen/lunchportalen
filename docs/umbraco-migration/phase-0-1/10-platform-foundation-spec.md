# Platform foundation spec (Phase 1)

Defines the **clean Umbraco Cloud foundation** without assuming provisioning is complete.

## Required Umbraco Cloud environments

| Environment | Role |
|-------------|------|
| **dev** | Schema and integration development |
| **staging** | Governance rehearsal, Delivery/Media integration tests, preview experiments |
| **live** | Production editorial + public delivery |

**Naming:** Use **one** convention everywhere — e.g. `lp-cms-dev`, `lp-cms-stage`, `lp-cms-live` for project/environment slugs (exact names: **MANUAL PLATFORM ACTION** to record once created).

## Required access roles (human)

- **CMS Author** — draft/edit in dev/staging/live per policy.
- **CMS Editor** — editorial actions per group mapping.
- **CMS Approver** — Workflow approve rights on live (strictly limited headcount).
- **CMS Admin** — technical admin (users, packages where allowed); **not** default for authors.

## Separation: humans vs API Users vs automation

| Actor type | Use for | Must not |
|------------|---------|----------|
| **Human Umbraco user** | Day-to-day editing, approvals | Share password with scripts |
| **API User** | Server-side automation, CI, integrations | Full admin scopes “just because” |
| **Personal dev account** | Local/staging experiments | Production content changes as routine |

## Foundation setup sequence

1. **Portal:** Create Cloud project; enable environments (dev/staging/live). **MANUAL PLATFORM ACTION.**
2. **Portal:** Confirm Umbraco major version aligns with Delivery/Media/Workflow requirements. **MANUAL PLATFORM ACTION.**
3. **Portal:** Enable **Workflow**; verify license. **MANUAL PLATFORM ACTION.**
4. **Portal:** Enable **Delivery API**; plan **content index rebuild** after model changes. **MANUAL PLATFORM ACTION.**
5. **Portal:** Enable **Media Delivery API** if separate. **MANUAL PLATFORM ACTION.**
6. **Portal:** Create **baseline human groups** (empty or template). **MANUAL PLATFORM ACTION.**
7. **Portal:** Create **API User** stubs (no secrets in repo). **MANUAL PLATFORM ACTION.**
8. **Repo (Phase 2+):** Wire Next env vars to staging first — **not** Phase 1 code change unless explicitly approved; Phase 1 only **documents** variable names in `12-secrets-and-environment-matrix.md`.

## Repo-side work vs portal-side work (Phase 1)

| Work item | Side |
|-----------|------|
| ADR, matrices, checklists, risk register | Repo |
| Create project/environments, DNS, certs | **Portal** |
| Workflow + Delivery + Media toggles | **Portal** |
| API User creation, secret rotation UI | **Portal** |
| SSO IdP app registration | **Portal** + IdP admin |
| Implement Next fetch/webhooks | **Repo (Phase 2+)** — **not** Phase 1 |

## What cannot proceed until platform owners act

- Any **claim** of “foundation complete” without portal evidence.
- Phase 2 **integration coding** that needs real **Delivery URL + API key** (blocked until staging secrets exist).
- Editorial **training on Workflow** (blocked until staging Workflow configured).

## Exit reference

See `16-phase-1-exit-checklist.md` for binary gate.
