# Manual platform actions

Tasks that **cannot** be completed honestly inside this repository. Each requires a **human owner** with **portal/admin rights** or **vendor/licensing** access.

| Action | Why manual | Owner (assign) | Prerequisite | Blocking severity |
|--------|------------|----------------|--------------|-------------------|
| Create **Umbraco Cloud** project | Vendor portal | CTO / delegated platform admin | Budget + legal OK | **BLOCKER** for real integration |
| Provision **dev / staging / live** environments | Cloud console | Platform admin | Project exists | **BLOCKER** |
| Set **region / plan / SKU** | Cloud console | CTO + Product | DPA/residency | **BLOCKER** if wrong region |
| Enable **Umbraco Workflow** + confirm **license** | Portal + billing | Product + CTO | Contract | **BLOCKER** for governance parity |
| Enable **Delivery API** | Portal / project settings | Platform admin | Environment exists | **BLOCKER** for headless read |
| Run / schedule **content index rebuild** after changes | Portal or documented ops | Platform admin | Delivery enabled | **HIGH** if misunderstood |
| Enable **Media Delivery API** | Portal | Platform admin | Version supports it | **HIGH** for media-rich site |
| Create **human users** and **groups** | Portal | Editorial + Admin | IAM policy | **HIGH** |
| Create **API Users** + scopes | Portal | CTO + Security | Integration list | **HIGH** for automation |
| Issue **Delivery / Media API keys** | Portal | Platform admin | APIs enabled | **BLOCKER** for staging tests |
| Configure **webhooks** (future revalidate) | Portal | Platform admin | Public URL known | **MEDIUM** until Phase 2 |
| Bind **custom domains** / TLS | Portal + DNS admin | Infra | DNS access | **MEDIUM** for branded hosts |
| Configure **SSO/OAuth** with IdP | Cloud + IdP admin | Security | IdP app registration | **VARIABLE** — blocker if mandatory |
| **Rotate** compromised secrets | Portal + host secret store | Security + CTO | Incident or schedule | **HIGH** |
| Confirm **subprocessors** / DPA with vendor | Legal | Security + Legal | Vendor docs | **BLOCKER** if legal rejects |

## Repo honesty rule

If a checklist item depends on any row above, status must be **PENDING (manual)** — not **DONE**.
