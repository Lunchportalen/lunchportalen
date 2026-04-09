# Property Editor strategy

## 1. Default

| Property kind | Editor |
|---------------|--------|
| Text | Textstring / Textarea |
| Rich text | RTE |
| URL / internal link | Multi URL Picker |
| Media | Media Picker (typed) |
| Page link | Content Picker (filtered) |
| Blocks | Block List / Block Grid |
| Boolean | Toggle |
| Enum | Dropdown |

**All stock** unless this document explicitly approves custom.

## 2. Candidates for custom Property Editors (justify individually)

| Field | Custom? | Problem stock fails | Verdict |
|-------|---------|---------------------|---------|
| `formId` | **Maybe** | Need picklist from live form registry | **Try** Dropdown populated by **server-side** prevalues / deploy-time manifest first; custom only if dynamic |
| `relatedLinks.tags` | **No** | — | Tags editor |
| Hero layout | **No** | — | Dropdown + block preview |
| Pricing “live vs manual” | **No** | — | Empty plans + editor training |

## 3. Block custom views vs Property Editors

Prefer **custom block view** (presentation) over **custom Property Editor** when the need is **visual preview** only.

## 4. Reject list (overengineered)

- Bespoke Markdown editor when RTE exists.
- WYSIWYG inside every card row.
- Per-block React port of entire Next `ContentWorkspace`.
- **AI chat** Property Editor — belongs in **Umbraco AI** product surface, not a field.

## 5. Summary

**Stock: ~95%** of properties. **Custom: 0–1** Property Editors (`formId`) pending dynamic list proof.
