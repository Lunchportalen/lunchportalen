# Phase 2A — CMS visual diff plan

## Completed in 2A (safe uplift)

| Area | Change | Risk |
|------|--------|------|
| Backoffice root | `bg-white` → `bg-[rgb(var(--lp-bg))]` | Low — aligns with global marketing/admin cream |
| Section tree | Right border on aside via `cmsSectionTreeAsideClass` | Low — clearer separation |
| TopBar active tab | Red underline → `var(--lp-hotpink)` | Low — brand consistency |
| ContentWorkspace chrome | Split into header + publish modules | Low — no props contract change for parents |
| AI rail | `role="region"` + `aria-label` | Low — a11y/IA only |

## Deferred (2B+ or opportunistic)

| Area | Idea | Why deferred |
|------|------|----------------|
| `ContentWorkspaceMainCanvas` | Extract `ContentInspectorPane` | Large surface; risk of behavior drift without dedicated QA |
| Editor panels | Unify all focus rings to `focusRing` from tokens | Many files; batch in visual polish pass |
| Tables in CMS | Shared table row/hover classes | Needs inventory of table usages |
| `DsButton` primary gradient | Align gradient stops to brand doc | Visual sign-off |

## Non-goals (explicit)

- New CMS features, preview pipeline changes, or AI API changes.
- Employee `/week`, auth, billing, order window.
