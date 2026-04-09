# U33 View Action Footer Model

- Title: Workspace views, actions, footer apps, and entity actions for U33
- Scope: explicit Bellissima control plane primitives shared across content tree, landing, and entity workspace.
- Repro:
  1. Open `/backoffice/content`.
  2. Open `/backoffice/content/[id]`.
  3. Compare action placement and persistent status visibility.
- Expected: views are explicit, actions are consistently named, footer apps are persistent, and entity actions reuse the same language.
- Actual: actions are partly split between header/save bar/local menus and some Bellissima surfaces are still simulated by local tabs.
- Root cause: shared primitives were introduced, but not all consumers were moved onto them.
- Fix: publish explicit control-plane primitives and reuse them everywhere practical.
- Verification:
  - One set of workspace views exists in the shared model.
  - Header and footer consume the same action/footer primitives.
  - Tree and collection surfaces reuse the same entity action labels.

## Workspace Views Now

- `content`
- `layout`
- `seo`
- `preview`
- `history`
- `settings`

## Primary Actions

- `Lagre`
- `Publiser` / `Opphev publisering`
- `Forhåndsvis`

## Secondary Actions

- `Vis side`
- `Kopier lenke`
- `Dupliser`
- `Gjenopprett siste versjon` when history/runtime allows it

## Footer Apps Now

- publish state
- save state
- history state
- governance posture
- document type
- runtime linkage
- active side app / inspector posture

## Entity Actions Reused Across Tree / Collection / Workspace

- `Åpne arbeidsflate`
- `Forhåndsvis`
- `Vis side`
- `Kopier lenke`
- `Opprett underside`
- `Flytt`
- `Slett` / `Flytt til papirkurv`
