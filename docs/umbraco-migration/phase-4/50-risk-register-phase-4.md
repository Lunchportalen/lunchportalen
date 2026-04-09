# Phase 4 risk register

Only **Phase 4** delivery/read-path risks.

| ID | Description | Why it matters now | Owner | Mitigation | Severity | Confidence |
|----|-------------|-------------------|-------|------------|----------|------------|
| R4.1 | Delivery API **enabled** but **DeliveryApiContentIndex** not rebuilt | Published exists in backoffice but **404/empty** in Delivery | Platform admin | Checklist + post-deploy runbook; automated smoke | **High** | **High** |
| R4.2 | Public exposure **too broad** (internal properties in Delivery) | Data leak / attack surface | CMS admin + Security | Delivery API content settings review; DT audit | **High** | **Medium** |
| R4.3 | Preview **token leakage** (logs, referrer, shared links) | Unauthorized draft view | Security | Short TTL, audit, noindex, training | **High** | **Medium** |
| R4.4 | Published vs preview **mismatch** (different code paths drift) | Editors approve wrong thing | Lead dev | Shared mapping core; contract tests | **Medium** | **Medium** |
| R4.5 | **Media metadata loss** in ETL (alt, focal) | Accessibility + brand regression | Migration lead | Field mapping signoff from Phase 2–3 | **Medium** | **Medium** |
| R4.6 | **Stale cache** after publish (no webhook fan-out) | Marketing incidents | Infra | Webhooks + multi-instance strategy (`45`) | **High** | **High** |
| R4.7 | Webhook **drift** or silent failure | Stale site until TTL | Infra | Monitoring, alerts, idempotency | **High** | **High** |
| R4.8 | **Protected content** ambiguity | Accidental public draft | Security | `47` locked out-of-scope; revisit if charter changes | **Low** (wave 1) | **High** |
| R4.9 | **Load-balanced** Next cache inconsistency | Some users see old version | CTO | Shared invalidation or short TTL | **Medium** | **High** |
| R4.10 | **Unsupported property** output from custom editors | Runtime crashes / blank sections | Lead dev | Payload samples on staging; blockers list | **Medium** | **Medium** |
| R4.11 | **Culture / URL** ambiguity (`en` vs `nb`) | Wrong 404 or duplicate content | Product + CTO | Close B2 | **High** | **High** (if open) |
| R4.12 | **Overlay / app shell** ownership unset (B1) | Wrong fetch target for some routes | Product | Resolve tree ownership | **High** | **High** (if open) |

## CSV extract

- [phase-4-risk-register.csv](./phase-4-risk-register.csv)
