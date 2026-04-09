# U00 Docs Trust And Delete Candidates

## Trust Matrix
| File | Classification | Why | Replacement / authoritative source |
|---|---|---|---|
| `docs/repo-audit/U00_REPO_STATUS_SUMMARY.md` | `CANONICAL` | This audit is the current code-first forensic baseline for the CMS/backoffice phase. | Use together with the other `docs/repo-audit/U00_*` files. |
| `docs/repo-audit/U00_RUNTIME_AND_SCHEMA_AUDIT.md` | `CANONICAL` | This file anchors runtime/schema truth against actual routes and migrations. | Use before touching editor UX. |
| `docs/umbraco-parity/U32_BELLISSIMA_TARGET_MODEL.md` | `SUPPORTING` | Useful as a target-state model, not as implementation truth. | Code and runtime always win. |
| `docs/cms-control-plane/CMS_CONTROL_PLANE_BASELINE.md` | `SUPPORTING` | Still useful for framing, but already partly historical. | Use only after checking current code/migrations. |
| `docs/umbraco-parity/U31R_RUNTIME_FAILURE_MAP.md` | `SUPPORTING` | Good intermediate runtime map, but superseded in detail by this U00 audit. | `U00_RUNTIME_AND_SCHEMA_AUDIT.md` |
| `docs/umbraco-parity/U30X_READ_CMS_REPO_CRAWL_BASELINE.md` | `SUPERSEDED` | Useful as a snapshot of an earlier read phase, but no longer the best current baseline. | `docs/repo-audit/U00_*` |
| `docs/umbraco-parity/UMBRACO_PARITY_EDITORIAL_EXPERIENCE.md` | `MISLEADING` | Too lightweight and optimistic for the current structural and schema reality. | `U00_PARITY_SCORECARD.md`, `U00_EDITOR_UX_FAILURES.md` |
| `docs/phase2b/CONTENT_TREE_EDITOR_RUNTIME.md` | `HISTORICAL` | Still useful for tree history, but scoped to a narrower phase and older runtime state. | Current tree route, tree UI, and `U00_EDITOR_RENDER_CHAIN.md` |
| `docs/refactor/PHASE1C_CONTENTWORKSPACE_DEEPER_SPLIT.md` | `HISTORICAL` | Documents a valid extraction step, but not the current total editor truth. | Current `ContentWorkspace*` chain and U00 render/import maps. |
| `docs/LIVE_REPOSITORY_VERIFICATION_DEVIATION_REPORT.md` | `SUPPORTING` | Valuable as a drift detector, but not the main current CMS/backoffice baseline. | `docs/repo-audit/U00_*` |
| `docs/ENTERPRISE_READINESS_DISCOVERY_REPORT.md` | `SUPPORTING` | Good broad platform hardening reference, but not a focused CMS/backoffice truth doc. | Use for platform context only. |
| `docs/backoffice-ai-system-revision-report.md` | `HISTORICAL` | Documents an AI revision moment, not the current total editor/system posture. | Current AI routes and `U00_RUNTIME_AND_SCHEMA_AUDIT.md` |
| `docs/MASTER_FULL_REPOSITORY_AUDIT.md` | `DUPLICATE` | Competes as a “full audit” but now drifts on counts and current CMS/editor interpretation. | `docs/repo-audit/U00_*` |
| `docs/FULL_REPOSITORY_AUDIT_VERIFIED.md` | `DUPLICATE` | Another top-level “full audit” competing with newer and more accurate work. | `docs/repo-audit/U00_*` |
| `docs/FORENSIC_REPOSITORY_AUDIT.md` | `DUPLICATE` | Same problem: overlapping audit scope, stale counts, older maturity framing. | `docs/repo-audit/U00_*` |

## Delete Candidates
No files are deleted in this phase. The rows below are later cleanup candidates only.

| File | Classification | Why it is harmful / outdated / duplicate | What replaces it | Safe to delete later? |
|---|---|---|---|---|
| `docs/MASTER_FULL_REPOSITORY_AUDIT.md` | `DELETE_CANDIDATE` | Competes as a repository truth doc, but older counts and platform posture now create audit drift. | `docs/repo-audit/U00_*` | Yes, after link/reference sweep. |
| `docs/FULL_REPOSITORY_AUDIT_VERIFIED.md` | `DELETE_CANDIDATE` | Same “verified full audit” posture as newer docs, but no longer the best truth source. | `docs/repo-audit/U00_*` | Yes, after link/reference sweep. |
| `docs/FORENSIC_REPOSITORY_AUDIT.md` | `DELETE_CANDIDATE` | Overlaps strongly with the two files above and creates three competing “master” audits. | `docs/repo-audit/U00_*` | Yes, after link/reference sweep. |
| `docs/umbraco-parity/UMBRACO_PARITY_EDITORIAL_EXPERIENCE.md` | `DELETE_CANDIDATE` | Too thin to be safe as a parity reference and easier to misread than to trust. | `U00_PARITY_SCORECARD.md`, `U00_EDITOR_UX_FAILURES.md` | Yes, or merge into parity docs later. |

## Docs Judgment
The doc layer is not useless. It is crowded. The real damage comes from multiple top-level audit files competing to be “full truth” while code, routes, and migrations have continued moving. The next build phase should treat `docs/repo-audit/U00_*` as the active baseline and downgrade older audits to historical or delete-candidate status.
