# U00 Management Vs Delivery Audit

## Boundary Matrix
| Surface / API | Management | Delivery | Shared contract | Leaky boundary? | Why |
|---|---|---|---|---|---|
| `app/(backoffice)/backoffice/content/**` + `app/api/backoffice/content/**` | Yes | No | `content_pages`, `content_page_variants`, body-envelope contract | Yes | Editor and tree are management-only, but they write directly to the same body contract that public delivery consumes. |
| `app/(public)/[slug]/page.tsx` + `lib/cms/public/**` | No | Yes | Published `content_page_variants.body` | No | Clean delivery surface consuming published content only. |
| `app/(backoffice)/backoffice/preview/[id]/page.tsx` | Yes | Yes | Same render pipeline as public, but preview variant selection | Yes | Preview is management-only route using delivery renderer and content contract. |
| `app/api/backoffice/releases/**` + `lib/backoffice/content/releasesRepo.ts` | Yes | Yes | Release tables plus publish into prod variants | Yes | Releases are management orchestration that directly changes delivery content. |
| `app/(backoffice)/backoffice/settings/**` | Yes | No | Code registries, governance APIs, `system_settings` | Yes | Strong management section, but not fully self-contained because some save paths leave the section. |
| `app/api/backoffice/settings/route.ts` | Yes | No | `system_settings` | Yes | Read path lives in backoffice; save path in UI goes through `/api/superadmin/system`. |
| `app/api/backoffice/ai/**` | Yes | Indirectly | AI events, editor payloads, content suggestions | Yes | Management-facing control plane can affect content and runtime posture without being a pure content surface. |
| `app/api/backoffice/esg/latest-monthly/route.ts` | Yes | Yes | `esg_monthly` rollup | Yes | Backoffice reads a delivery/runtime rollup rather than a pure management object. |
| `studio/**` | Yes | Yes | Sanity content model and published menu chain | Yes | Real editorial tooling, but it is not the same CMS object model as the Postgres page CMS. |
| `app/api/week/**`, week/menu runtime routes | No | Yes | Published menu/week chain | Yes | Operational runtime remains outside page CMS even though backoffice language tries to unify the experience. |
| `app/admin/**`, `app/superadmin/**`, related APIs | Mostly no | Yes | Domain tables, RPCs, system runtime truth | Yes | These surfaces use the same app shell and some backoffice concepts, but they are runtime/operations truth, not CMS management objects. |

## Boundary Judgment
Lunchportalen does not have a clean “all backoffice equals management, all public equals delivery” split. The real model is sharper:

- Content, releases, preview controls, and governance are management.
- Public page rendering is delivery.
- Orders, week, kitchen, driver, agreements, billing, and most admin/superadmin runtime views remain delivery/runtime truth.
- Several backoffice surfaces read delivery data or write directly into delivery contracts, so the boundary is real but leaky.

The repo therefore fits `CMS-led but still fragmented`, not `CMS-led and enterprise-coherent`.
