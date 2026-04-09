# Content tree and editorial structure

## 1. Site root strategy

**Single site** on Umbraco Cloud:

- Use Umbraco **Content** root as the editorial entry.
- Optional top **`siteRoot`** node if multiple brands/sites are anticipated; otherwise **folders** suffice.

## 2. Top-level nodes (maps from `CONTENT_TREE_VIRTUAL_ROOTS`)

| Legacy virtual root | Umbraco structure | Purpose |
|--------------------|-------------------|---------|
| **Hjem / home** | Folder **`Home`** → child **`webPageHome`** (singleton) + child `webPage` tree | Public `/` and children. |
| **App overlays** | Folder **`App overlays`** | **`appShellPage`** nodes for in-app chrome — **only if** product confirms Umbraco ownership (see open questions). |
| **Global** | Folder **`Global`** | Shared snippets, optional `snippetComposable` docs. |
| **Design** | Folder **`Design`** | Experimental blocks/pages; restrict permissions. |

## 3. Settings nodes

Sibling area under Content (or dedicated branch):

- **`Settings`** folder → `siteSettings`, `redirectsFolder`, optional `navigationRoot`.

## 4. Navigation nodes

- **Primary:** content tree under **Home**.
- **Secondary:** explicit `navigationRoot` **only if** multi-menu product requirement exists.

## 5. Archive folders

- **`Archive`** folder with **List View** — moved-down pages, year/month subfolders optional.
- Permissions: **Authors** create; only **Editors** move to archive (policy).

## 6. Media structure

Mirror §24 — `/site/marketing`, `/site/og`, `/legacy-import`.

## 7. How editors find content

1. **Tree** — habitual path by IA.
2. **Global search** — by title/slug.
3. **List View** on folders — sort/filter by update date, culture.
4. **Workflow dashboard** — “my pending approvals.”

## 8. Anti-chaos rules

| Rule | Enforcement |
|------|-------------|
| No orphan pages outside **Home** / **Settings** / agreed folders | Permissions + review |
| No operational data under **Home** | Training + Code review on Delivery consumers |
| **Singletons** (`webPageHome`, `siteSettings`) | One per site; Document Type permission |
| **Slug** changes on published pages | Workflow + redirect task |

## 9. Relation to legacy Next tree

Today’s `tree_root_key` values map **directly** to the folders above — editors should recognize **Hjem**, **Global**, **Design**, **App overlays** as the same mental model.
