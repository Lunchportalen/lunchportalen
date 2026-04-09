# Secrets and environment matrix (Phase 1 only)

**Rule:** For every row, if the value is not yet created, status = **PENDING — MANUAL PLATFORM ACTION**. Do not invent values in the repo.

| Secret / config | Owner (rotate) | Environment | Where it lives | Who can read | Who can rotate | Browser exposure |
|-----------------|----------------|-------------|----------------|--------------|----------------|------------------|
| **Delivery API key** (or equivalent) | CTO / platform admin | dev, staging, live | Umbraco Cloud portal + app host secret store (Phase 2+) | Infra leads; **not** all devs | CTO + named deputy | **FORBIDDEN** |
| **Media Delivery API key** | CTO / platform admin | dev, staging, live | Same as above | Same | Same | **FORBIDDEN** |
| **Preview secret** (if product uses signed preview) | CTO + Security | staging, live | Portal + server secret store | Infra + Security-reviewed consumers | CTO | **FORBIDDEN** |
| **Webhook signing secret** (revalidate / cache) | CTO | staging, live | Portal webhook config + Next server env | Infra | CTO | **FORBIDDEN** |
| **API User client id/secret** (Management or Delivery-scoped) | CTO per integration | per env | Portal; secrets in CI/host only | Integration owner + Infra | CTO | **FORBIDDEN** |
| **SSO/OAuth client secret** (Umbraco Cloud ↔ IdP) | Security + IT | staging, live | IdP admin + Cloud portal | Security + IdP admin | Security | **FORBIDDEN** |
| **AI provider key** (if used from Umbraco or bridge) | Security + CTO | staging, live | Server-only secret store | **Minimal** | Security | **FORBIDDEN** |
| **Logging/monitoring ingest key** (e.g. APM) | CTO | all | Observability vendor | Infra | CTO | **FORBIDDEN** if key allows write/control |

## Notes

- **Phase 1** only **names** these; wiring into Next is **Phase 2+** unless explicitly approved.
- **Read-only** Delivery keys still **must not** appear in browser — they enable scraping and abuse at scale.
- **Rotation:** every secret row must have a **calendar owner** by Phase 2 kickoff (add to ops calendar).

## AI provider secrets in Phase 1

If **no** AI is configured on Cloud in Phase 1, mark AI row **N/A — not yet provisioned** but **keep** the row — requirement remains for later phases.

## Verification

Security owner signs that **no Phase 1 documentation** embeds real secret values (only placeholders).
