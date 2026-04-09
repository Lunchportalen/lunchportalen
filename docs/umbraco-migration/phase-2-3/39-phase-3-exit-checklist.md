# Phase 3 exit checklist

Binary gates for **editorial backoffice design** completion (not production cutover).

## Structure & UX

- [ ] **Content tree** pattern defined (Home, Global, Design, Overlays, Settings).
- [ ] **List View** / folder strategy defined for large folders.
- [ ] **Media** folder conventions defined.

## Stock vs custom

- [ ] **Workspace Views** — each rejected **or** one accepted with stock alternative documented (currently **all rejected** in `32`).
- [ ] **Custom Sections** — **none** approved without CTO + Editorial sign-off (default **none**).
- [ ] **Custom Property Editors** — **none** approved except possible **`formId`** picker — if approved, spec’d in `33`.

## RBAC & Workflow

- [ ] **User groups** matrix defined (`35`).
- [ ] **Workflow stages** mapped to logical Draft → Review → Approve → Published.
- [ ] **Segregation of duty** rule stated (approver ≠ author by default).

## Journeys

- [ ] **Editor journeys** documented for create, edit, blocks, media, localize, workflow, publish (`34`).
- [ ] **Preview** explicitly deferred to Phase 4 **without** blocking wording in Phase 3 artifacts.

## Legacy dependency (design intent)

- [ ] **Target state** has **no migrated public page type** that **requires** Next `ContentWorkspace` — i.e. Umbraco backoffice is the designed editor.

## Parity with Phase 2

- [ ] Document Types in `21` match tree assignments in `31`.
- [ ] Element Types in `22` match Property Editor choices in `33`.

---

**Phase 3 status:** see final chat summary — blocked while **B1, B2, B4** remain open (B3 is Phase 2–ETL boundary but fatally impacts “complete” program sign-off if ignored).
