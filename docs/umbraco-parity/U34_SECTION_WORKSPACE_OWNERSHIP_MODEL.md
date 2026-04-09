# U34 Section Workspace Ownership Model

- Title: U34 section and workspace ownership
- Scope: sections, entry routes, canonical host ownership, and transitional paths.
- Repro: navigate between top-level backoffice sections and content/settings workspaces.
- Expected: sections are explicit; tree/collection -> workspace flow is deterministic.
- Actual: registry is canonical, but topbar still carries too much horizontal module weight and section/workspace boundaries are not calm enough.
- Root cause: U33 consolidated the registry but did not finish section-local workspace discipline.
- Fix: keep one registry, one content host, and clearer settings workspace ownership.
- Verification:
  - Active section matches route.
  - Content landing/detail routes remain canonical.
  - Settings flows read like collection -> workspace, not disconnected pages.

## Sections

- `control` -> control tower, security, AI center.
- `runtime` -> runtime, enterprise, runtime-linked towers.
- `domain` -> customers, agreement, week/menu governance, domain runtime surfaces.
- `content` -> content, media, releases, intelligence, SEO/social review surfaces.
- `settings` -> document types, data types, create policy, schema/presets, governance, management read, AI governance, system.
- `system` -> users, members, forms, translation.

## Canonical Content Ownership

- Canonical content landing: `/backoffice/content`
- Canonical content detail workspace: `/backoffice/content/[id]`
- Canonical content host: `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`
- Section mount: `app/(backoffice)/backoffice/content/layout.tsx`

## Transitional Paths / Compat To Reduce Further

- `app/(backoffice)/backoffice/content/_workspace/MainViewContext.tsx`
- Section-level Bellissima publishing inside page-level children instead of the host
- Settings pages that still behave like isolated read pages instead of shared management workspaces

## Section -> Tree / Collection -> Workspace

- `content`: section entry -> tree is primary navigation -> host mounts one workspace instance -> header/footer/actions come from shared context.
- `settings`: section entry -> collection or workspace route -> shared management workspace frame -> detail workspace stays inside settings section.
- Discovery and entity actions may route into these workspaces, but must reuse the same canonical routes and labels.
