# U32 - Bellissima target model

## Section model
- Top bar chooses active section only.
- Each section owns its own local menu/collections/workspaces.

## Menu / menu item model
- Registry remains canonical in `lib/cms/backofficeExtensionRegistry.ts`.
- U32 adds explicit section-local workspace entries and collection/workspace metadata.

## Tree / collection model
- `/backoffice/content` is tree-first entry.
- Tree is primary content navigation.
- Settings becomes collection-first: document types, data types, create policy, governance, management read.

## Workspace model
- Content gets one host model:
  section view (`overview`, `growth`, `recycle-bin`) plus entity workspace view (`content`, `preview`, `history`, `global`, `design`).
- Route is source of truth for active entity and section workspace.

## Workspace context model
- One canonical Bellissima context for content editor session:
  entity, document type, publish/save state, governed posture, preview state, history state, runtime linkage, active view, actions, footer apps, entity actions.

## Workspace views / content apps
- Content workspace views become explicit and first-class.
- Preview and history stop being only modal/strip/toggle affordances.

## Workspace actions
- Actions are modeled centrally and exposed consistently to header/footer surfaces.

## Workspace footer apps
- Footer shows persistent workspace truth:
  publish, save, governance, history, runtime linkage, document type, useful shortcuts.

## Entity actions
- Tree, settings collections, landing rows, and workspace chrome use one consistent action language.

## Settings as first-class section
- Settings is not a brochure hub.
- It is an explicit collection -> workspace management section with honest code-governed posture.

## Management vs delivery clarity
- Content/settings/control remain management-facing.
- Runtime/domain surfaces remain explicit runtime-linked or route-through surfaces.

## Done in U32
- Canonical registry/workspace metadata.
- Route-first content workspace host.
- Real content workspace context used by multiple UI consumers.
- Explicit content workspace views and stronger footer/actions.
- Stronger settings collections/workspaces.
- Clearer tree/audit degraded states.

## Wait after U32
- Persisted CRUD for document/data types.
- Full Umbraco extension pipeline identity.
- Cross-module unified history database beyond current content routes.
