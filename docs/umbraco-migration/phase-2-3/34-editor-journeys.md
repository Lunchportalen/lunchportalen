# Editor journeys

Each journey is **Umbraco backoffice** after cutover — not legacy Next.

## J1 — Create page

| Item | Detail |
|------|--------|
| **Actor** | Author |
| **Steps** | Content → **Home** (or parent) → Create → choose **`webPage`** → set culture `nb` → title + slug → add blocks → Save |
| **Touched types** | `webPage`, Element Types |
| **Friction** | Slug uniqueness; block choice overload |
| **Acceptance** | Draft exists; visible in tree; **no** live URL until publish |

## J2 — Edit page

| Item | Detail |
|------|--------|
| **Actor** | Author / Editor |
| **Steps** | Open node → edit properties/blocks → Save |
| **Touched types** | Same |
| **Friction** | Large Block List |
| **Acceptance** | History shows revision; culture correct |

## J3 — Add / reorder blocks

| Item | Detail |
|------|--------|
| **Actor** | Author |
| **Steps** | In Block editor → add allowed Element Type → drag order |
| **Touched types** | Element Types |
| **Friction** | Accidental deep nesting |
| **Acceptance** | Order stable; max block policy respected |

## J4 — Manage media

| Item | Detail |
|------|--------|
| **Actor** | Author |
| **Steps** | Media → upload → folder → pick from page |
| **Touched types** | Media Types |
| **Friction** | Alt/caption discipline |
| **Acceptance** | No broken pickers; focal point set for heroes |

## J5 — Localize content

| Item | Detail |
|------|--------|
| **Actor** | Editor |
| **Steps** | Culture switcher → fill variant → Save |
| **Touched types** | `webPage` variant |
| **Friction** | Fallback vs empty culture |
| **Acceptance** | `nb` complete before `en` publish if policy requires |

## J6 — Preview (Phase 4 dependency only)

| Item | Detail |
|------|--------|
| **Actor** | Author |
| **Steps** | **TBD in Phase 4** — Next preview URL + Umbraco preview mode |
| **Dependency** | Delivery API + Next route |
| **Acceptance** | Not part of Phase 3 sign-off |

## J7 — Submit for approval

| Item | Detail |
|------|--------|
| **Actor** | Author |
| **Steps** | Workflow → Submit for review |
| **Touched types** | Workflow instance on node |
| **Friction** | Missing mandatory SEO |
| **Acceptance** | State changes; approver notified (per Cloud config) |

## J8 — Approve / reject

| Item | Detail |
|------|--------|
| **Actor** | Approver |
| **Steps** | Workflow inbox → Review → Approve **or** Reject with comment |
| **Touched types** | Workflow |
| **Friction** | SoD violations if same user |
| **Acceptance** | Audit shows actor + timestamp |

## J9 — Publish

| Item | Detail |
|------|--------|
| **Actor** | Approver (or auto-publish post-approval per config) |
| **Steps** | Approve → Publish to **Live** |
| **Touched types** | Delivery content |
| **Friction** | Cache lag in Next (Phase 4) |
| **Acceptance** | Public site shows change after revalidation; no dual authority |
