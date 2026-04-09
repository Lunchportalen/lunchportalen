# Phase 3 master — editorial backoffice (Umbraco)

## 1. Principles

1. **Umbraco backoffice is the only editorial workstation** for migrated public website content after cutover — not the Next `/backoffice/content` React workspace.
2. **Default to stock** Content section, Media section, Users, Workflow UI, and built-in **audit/history**.
3. **Minimal friction:** editors find pages by **tree + search + list views**; no bespoke “mission control” unless justified in `32-workspace-views-dashboards-sections.md`.
4. **Governance parity:** **Umbraco Workflow** gates publish; **no** shadow publish from Next for migrated types.
5. **Editor-facing AI** runs **in Umbraco context** only (product + approved extensions), per Phase 0–1 — Next `/api/backoffice/ai/*` is **not** the long-term authority.

## 2. Editor roles in practice

| Role | Practice |
|------|----------|
| **Author** | Drafts pages/blocks/media picks; submits for review. |
| **Editor** | Refines copy; may move workflow per policy. |
| **Approver** | Approves publish; **segregation of duty** from author where required. |
| **Administrator** | User/group setup, Document Type visibility — **not** a routine bypass for approvals. |

## 3. Stock-first rule

Use **Property Editors**, **Block List/Grid**, **List View**, **Folders**, **Culture switcher**, and **Workflow** dashboards from the product. **Custom** pieces need an entry in `32` or `33` with **rejected alternatives** documented.

## 4. When extension work is justified

- Stock UI **cannot** enforce a **business invariant** (e.g. picker scoped to allowed forms) **and** Multi URL Picker / Content Picker cannot express it.
- **High-volume** editorial task saves **measurable** time **and** List View / search cannot solve it.

## 5. Workflow, approval, audit, usability

| Capability | Umbraco feature |
|------------|-----------------|
| Stages | **Umbraco Workflow** |
| Permissions per stage | **User groups** + Workflow permissions |
| **Audit trail** | **History / audit** (product) + API User attribution for automation |
| Usability | Culture badges, **Save** / **Submit** clarity, training SOPs |

## 6. Deferred to Phase 4+

- **Preview** button wiring to Next — dependency only.
- **Delivery API** keys in Next — runtime only.
- **Webhook** handlers — runtime only.
