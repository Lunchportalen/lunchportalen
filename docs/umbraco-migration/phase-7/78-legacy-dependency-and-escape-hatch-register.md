# Legacy dependency and escape hatch register

**Rule:** Any **Yes** in **blocks signoff** with **no** formal exception **⇒ Phase 7 NOT READY**.

Machine-readable mirror: [`legacy-dependency-register.csv`](./legacy-dependency-register.csv).

## Register

| ID | Dependency / escape hatch | Affected content type | Actor affected | Why it exists | Allowed temporarily? | Owner | Planned removal | Blocks signoff? |
|----|---------------------------|------------------------|----------------|---------------|------------------------|-------|-----------------|-----------------|
| L1 | **Legacy Next backoffice** (`/backoffice/content`) for **page body** | `webPage`, `webPageHome` | Editor | Migration not complete / habit | **No** for migrated types | Migration lead | Cutover + freeze | **Yes** |
| L2 | **Postgres direct edit** of `content_pages` / variants | Same | Engineer | Hotfix culture | **No** | Lead developer | Write-freeze enforcement | **Yes** |
| L3 | **Sanity Studio** as authority for public marketing pages | Same | Editor | Historical | **No** | Product owner | Decommission | **Yes** |
| L4 | **Management API** ad-hoc publish script | Same | Engineer | “Faster” pilot | **No** | CMS admin | Policy + monitoring | **Yes** |
| L5 | **`appShellPage` undecided** ([`B1`](../phase-2-3/37-open-questions-and-blockers.md)) | `appShellPage` / overlays | Editor | Product pending | **Yes** only if **excluded** from pilot scope | Product owner | Decision X1 | **Yes** if pilot claims full site without decision |
| L6 | **Dual culture policy unsigned** ([`B2`](../phase-2-3/37-open-questions-and-blockers.md)) | `webPage` variants | Editor | Strategy open | **Yes** with **nb-only** pilot mode signed | CTO + Product | Close B2 | **Yes** for multi-locale claims |
| L7 | **Unknown block types** ([`B3`](../phase-2-3/37-open-questions-and-blockers.md)) | `webPage` blocks | Editor / ETL | Inventory open | **Yes** with **quarantine** governance signed | Migration lead | Close X3 | **Yes** if “full parity” claimed |
| L8 | **Preview via Postgres** `?preview=true` ([`43`](../phase-4/43-preview-contract.md) §12) | `webPage` | Editor | Legacy Next | **No** | Lead developer | Umbraco preview path | **Yes** |
| L9 | **Engineer performs author publish** “for” editor | In-scope types | Editor | Support habit | **No** | Support owner | Training + tooling | **Yes** if chronic ([`76`](./76-editorial-acceptance-metrics-and-evidence.md) A1) |

## Brutal clarification

- **Temporary** allowed **only** with **dated** risk acceptance in [`82`](./82-open-blockers-phase-7.md) — not verbal.
- **Excluded from pilot** types (e.g. overlays) **must not** appear in **Phase 7 “full site”** claims.

## Formal exception template

```
Exception ID:
Content type:
Scope:
Justification:
Approver roles:
Expiry date:
Link to evidence:
```

File in ticket + [`82`](./82-open-blockers-phase-7.md).
