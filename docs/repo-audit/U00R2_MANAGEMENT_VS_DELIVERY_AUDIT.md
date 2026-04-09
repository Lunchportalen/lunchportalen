# U00R2 Management Vs Delivery Audit

## Boundary Matrix
| Surface / API | Management | Delivery | Shared contract | Leaky boundary? | Why |
|---|---|---|---|---|---|
| `app/(backoffice)/backoffice/content/**` + `app/api/backoffice/content/**` | Yes | No | `content_pages`, `content_page_variants`, body-envelope contract | Yes | Editor and tree are management-only, but they write directly into the body contract that public delivery consumes. |
| `app/(public)/[slug]/page.tsx` + `lib/cms/public/**` | No | Yes | Published `content_page_variants.body` | No | Clean delivery surface consuming published content only. |
| `app/(backoffice)/backoffice/preview/[id]/page.tsx` | Yes | Yes | Same render pipeline as public, but draft/published variant selection differs | Yes | Preview is a management-only route using the delivery renderer. |
| `app/api/backoffice/releases/**` + `lib/backoffice/content/releasesRepo.ts` | Yes | Yes | Release tables plus publish into prod variants | Yes | Releases are management orchestration that directly changes delivery content. |
| `app/(backoffice)/backoffice/settings/**` | Yes | No | Code registries, governance APIs, `system_settings` | Yes | Strong management section, but not self-contained because some save paths leave the section. |
| `app/api/backoffice/settings/route.ts` | Yes | No | `system_settings` | Yes | Read path lives in backoffice; save path in UI uses `/api/superadmin/system`. |
| `app/api/content/global/header|footer|settings` + `global_content` | Yes | Yes | `global_content` draft/published rows | Yes | Public/global routes are delivery-facing reads with management-facing writes in the same endpoints. |
| `app/api/backoffice/ai/**` | Yes | Indirectly | AI events, editor payloads, content suggestions | Yes | Control-plane logic can affect content posture without being a pure content surface. |
| `app/api/backoffice/esg/latest-monthly` | Yes | Yes | `esg_monthly` rollup | Yes | Backoffice reads a runtime rollup rather than a pure management object. |
| `app/api/social/**` + `lib/social/**` | Mixed | Mixed | Social post state, AI/generator payloads, publish flows | Yes | Growth/social is content-adjacent, but it is not the page CMS and it crosses planning/runtime concerns. |
| `studio/**` | Yes | Yes | Sanity content model and published menu/week chain | Yes | Real editorial tooling, but not the same CMS object model as the Postgres page CMS. |
| `app/api/week/**`, order/week/menu runtime routes | No | Yes | Published menu/week chain | Yes | Operational runtime remains outside the page CMS even where backoffice language tries to unify the experience. |
| `app/admin/**`, `app/superadmin/**`, related APIs | Mostly no | Yes | Domain tables, RPCs, system runtime truth | Yes | These surfaces share app shell concepts, but they are runtime/operations truth, not CMS management objects. |
| `app/kitchen/**` and `app/driver/**` | No | Yes | Operational order and stop data | No | Pure delivery/runtime planes; not CMS management. |

## Boundary Judgment
Lunchportalen does not have a clean “all backoffice equals management, all public equals delivery” split. The sharper model is:

- Content, releases, preview controls, and governance are management.
- Public page rendering is delivery.
- Global content routes are both management and delivery because they save drafts and serve published header/footer/settings.
- Orders, week, kitchen, driver, agreements, billing, and most admin/superadmin views remain runtime truth.
- Several backoffice surfaces read delivery data or write directly into delivery contracts, so the boundary is real but leaky.

This repo therefore remains `CMS-led but still fragmented`, not `CMS-led and enterprise-coherent`.
