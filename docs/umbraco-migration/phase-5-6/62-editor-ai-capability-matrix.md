# Editor AI capability matrix (Umbraco)

One row per **candidate** capability. **Publish column must be NO for all.**  
**CSV mirror:** [`ai-capability-matrix.csv`](./ai-capability-matrix.csv)

| capability | content_types_affected | actor | allowed_action | output_form | may_modify_content | may_publish | required_approval | audit_requirement | keep_reject_decision | confidence |
|------------|-------------------------|-------|----------------|-------------|-------------------|-------------|-------------------|-------------------|----------------------|------------|
| Alt text suggestion | Blocks with images (`elHero`, `elImage`, …) | Author/Editor | Propose alt strings | Suggestion + diff preview | **Yes** only on **explicit** editor apply | **No** | Editor click-to-apply; optional **Editor** role gate for site-wide | Log capability, block id, before/after alt | **Keep** | High |
| SEO title / meta description suggestion | `webPage`, `webPageHome` | Author/Editor | Propose title/description | Suggestion | Yes on apply | **No** | Same | Log SEO fields touched | **Keep** | High |
| Copy rewrite suggestion | Marketing pages | Author/Editor | Paraphrase sections | Diff | Yes on apply | **No** | **Editor** review for live site sections | Log section id | **Keep** with **human review** mandatory | High |
| Summary / excerpt generation | Long-form pages | Author/Editor | Generate intro/summary | Draft text | Yes on apply | **No** | Author ok for internal notes; **Editor** for public | Log | **Keep** | Medium |
| Taxonomy / tag suggestion | If taxonomy modeled | Editor | Suggest tags | Structured list | Yes on apply | **No** | Editor | Log | **Keep** if taxonomy exists **else** **Reject** | Low |
| Translation assist | `nb` → `en` (if B2 allows `en`) | Translator role | Segment translation | Suggestion per field | Yes on apply | **No** | Translator + **Approver** for target culture | Log culture + fields | **Defer** until B2 closed | Low |
| Block layout suggestion | Block grid | Editor | Suggest reorder/add | **Read-only** preview mock | **No** auto-apply | **No** | Editor manual apply | Log view event only | **Reject** auto-apply; **Keep** advisory | Medium |
| “Fix all SEO issues” bulk | All pages | **Reject default** | — | — | — | **No** | — | — | **Reject** (creep / silent wide change) | High |
| Image generation | Marketing | Editor | Create **draft** media candidate | Asset in staging | Yes **only** as **unpublished** media | **No** | **Editor** + brand policy | Log prompt **class** + asset id | **Keep** with policy | Medium |
| Accessibility contrast hint | CTA blocks | Author | Flag contrast risk | Annotation | No | **No** | Optional | Log | **Keep** | Medium |

## Notes

- **may_modify_content:** “Yes” means **user-confirmed** apply into **draft** fields, never direct **live** mutation.
- **Legacy Next `/api/backoffice/ai/*`:** For **page body** scope, **retire** at cutover per Phase 0–1 / `U17`; parity capabilities **re-home** to Lane A.
