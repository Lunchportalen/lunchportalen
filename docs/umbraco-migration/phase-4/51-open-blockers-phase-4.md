# Open blockers — Phase 4 signoff

**Only real items** that prevent **honest Phase 4 signoff** (contracts still fuzzy or prerequisites unverified).

| ID | Blocker | Why it blocks Phase 4 | Owner | Target resolution |
|----|---------|----------------------|-------|-------------------|
| **PB1** | **`appShellPage` / `overlays`** (Phase 2–3 **B1**) | Path lookup, sitemap, and **which plane reads** (Umbraco vs app) remain unset — Delivery contract cannot be **complete** for all public URLs | Product owner + solution architect | Decision: Umbraco vs app shell per route class |
| **PB2** | **Public locale strategy** (`en` vs `nb`-only) (Phase 2–3 **B2**) | Culture list, URL prefix, Delivery variant queries, and **fail-closed** mapping are ambiguous | Product owner + CTO | Written locale policy + Umbraco culture config |
| **PB3** | **Full plugin block inventory** (Phase 2–3 **B3**) | Unknown block types → unknown Delivery payload shapes → mapping contract incomplete | Migration lead + lead dev | Inventory closed or **explicit** “unknown block” governance signed |
| **PB4** | **Umbraco Workflow proof on staging** (Phase 2–3 **B4**) | Without live Workflow, “published” semantics in Delivery are **not** governance-parity with design | Platform admin + CMS admin | Staging Workflow matches `35-rbac-workflow-editor-matrix.md` |
| **PB5** | **Portal verification** of Delivery + Media Delivery + index health **not documented** for **staging** | Phase 4 exit requires **evidence**, not only docs | Platform admin | Screenshot/log + dated verification note linked from exit checklist |
| **PB6** | **Media alt / SVG policy** (Phase 2–3 **L1–L3** in `24-media-localization-and-dictionary-model.md`) | Media contract (`44`) references unsigned precedence | Product + Accessibility champ | Sign L1–L3 or **explicit** defer with **risk acceptance** |

## Not blockers for Phase 4 contract authorship

- Implementation of Next routes (Phase 5+).
- ETL scripts.

## Resolved by Phase 4 deliverables (were blockers earlier)

- “Webhook contract undefined” → addressed in `46` (implementation still future).
