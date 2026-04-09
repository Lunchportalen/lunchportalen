# U38 Screen Proof

## Status

Screen proof is not complete on this machine.

## What Is Ready

- Screenshot directory exists: `docs/umbraco-parity/u38-screen-proof/`
- Local dev route is available on `http://localhost:3001`
- `app/api/auth/login-debug/route.ts` was fixed so cookie staging no longer crashes during local debug login

## Current Blocker

- No valid local superadmin credentials are configured, so the required authenticated captures cannot be taken yet.

## Required Pending Captures

| Route / state | Filename | Status |
| --- | --- | --- |
| `/backoffice/content` | `backoffice-content.png` | Pending |
| `/backoffice/content/[id]` | `backoffice-content-detail.png` | Pending |
| `/backoffice/settings` | `backoffice-settings.png` | Pending |
| `/backoffice/settings/document-types/[alias]` | `backoffice-settings-document-type.png` | Pending |
| `/backoffice/settings/data-types/[kind]` | `backoffice-settings-data-type.png` | Pending |
| `/backoffice/settings/create-policy` | `backoffice-settings-create-policy.png` | Pending |
| degraded tree state | `backoffice-tree-degraded.png` | Pending |
| degraded audit state | `backoffice-audit-degraded.png` | Pending |

## Bellissima Claim Boundary

Near-Umbraco-17 parity must remain conditional until these captures exist and are reviewed against the required routes.
