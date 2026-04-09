# Editorial scenario matrix — mandatory pilot exercises

**Rule:** Each scenario is **required** for Phase 7 signoff unless **explicitly waived** in writing (owner + date) and recorded in [`82-open-blockers-phase-7.md`](./82-open-blockers-phase-7.md). **No scenario may depend on legacy Next/Sanity/Postgres editor** for **migrated** in-scope types ([`71`](./71-pilot-scope-and-cohort.md)).

**Columns:** scenario name · actor · content type · preconditions · steps · touched nodes/types · expected outcome · workflow expectation · evidence required · failure severity · confidence

Machine-readable mirror: [`editorial-scenario-matrix.csv`](./editorial-scenario-matrix.csv).

---

## Matrix

| # | Scenario name | Actor | Content type | Preconditions | Steps | Touched nodes/types | Expected outcome | Workflow expectation | Evidence required | Failure severity | Confidence |
|---|---------------|-------|--------------|---------------|-------|---------------------|------------------|----------------------|-------------------|------------------|------------|
| S1 | **Create page** | Editor | `webPage` | Staging Workflow on; editor in Author group; parent folder exists | Create under agreed parent → set **nb** culture → title + slug → add ≥1 block → Save | Parent folder, new `webPage`, Element Types | Draft node visible in tree; slug valid; **no** public URL until publish path complete | Draft saved; **not** live until approved publish | Screenshot of tree + node; export or API snapshot of node key; ticket ID | **P0** — blocks autonomy | High |
| S2 | **Edit page** | Editor | `webPage` | Existing migrated or pilot-created `webPage` | Open node → edit title/body field → reorder or edit block → Save | `webPage`, blocks | Changes persist; history/revision visible per Umbraco | Remains in draft or re-enters draft per Workflow rules | Before/after note + revision reference; ticket ID | **P0** | High |
| S3 | **Add / reorder blocks** | Editor | `webPage` | Page in editable state | Add allowed Element Type → configure required fields → drag order → Save | Element Types, Block List | Order stable; validation messages clear; max-depth policy respected | Save allowed in draft; submit may require mandatory SEO per policy | Screenshot of block editor + Delivery/preview JSON excerpt if available; ticket ID | **P0** | High |
| S4 | **Manage media** | Editor | Media + `webPage` | Media library folders exist | Upload to agreed folder → insert into block via picker → Save | Image/File Media Types, block properties | No broken image; Media Delivery URL resolves ([`44`](../phase-4/44-media-delivery-contract.md)) | Same as S1–S3 for page save | Media item ID + page reference; link check log; ticket ID | **P0** (broken media) / **P1** (UX friction) | High |
| S5 | **Localize content** | Editor | `webPage` (and variants) | **Only if** signed locale policy enables **>1** culture ([`B2`](../phase-2-3/37-open-questions-and-blockers.md)); else run **S5-alt** | Switch culture → translate required fields → Save | Culture variants on `webPage` | **nb** (or primary) completeness per policy; **no** silent wrong-culture publish | Workflow may enforce variant gates | Per-culture screenshots + slug/URL note per policy; ticket ID | **P0** if multi-locale promised; **N/A** if waived | Medium until B2 closed |
| S5-alt | **Single-culture completeness** | Editor | `webPage` | **When only `nb`** (or single signed culture) | Verify all mandatory fields complete for that culture → attempt submit | Same | Validation matches policy; no phantom `en` requirement | Submit allowed when mandatory fields met | Checklist sign-off on culture policy; screenshot | **P1** | High |
| S6 | **Preview content** | Editor | `webPage` | Phase 4 preview contract implemented on staging ([`43`](../phase-4/43-preview-contract.md)) | Use Umbraco **Preview** / Save and preview → open generated link | Preview channel, Next preview route | Draft visible; **noindex**; **no** published-cache leakage; culture matches selection | N/A (preview is not publish) | HAR or server log snippet + screenshot of preview banner; ticket ID | **P0** | High |
| S7 | **Submit for approval** | Editor | `webPage` | Draft complete per mandatory fields | Workflow → Submit for review (exact label per Cloud config) | Workflow instance on node | State moves to review; approver notified per config | **Mandatory** path — no direct publish for author | Workflow state screenshot + notification evidence or inbox screenshot; ticket ID | **P0** | High |
| S8 | **Approve** | Approver | `webPage` | Item in review queue | Open Workflow task → Approve (comment optional per policy) | Workflow | Approved state recorded; audit shows actor + time | SoD: approver ≠ sole author of same change where policy forbids | Audit/history export or screenshot; ticket ID | **P0** | High |
| S9 | **Reject** | Approver | `webPage` | Item in review queue | Reject with **required** comment per policy | Workflow | Author can revise; **no** partial publish of rejected version | Reject is first-class | Screenshot of reject + author-visible feedback; ticket ID | **P0** | High |
| S10 | **Publish** | Approver (or policy-defined publisher) | `webPage` | Approved per Workflow | Publish to **Live** (exact UX per Cloud) | Delivery index, published content | Published Delivery returns new content; webhooks fire per [`46`](../phase-4/46-webhooks-and-revalidation-contract.md) | **No bypass** of Workflow stages | Published URL + timestamp + Delivery JSON hash or etag; ticket ID | **P0** | High |
| S11 | **Verify published in Next** | Editor or Approver | `webPage` | S10 complete | Open **staging** public URL (anonymous) → verify visible change | Next published route | Change visible within agreed revalidation SLA; **no** preview leakage to anonymous | N/A | Side-by-side screenshot + `Cache-Control` / response note if relevant; ticket ID | **P0** | High |
| S12 | **Edit site settings (if in scope)** | Editor | `siteSettings` | Singleton exists; editor has permission | Change agreed low-risk default (e.g. label) → Workflow → publish | `siteSettings` | Dependent pages reflect behavior per design | Full Workflow if mandated | Evidence per S6–S11 subset as applicable; ticket ID | **P1** if in pilot slice | Medium |

## Severity reference

See [`75-defect-severity-cutoff-and-triage.md`](./75-defect-severity-cutoff-and-triage.md) for **P0–P3** definitions. **P0** in this matrix **blocks** Phase 7 signoff if unfixed or unwaived.

## Confidence column

**High** = aligns directly with Phase 2–3 journeys J1–J9. **Medium** = depends on unset B2 or optional types — must be reconciled before signoff or waived.
