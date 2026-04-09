# Content parity validation and diff rules

## 1. Parity dimensions

| Dimension | What is compared | Source of truth for “expected” |
|-----------|------------------|--------------------------------|
| **Field parity** | Page-level properties per manifest | Legacy extract snapshot vs Umbraco **draft or published** slice per test mode |
| **Block parity** | Count, order, type sequence, per-block fields | Legacy `body.blocks` vs Delivery or Management read-back **per agreed test API** |
| **Slug parity** | `slug` + parent path + culture | Legacy vs Umbraco |
| **SEO parity** | Title, description, canonical, robots, OG | `body.meta.seo` / social vs Umbraco SEO group |
| **Media reference parity** | Each image/file reference resolves | Legacy resolved URL vs Media Delivery URL **per Phase 4** |
| **Redirect parity** | Legacy redirects / slug changes | `redirectRule` or edge config — **per redirect manifest** (execution in later phase) |
| **Tree parity** | Parent/child, sort order | Legacy tree vs Umbraco tree |

**Note:** After cutover, **published** public parity uses **Delivery API** output, not Postgres. During migration **staging**, comparison may use Management read-back **only if** contractually equivalent to Delivery shape — if not, **Delivery read** is mandatory for published parity tests.

## 2. Validation levels

| Level | Description |
|-------|-------------|
| **L0** | Schema: required properties exist; cultures present |
| **L1** | Automated field-by-field diff (machine) |
| **L2** | Block-level structural diff (type chain + hashed payloads) |
| **L3** | Visual / preview comparison (human) — **not** Phase 5 automation scope beyond **defining** when it is required |

## 3. Acceptable deltas

| Delta | Condition |
|-------|-----------|
| **Whitespace normalization** | Documented in manifest (e.g. trim end) |
| **Reordered JSON keys** | Semantically identical |
| **New Umbraco-only defaults** | Empty optional fields populated with signed defaults |
| **Block internal IDs** | Changed (expected) |
| **Media URL host** | Different if **both** resolve to same asset per hash/size check |

## 4. Unacceptable deltas

| Delta | Action |
|-------|--------|
| Missing block | **FAIL** |
| Wrong block type sequence | **FAIL** unless explicit reorder rule signed |
| Missing SEO field on indexable page | **FAIL** |
| Broken media | **FAIL** or **quarantine** |
| Wrong slug or duplicate slug | **FAIL** |
| Extra/missing culture variant vs policy | **FAIL** |

## 5. Diff rules (algorithm expectations)

1. **Normalize** both sides using **only** manifest-documented steps.
2. **Compare** canonical form (e.g. stable JSON sort, lowercase URLs for comparison only).
3. **Report** path-level diff with **legacy id** and **Umbraco key**.
4. **Quarantine** unknown block types — **do not** coerce to “generic.”

## 6. Sample-based vs full-run validation

| When | Method |
|------|--------|
| **Early staging** | Stratified sample: home, deepest page, each block type, each locale |
| **Pre-cutover** | **Full run** L1 + L2 for all migrated pages |
| **Post-fix replay** | Targeted **regression** on affected ids + smoke full |

## 7. Manual review thresholds

| Trigger | Threshold |
|---------|-----------|
| Quarantine count | **> 0** requires editorial triage before signoff |
| Hash mismatch on media | **100%** reviewed until cause class known |
| SEO optional empty | Per editorial policy — **must be written** |

## 8. Signoff criteria for migrated content

Binary gates (see also `58`):

- Full-run L1/L2 **green** OR every diff **waived** with named approver + ticket.
- L3 spot-check **passed** for top N URLs.
- **No** open **unacceptable** deltas.

## 9. Machine-readable parity dimensions

See [`parity-rules.csv`](./parity-rules.csv).
