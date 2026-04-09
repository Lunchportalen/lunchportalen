# Phase 6 exit checklist — binary gate

**Rule:** Every row **YES** to sign off Phase 6. **NO** = not ready.

| # | Criterion | YES/NO |
|---|-----------|--------|
| 1 | **Editor AI** lane defined (Umbraco context) (`61`) | |
| 2 | **Automation** lane defined with API Users (`61`, `63`) | |
| 3 | **Domain AI** lane separated from CMS editorial (`61`) | |
| 4 | **Forbidden actions** explicit for each lane (`61`, `65`) | |
| 5 | **No silent publish** path for AI or automation (`65`) | |
| 6 | **No Workflow bypass** by AI or automation (default) (`60`, `65`) | |
| 7 | **API User** scopes documented per integration (`63`) | |
| 8 | **Logging/audit** fields defined (`64`) | |
| 9 | **Kill-switch** defined + verification steps (`64`) | |
| 10 | **Browser** exposure of Management / provider / webhook / Delivery **write** secrets **forbidden** — verified by design review | |
| 11 | **Developer MCP** boundary explicit (`66`) | |
| 12 | **Editor capability matrix** complete for **Keep** items (`62`) | |
| 13 | **R6** risks reviewed (`67`) | |
| 14 | **Blocker-grade** items in `72` each have **owner + decision date** or are **closed** | |

## Hard rule

Rows **5** or **10** NO ⇒ Phase 6 signoff **invalid**.

## Signatures (process)

| Role | Name | Date |
|------|------|------|
| CTO | | |
| Security | | |
| Editorial lead | | |
| Platform admin | | |
| Lead developer | | |
