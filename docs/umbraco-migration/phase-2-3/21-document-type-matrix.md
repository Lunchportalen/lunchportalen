# Document type matrix

One row per **Umbraco Document Type** candidate. Aliases are **proposed** (adjust to team naming convention).

| Current concept / source | Proposed Document Type (alias) | Purpose | Parent rules | Allowed children | Variants? | Publish / Workflow | Notes | Confidence |
|--------------------------|--------------------------------|---------|--------------|------------------|-----------|-------------------|-------|------------|
| Program: single public site | **`siteRoot`** *(optional)* | Single-site container; holds settings + content root | None (root) | `webSite`, `settingsFolder`, `contentFolder` | **No** (invariant) | Workflow **N/A** (container only) | Omit if Umbraco single-site mode makes this redundant; use **Content** root + folders instead. | Medium |
| Public marketing home (`slug` `home`, `/`) | **`webPageHome`** | Canonical homepage; same composition as `webPage` but enforces single instance + reserved URL | Under `contentFolder` or under `siteRoot` | **None** (leaf) or only non-routable children per policy | **Yes** (`nb`, future) | **Full Workflow** | Alternatively model as **`webPage`** + unique constraint in culture; splitting avoids template mistakes. | High |
| Standard CMS page (`content_pages` + blocks) | **`webPage`** | Default routable marketing page | Under `contentFolder`, under `webPageHome` parent policy, or nested `webPage` | `webPage` (nested IA) | **Yes** | **Full Workflow** | Matches `documentTypes` alias `page` today. | High |
| “Landing” long-form campaign (if product needs stricter block allowlist) | **`webLandingPage`** | Same as `webPage` but different **composition** / allowed Element Types | Same as `webPage` | `webLandingPage` or `webPage` per IA | **Yes** | **Full Workflow** | **Only create if** allowlist differs; else use `webPage` + block presets. | Medium |
| Article / news listing + posts | *Not in current core Postgres model* | — | — | — | — | — | **No first-class article type** evidenced in `lib/cms/blocks/registry.ts` core set. Add **only** when editorial product requires it. | Low (absent) |
| `global` virtual root folder | **`editorialFolderGlobal`** *(or use built-in List View + folder nodes)* | Container for shared snippets / partials editors should reuse | Under content root | `snippetComposable`, `webPage` *(if allowed)*, other folders | **No** on folder | **N/A** | Umbraco may use **folder** + **List View** without custom Document Type — acceptable **stock** pattern. | High |
| `design` virtual root | **`editorialFolderDesign`** | Design-system marketing experiments / token-linked content | Same | Allowed design docs only | **No** on folder | Per child | If unused, fold into `global`. | Medium |
| `overlays` + fixed kinds (`employee_week`, `superadmin`, …) | **`appShellPage`** *(provisional)* | In-app overlay / role-shell HTML (not public `lunchportalen.no` marketing) | Under `overlaysFolder` | **None** or nested per product | **Yes** | **Workflow** recommended if edited | **Scope decision:** either in Umbraco (separate delivery channel) or **remain app-owned** — see open questions. | Medium |
| Global site settings (SEO defaults, org JSON-LD, social defaults) | **`siteSettings`** | Singleton settings document | Under `settingsFolder` or `siteRoot` | **None** | **Yes** for translatable defaults | **Full Workflow** | Not per-page; referenced via **Multi Node Tree Picker** or domain-specific picker. | High |
| Redirects / rewrites catalog (if editorial) | **`redirectRule`** or third-party | Single rule per node or CSV-managed | Under `settingsFolder` | **None** | Optional | **Full Workflow** | Prefer **stock** redirect packages or infra rules if editorial volume is low. | Medium |
| Navigation override (optional explicit nav tree) | **`navigationRoot`** + **`navigationItem`** | Explicit menu when tree order is insufficient | Under `settingsFolder` | `navigationItem` | **Yes** | **Full Workflow** | Use **only if** IA requires multiple menus; else **derive** from content tree. | Medium |
| Recycle Bin | *Built-in* | Umbraco recycle | — | — | — | — | **Stock** — not a custom Document Type. | High |

### Workflow column (all in-scope editorial types)

**Default:** Draft → Review → Approve → Publish mapped to **Umbraco Workflow** stages (exact names configured on Cloud). Containers/folders: **no publish** requirement.

### Variant column

**Yes** = culture variants enabled for human-facing text, SEO, and routable slug where policy allows. **Invariant** = keys, internal IDs, structural flags.

---

*See also:* [content-type-matrix.csv](./content-type-matrix.csv)
