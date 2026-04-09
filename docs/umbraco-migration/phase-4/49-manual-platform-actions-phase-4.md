# Manual platform actions — Phase 4

Tasks that **cannot** be completed honestly **inside this repository** alone. Each requires **portal**, **vendor console**, **DNS**, or **host** access.

| # | Action | Why manual | Owner | Prerequisite | Blocking severity |
|---|--------|------------|-------|--------------|-------------------|
| 1 | **Enable Content Delivery API** on Umbraco Cloud (per environment) | Cloud product toggle | Platform admin | Cloud project exists | **BLOCKING** for any real read test |
| 2 | **Rebuild `DeliveryApiContentIndex`** (or product-equivalent) after content model deploy | Index lives in Cloud/runtime | Platform admin + release lead | DT/Element deploy completed | **BLOCKING** — without it Delivery **lies** |
| 3 | **Enable / configure Media Delivery API** | Separate from Content Delivery | Platform admin | Media types defined | **BLOCKING** for image-heavy pages |
| 4 | **Confirm Delivery / Media base URLs** and **CORS** (if any browser-edge use **without** secrets) | Vendor networking | Platform admin + Security | None — **browser must never hold secrets** | **HIGH** if misconfigured |
| 5 | **Configure preview** (preview domain, Umbraco → Next URL template, signing if used) | Backoffice + Cloud | Platform admin + CTO | Staging Next URL stable | **BLOCKING** for preview signoff |
| 6 | **Register webhooks** (publish/unpublish/delete/media) to Next receiver URL | External endpoint registration | Platform admin | HTTPS route deployed (Phase 5+) | **BLOCKING** for live freshness SLO |
| 7 | **Create / rotate secrets** (Delivery key, Media key, webhook HMAC, preview secret) | Secret stores are not in git | CTO / Security | Secret naming from `12-secrets-and-environment-matrix.md` | **BLOCKING** |
| 8 | **DNS / hostname** for preview vs published (if split) | Infra | Infra | Domain ownership | **MEDIUM**–**HIGH** |
| 9 | **CDN / edge** rules (cache bypass for preview paths) | Infra | Infra | Preview path pattern known | **HIGH** for preview safety |
|10 | **Workflow on staging** enabled and stages match matrix | Product config | CMS admin | Groups exist | **BLOCKING** for B4 closure |
|11 | **Protected content auth** (only if charter changes) | Not in scope now | Security | Explicit new requirement | **N/A** today |

## Notes

- Rows 1–3 and 7 appear in Phase 0–1 `14-manual-platform-actions.md`; Phase 4 **elevates** index rebuild and webhook registration to **first-class** exit criteria.
- **Developer MCP** (per program law) remains **local/staging** only — **not** listed as production action.
