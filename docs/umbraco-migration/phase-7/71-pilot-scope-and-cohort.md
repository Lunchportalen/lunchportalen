# Pilot scope and cohort

## 1. Pilot purpose

Prove **editorial autonomy** on **real migrated Umbraco content** for **public website CMS** types: editors and approvers can complete **standard governance** (draft → review → approve → publish) and **trust preview** vs **published** behavior **without** legacy Postgres/Next backoffice writes and **without** continuous engineering hand-holding.

## 2. In-scope migrated content types (pilot slice)

**Default pilot slice** (adjust only via signed change to pilot charter; document delta in [`79-pilot-runbook.md`](./79-pilot-runbook.md)):

| Umbraco Document Type (alias) | In pilot | Notes |
|-------------------------------|----------|-------|
| **`webPage`** | **Yes** | Primary routable marketing page; blocks, SEO, workflow |
| **`webPageHome`** | **Yes** | If modeled separately from `webPage`; single instance policy |
| **`siteSettings`** | **Yes** | If editors routinely change defaults referenced by pages |
| **Folder / container types** (`editorialFolder*`, stock folders) | **Yes** | As needed for tree organization; N/A workflow where design says so |
| **`webLandingPage`** | **Optional** | Only if in production manifest for migrated pages |
| **`appShellPage` / overlays** | **Excluded until B1/X1 closed** | If decision keeps overlays app-owned, they are **not** pilot acceptance targets for Umbraco |
| **`redirectRule`, `navigationRoot`** | **Optional** | Only if explicitly in migrated pilot IA |

**Element Types (blocks):** All **migrated** blocks that appear on in-scope **`webPage`** rows are in scope for **add/reorder/edit** scenarios. Unknown plugin blocks remain governed by **B3/X3** — if inventory open, pilot may run on **known-type subset** only if **signed**; otherwise Phase 7 signoff is **NOT READY**.

## 3. Explicitly excluded content types and domains

| Exclusion | Reason |
|-----------|--------|
| **menu / menuContent / weekPlan** | Operational — locked premises |
| **orders, tenants, billing, immutable logs** | Operational / legal boundary |
| **Legacy Next `/backoffice/content` workspace** for migrated page types | Target authority is Umbraco; any use = legacy dependency ([`78`](./78-legacy-dependency-and-escape-hatch-register.md)) |
| **Sanity Studio** for production truth of migrated pages | Legacy plane — not pilot authority |
| **Engineer-only CMS admin tasks** (package install, schema deploy) | Not editorial acceptance (separate track) |

## 4. Pilot cohort roles

| Role | Responsibility in pilot |
|------|---------------------------|
| **Editor (Author)** | Creates/edits drafts, blocks, media picks; runs preview; submits for review |
| **Approver** | Reviews inbox; approves or rejects with comment; publishes per Workflow config |
| **Admin (CMS / tenant)** | User/group assignment, baseline access; **does not** replace editor doing editorial work |
| **Support owner** | First-line pilot support, triage, logging defects, enforcing pause rules ([`74`](./74-support-escalation-and-coverage-model.md)) |
| **Product / editorial signoff owner** | Accepts or rejects pilot outcome against metrics ([`76`](./76-editorial-acceptance-metrics-and-evidence.md)) |

**Separation of duties:** Approver must **not** be the sole reviewer of their own substantive changes for **approve/reject** scenario — use second account or staged handoff per [`35-rbac-workflow-editor-matrix.md`](../phase-2-3/35-rbac-workflow-editor-matrix.md).

## 5. Expected participants (minimum)

| Cohort | Minimum | Typical |
|--------|---------|---------|
| Editors (Authors) | **2** | 2–4 |
| Approvers | **1** | 1–2 |
| CMS admin (pilot) | **1** | 1 |
| Support owner | **1** named | 1 |
| Product / editorial signoff owner | **1** named | 1 |

Fewer than **two** editors **fails** “representative pilot” unless **formally waived** with owner + date (document in [`82`](./82-open-blockers-phase-7.md)).

## 6. Environment

| Environment | Use |
|-------------|-----|
| **Staging (Umbraco Cloud + Next staging)** | **Required** minimum for honest pilot — mirrors Delivery, preview, Workflow |
| **Local / dev** | Training sandbox only — **not** sufficient for acceptance evidence |
| **Production** | **Out of scope** for Phase 7 execution per charter — no production data mutation by Phase 7 pack |

## 7. Sample content and data expectations

- **Representative tree:** At least one **home**, **2+** child `webPage` nodes, **1+** deep enough to test navigation/slug concerns.
- **Blocks:** Each **high-traffic** block family from manifest present on ≥1 page (hero, rich text, image, CTA, etc. — per Phase 2–3 taxonomy).
- **Media:** Mix of **image** (with focal / alt policy per [`55`](../phase-5-6/55-media-redirect-and-url-migration-spec.md) / Phase 2–3) and **file** if used in content.
- **Workflow:** Staging Workflow **matches** approved RBAC matrix — prerequisite ([`77`](./77-workflow-preview-publish-validation.md)).

## 8. What counts as a representative pilot

- **Duration:** At least **5 business days** of active editorial use **or** completion of **all** mandatory scenarios in [`72`](./72-editorial-scenario-matrix.md) **plus** **≥8** substantive editor-initiated tasks (logged) **whichever is longer**.
- **Actors:** Real **editorial** staff (not only engineers) perform **≥80%** of editor-role steps (metric detail in [`76`](./76-editorial-acceptance-metrics-and-evidence.md)).
- **Governance:** **Every** publish in scope goes through **Workflow** where required — **zero** accepted bypasses.
- **Preview:** **Every** editor completes **preview** scenarios without “workaround guidance” from engineering.

## 9. What does NOT count as sufficient pilot evidence

- One-off **demo** scripted by engineering with no persistent artifacts.
- **Video recording only** without ticket IDs, timestamps, and mapping to scenario rows.
- Success defined only as “no P1 bugs” without **autonomy** and **support burden** metrics.
- Editors **unable** to finish scenarios **without** engineer **screen-sharing** every session.
- Publishing **via** Management API, SQL, or legacy app **for migrated types** “just for speed.”
- **Skipping** preview or Workflow “because staging is special.”
