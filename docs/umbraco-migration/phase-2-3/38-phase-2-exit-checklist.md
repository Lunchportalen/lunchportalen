# Phase 2 exit checklist

Binary gates. **PASS** = true for every item.

## Content model

- [ ] All **in-scope public website page** concepts mapped to **Document Types** (no orphan “misc page”).
- [ ] **Home** vs inner pages represented without ambiguous dual authority.
- [ ] **Core** block types from `lib/cms/blocks/registry.ts` mapped to **Element Types** (including child elements for nested rows).
- [ ] **Plugin** block types **inventoried** from production/staging content (or explicit signed list that none exist).
- [ ] **No** plan to preserve legacy `body` JSON as Umbraco source of truth (except signed ADR with migration decomposition).
- [ ] **SEO / social** semantics mapped from `pageAiContract` + `cmsPageMetadata` to **variant properties**.
- [ ] **Diagnostics / seoRecommendations** disposition signed (DROP / regen policy).

## Boundaries

- [ ] **Operational** domains explicitly excluded from Document Types (menu, week, orders, tenants, billing, logs).
- [ ] **Navigation** model does not use operational menu data.

## Media & localization

- [ ] **Media Types** strategy agreed (Image / File / optional SVG).
- [ ] **Alt/caption** ownership rule signed (block vs media item).
- [ ] **Primary culture `nb`** confirmed; **additional cultures** signed or explicitly “future.”

## Field ownership

- [ ] **Field disposition register** has **no orphan** legacy fields (every row has target or explicit DROP with rationale).
- [ ] **Canonical URL** duplicate fields (`canonical` vs `canonicalUrl`) merged in target model.

## Governance inputs

- [ ] **Workflow** requirement acknowledged for every in-scope editorial Document Type.

---

**Phase 2 status:** see final chat summary — blocked while **B1–B4** in `37-open-questions-and-blockers.md` remain open.
