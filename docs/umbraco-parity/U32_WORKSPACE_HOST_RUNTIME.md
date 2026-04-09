# U32 - Workspace host runtime

- Title: U32 canonical content workspace host
- Scope: `app/(backoffice)/backoffice/content/layout.tsx`, `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`, `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceLayout.tsx`, and route ownership around `/backoffice/content/**`.
- Repro:
  1. Open `/backoffice/content` and `/backoffice/content/[id]`.
  2. Trace which layer owns tree binding, active workspace posture, header/footer chrome, and section/detail transitions.
  3. Observe that host ownership is split across layout wrappers, local editor publishing, and older compatibility layers.
- Expected: one canonical host owns section -> tree -> workspace composition for content.
- Actual: multiple layers still participated in host identity, making Bellissima structure feel partial rather than canonical.
- Root cause: the content area accumulated wrappers and local ownership over time instead of consolidating around one route-first host.
- Fix: introduce `ContentWorkspaceHost` as the canonical section host, mount it directly from `content/layout.tsx`, and reduce `ContentWorkspaceLayout.tsx` to a compatibility wrapper.
- Verification:
  - `npm run typecheck`
  - `npx vitest run tests/cms/bellissimaWorkspaceContext.test.ts tests/cms/backofficeWorkspaceContextModel.test.ts --config vitest.config.ts`
  - `npm run build:enterprise`

## Canonical routing

- Canonical content landing: `/backoffice/content`
- Canonical workspace detail: `/backoffice/content/[id]`
- Secondary section views hosted by the same shell:
  - `/backoffice/content/growth`
  - `/backoffice/content/recycle-bin`

## Canonical host

- Canonical host component: `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`
- Layout mount point: `app/(backoffice)/backoffice/content/layout.tsx`
- Transitional wrapper kept thin for compatibility: `ContentWorkspaceLayout.tsx`

## Host responsibilities now

- render the section shell
- mount the content tree beside the active workspace surface
- publish section-level Bellissima posture when the route is the landing or secondary content view
- leave entity-specific snapshot publishing to the real editor runtime for `/backoffice/content/[id]`
- compose shared header/footer chrome from one workspace model

## Section -> tree -> workspace coupling

- The section host is route-first.
- The tree remains the primary navigation source for content entities.
- Selecting or routing to a page moves the user into the canonical detail workspace instead of a parallel local editor surface.
- Header, footer apps, and workspace views now resolve from the same host/context line rather than ad-hoc props.

## Transitional paths neutralized

- `ContentWorkspaceLayout.tsx` remains only as a thin wrapper so existing imports do not fork the host model.
- `MainViewContext.tsx` remains as a compatibility layer, but active view truth now lives in the Bellissima workspace context.
- No second editor host or route-local Bellissima shell was introduced.
