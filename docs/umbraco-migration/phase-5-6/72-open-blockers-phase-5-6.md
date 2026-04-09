# Open blockers — Phase 5 & 6 signoff

**Only real items** that prevent **honest** Phase 5 or Phase 6 signoff if left unresolved. Carried from Phase 2–3 / Phase 4 where applicable.

| ID | Blocker | Blocks | Owner | Target resolution |
|----|---------|--------|-------|-------------------|
| **X1** | **`appShellPage` / overlays** (B1 / PB1) | Complete migration manifest for overlay routes; freeze scope unclear | Product owner + Solution architect | Written decision: Umbraco vs app per route class |
| **X2** | **Public locale strategy** (`en` vs `nb`-only) (B2 / PB2) | ETL culture mapping, URL parity, Delivery queries | CTO + Product owner | Signed locale policy + Umbraco culture config |
| **X3** | **Full plugin block inventory** (B3 / PB3) | Unknown block types → quarantine risk; parity false negatives | Migration lead + Lead developer | Closed inventory or signed “unknown block governance” |
| **X4** | **Umbraco Workflow proof on staging** (B4 / PB4) | Cannot claim governance parity for AI “no silent publish” testing | Platform admin + CMS admin | Staging Workflow matches `35-rbac-workflow-editor-matrix.md` |
| **X5** | **Staging Delivery + Media Delivery + index health evidence** (PB5) | Parity tests may lack authoritative read surface | Platform admin | Dated verification note + smoke output linked from Phase 4 exit |
| **X6** | **Media alt / SVG policy** (PB6 / L1–L3) | Alt precedence conflicts; SVG import rules ambiguous | Product + Accessibility champ | Sign L1–L3 or risk acceptance |
| **X7** | **Log retention destination unset** | Phase 6 audit signoff incomplete | Platform admin + Security | Choose SIEM/store + retention |
| **X8** | **AI provider subprocessors / DPA** (if not already covered) | Legal basis for editor AI | Legal + Security | Processor agreement on file |
| **X9** | **Legacy write-freeze monitoring in production infra** | Cannot prove “no double write” | Lead developer + Platform admin | Metrics/alerts deployed per `56` |

## Not blockers for authoring this pack

- Implementation of ETL code, Next routes, or Umbraco packages.
- Editorial training content.

## Filler policy

If an item above is **resolved**, remove it from this file with **date + link** to evidence (do not leave stale rows).
