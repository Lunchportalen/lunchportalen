# App overlay CMS (Phase 44)

App pages (Week, Dashboard, Kitchen, Driver, Company Admin, Superadmin) can show CMS-driven content in fixed **overlay slots** without changing app logic.

## Slugs

Overlay pages use the slug namespace `app-overlay-*` and are stored in `content_pages` / `content_page_variants` like any other CMS page:

| Key            | Slug                      | Preview path   |
|----------------|---------------------------|----------------|
| week           | `app-overlay-week`        | `/week`        |
| dashboard      | `app-overlay-dashboard`   | `/dashboard`   |
| companyAdmin   | `app-overlay-company-admin` | `/admin`    |
| superadmin     | `app-overlay-superadmin`  | `/superadmin`  |
| kitchen        | `app-overlay-kitchen`     | `/kitchen`     |
| driver         | `app-overlay-driver`      | `/driver`      |

## Slots

Each overlay page body is a BlockList (version 1). Blocks can target a slot via `data.slot`:

- **topBanner** — Small alert/banner at top of page
- **header** — Title/intro below page heading (default if no slot)
- **help** — How-to / rules
- **emptyState** — Shown only when the page already shows “no data”
- **sidebar** — Optional right-column content
- **footerCta** — CTA block at bottom

Allowed block types in overlays: `hero`, `richText`, `cta`, `image`, `form`.

## Backoffice

- Content tree has an **App overlays** group with one node per overlay.
- Selecting a node opens the editor by slug (or by page id when the page exists).
- **Preview** for an overlay opens the corresponding app route (e.g. `/week`) so superadmin can see content in context.

## Behavior

- **Fail-closed:** If overlay is missing or invalid, the app page works normally (no overlay rendered).
- **Deterministic:** No exceptions; overlay loading does not affect auth, tenancy, or business logic.
- Editing is superadmin-only (existing backoffice guards unchanged).
