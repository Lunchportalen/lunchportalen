# Environment behavior matrix — dev, staging, live

Legend: **RC** = repo-controlled (code/docs), **PC** = portal-controlled (Umbraco Cloud / DNS), **RT** = runtime-controlled (deployed app config + traffic).

## Matrix

| Row | dev | staging | live |
|-----|-----|---------|------|
| **Delivery API state** | PC: enable on dev Cloud env when exists; RT: Next **may** point to stub/mock **only** for local dev **without** secrets in git | PC: **must** be enabled for integration proof; RT: server env with **staging** Delivery URL + key | PC: **must** be enabled; RT: **live** keys only |
| **DeliveryApiContentIndex** | PC/RT: rebuild after model change **when** dev Cloud used | PC/RT: **mandatory** after deploy affecting content types | PC/RT: **mandatory** after deploy; ops runbook |
| **Media Delivery API state** | PC: enable if media tested | PC: **must** match staging content tests | PC: **must** be enabled for public images |
| **Preview state** | RT: **may** be disabled locally; PC: preview URL target **should** point to dev/staging Next | PC + RT: **full** preview path **required** for signoff | PC + RT: **required** before editors rely on preview |
| **Webhook state** | RT: optional; **ngrok**-style receiver acceptable | PC: register URL to **staging** Next handler when implemented | PC: production URL + secret rotation |
| **Caching state** | RT: aggressive no-cache acceptable | RT: **mirror** live policy for rehearsal | RT: webhook + tags per `45` |
| **Secrets location** | RT: `.env.local` / host secrets **never committed** (RC: `.env.example` placeholders only) | PC + RT: Cloud + Vercel/host secret store | PC + RT: production store; **rotation calendar** |
| **Allowed clients** | Developers | Internal + QA + agency **named** | Public anonymous (published); editors via Umbraco |
| **Test obligations** | Smoke: Delivery returns expected shape for **one** page | E2E: publish → visible within SLO; preview **noindex** | Same + load + security scan of webhook |
| **Manual platform actions** | Create dev project, invite users | Staging parity, Workflow proof (B4) | DNS, CDN, keys, webhook URLs |

## Separation of control

| Control type | Examples |
|--------------|----------|
| **Repo-controlled** | Documentation, `.env.example` keys naming, **implementation** in Phase 5+ |
| **Portal-controlled** | Enable Delivery API, Media Delivery API, webhook registration, Cloud user invites, index rebuild triggers in portal |
| **Runtime-controlled** | Env vars on Next host, `NEXT_PUBLIC_*` only for **non-secret** config, traffic routing |

## Related extract

- [environment-behavior-matrix.csv](./environment-behavior-matrix.csv)
