# Authority boundary matrix (current → target)

**Rule:** Each row has **one target editorial authority** for the concern. “Shared” or ambiguous peer authority is **not allowed** at cutover for in-scope public CMS content.

**Legend — confidence**

- **CONFIRMED:** Stated in program lock or directly evidenced in repo docs.
- **STRONG INFERENCE:** Consistent with codebase/doc patterns; confirm during Phase 2 design.
- **POSSIBLE:** Requires explicit decision in Phase 2+ (not open in Phase 0–1 except as blocker).

| Concern | Current authority | Target authority | In Umbraco? | Migration required? | Notes | Confidence |
|--------|-------------------|------------------|-------------|---------------------|-------|------------|
| **Pages** (public marketing/site pages) | Application DB (`content_pages` / variants) + Next backoffice management routes; public read via CMS loaders (`lib/cms/public/*`, `[slug]`) | Umbraco (authoring + published source for site pages) | Yes (editorial + delivery source) | Yes | Legacy management/write paths for migrated types must be retired before cutover. | STRONG INFERENCE |
| **Reusable blocks** (page body composition for site) | Stored with page variant body in application CMS model; edited in Next backoffice | Umbraco (element/block models + delivery) | Yes | Yes | Composition mirrors product capabilities, not necessarily 1:1 field names. | STRONG INFERENCE |
| **Navigation** (site IA / menus driven by editorial structure) | Content tree + routing in app (`content_pages`, tree APIs); not a separate productized CMS nav server | Umbraco (structure + delivery consumption in Next) | Yes (structure/content driving nav) | Yes | Operational “week menu” / product navigation data is **not** this row — see operational data. | STRONG INFERENCE |
| **SEO / meta** (site pages) | Page/variant fields in application CMS model | Umbraco document properties + delivery | Yes | Yes | Must not remain edited in legacy CMS post-cutover. | STRONG INFERENCE |
| **CMS media** (assets used by public site content) | Backoffice media surfaces + storage integrated with app (see backoffice media routes) | Umbraco Media Library + Media Delivery API | Yes | Yes | Operational assets (e.g. kitchen/brand uploads outside site editorial) remain app-governed unless explicitly scoped. | STRONG INFERENCE |
| **Localization** (site content locales) | Variant / locale model in application CMS | Umbraco culture/variant model + Delivery API | Yes | Yes | App locale for **operational** UI copy is separate from **site editorial** locale. | STRONG INFERENCE |
| **Users** (who may edit **site** content) | Application auth (e.g. Supabase) + backoffice roles for current CMS UI | **Umbraco backoffice users/groups** for editorial; application identities unchanged for portal/admin operational apps | Yes — for **editorial identities** only | Yes — provisioning/model | Two planes: **Umbraco users** (site editorial) vs **application users** (orders, admin, kitchen, etc.). No duplicate editorial login authority for the same content. | STRONG INFERENCE |
| **Permissions** (site editorial) | App RBAC on `/api/backoffice/*`, superadmin gates | Umbraco group permissions + Workflow permissions | Yes | Yes | Operational API permissions remain in application layer. | STRONG INFERENCE |
| **Workflow state** (approve/publish for **site** content) | Application workflow flags + publish routes (`CP8` describes split with legacy second system) | **Umbraco Workflow** (mandatory) | Yes | Yes | Legacy workflow flags for migrated types retired at cutover. | CONFIRMED (target) / STRONG INFERENCE (current) |
| **Orders** | Application / Supabase operational domain | Application / Supabase (unchanged) | No | No | Never editorial CMS scope. | CONFIRMED |
| **Tenants** | Application / Supabase tenant model | Application / Supabase (unchanged) | No | No | Never editorial CMS scope. | CONFIRMED |
| **Operational data** (menu, menuContent, weekPlan, billing, immutable logs, etc.) | Domain APIs and data stores; **legacy docs** describe Sanity + broker for `menuContent` publish | Application domain APIs and stores — **not** Umbraco editorial | No | No (scope) | Program lock: outside CMS unless charter amended. **No Umbraco editorial peer** for these concerns. | CONFIRMED |
| **AI prompts / policies** (editor-facing, **site** content) | Code + env; Next `/api/backoffice/ai/*` orchestration (`U17`) | Umbraco-context AI configuration and execution (product + approved extensions) — **no browser-exposed management secrets** | Yes (editorial AI config plane) | Yes | Next backoffice AI must not remain the authority for migrated editorial AI after cutover. Secrets remain server-side. | STRONG INFERENCE |
| **AI logs / audit** | Application audit/metrics paths | Application audit store + Umbraco audit/history where product provides it | Partial | Yes | **Attribution** to human or API User is mandatory; single consolidated operational log policy TBD in Phase 2+. | POSSIBLE |

## Explicit classification: menu / week / operational

- **`menu`, `menuContent`, `weekPlan`:** **Operational / product data** under program lock → **not** Umbraco editorial authority. Current repo wiring (e.g. Sanity for `menuContent` per `CMS_NATIVE_MENU_PUBLISH_CONTROL.md`) is **legacy** relative to this program’s **target boundary** for the CMS migration: operational chains remain **application-owned**, not Umbraco peer editors.

## Sign-off

This matrix must be **signed** by Product, CTO, Editorial, and Security with no open row marked “ambiguous.”
