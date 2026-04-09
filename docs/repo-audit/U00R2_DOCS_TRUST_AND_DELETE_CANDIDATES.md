# U00R2 Docs Trust And Delete Candidates

## Trust Matrix
| File | Classification | Why | Replacement / authoritative source |
|---|---|---|---|
| `docs/repo-audit/U00R2_REPO_STATUS_SUMMARY.md` | `CANONICAL` | Current code-first forensic baseline for this CMS/backoffice pass. | Use with the other `U00R2_*` files. |
| `docs/repo-audit/U00R2_RUNTIME_AND_SCHEMA_AUDIT.md` | `CANONICAL` | Anchors runtime/schema truth against actual routes and migrations. | Use before touching any editor UX. |
| `docs/repo-audit/U00R2_BELLISSIMA_EXTENSION_TYPE_MATRIX.md` | `CANONICAL` | Hard concept-to-concept parity proof against official Umbraco references. | Use before making parity claims. |
| `docs/repo-audit/U00R2_EVIDENCE_INDEX.md` | `CANONICAL` | Makes the evidence trail explicit and reusable in the next build phase. | Use as the first lookup index. |
| `docs/umbraco-parity/U32_BELLISSIMA_TARGET_MODEL.md` | `SUPPORTING` | Useful target-state model, not implementation truth. | Code and runtime always win. |
| `docs/umbraco-parity/U32_DECISION.md` | `SUPPORTING` | Honest about code-governed document/data type posture and current Bellissima limits. | Read after current code and `U00R2_*`. |
| `docs/cms-control-plane/CMS_CONTROL_PLANE_BASELINE.md` | `SUPPORTING` | Still useful framing, but already partly historical. | Check current code/migrations first. |
| `docs/umbraco-parity/U31R_RUNTIME_FAILURE_MAP.md` | `SUPPORTING` | Good intermediate runtime map, but superseded in detail by this audit. | `U00R2_RUNTIME_AND_SCHEMA_AUDIT.md` |
| `docs/umbraco-parity/U30X_READ_CMS_REPO_CRAWL_BASELINE.md` | `SUPERSEDED` | Earlier crawl snapshot, no longer the best current baseline. | `docs/repo-audit/U00R2_*` |
| `docs/phase2b/CONTENT_TREE_EDITOR_RUNTIME.md` | `HISTORICAL` | Still useful for tree history, but scoped to an older runtime/editor phase. | Current tree route, tree UI, and `U00R2_EDITOR_RENDER_CHAIN.md` |
| `docs/refactor/PHASE1C_CONTENTWORKSPACE_DEEPER_SPLIT.md` | `HISTORICAL` | Documents a valid extraction step, but not the current total editor truth. | Current `ContentWorkspace*` chain and `U00R2_*` render/import maps |
| `docs/LIVE_REPOSITORY_VERIFICATION_DEVIATION_REPORT.md` | `SUPPORTING` | Valuable as drift detector, but not the main CMS/backoffice baseline. | `docs/repo-audit/U00R2_*` |
| `docs/ENTERPRISE_READINESS_DISCOVERY_REPORT.md` | `SUPPORTING` | Good platform-hardening reference, not a focused CMS truth doc. | Use for platform context only. |
| `docs/backoffice-ai-system-revision-report.md` | `HISTORICAL` | Documents an AI revision moment, not the current total editor/system posture. | Current AI routes and `U00R2_RUNTIME_AND_SCHEMA_AUDIT.md` |
| `docs/umbraco-parity/UMBRACO_PARITY_EDITORIAL_EXPERIENCE.md` | `MISLEADING` | Too lightweight and optimistic for the current structural and schema reality. | `U00R2_PARITY_SCORECARD.md`, `U00R2_EDITOR_UX_FAILURES.md` |
| `docs/MASTER_FULL_REPOSITORY_AUDIT.md` | `DUPLICATE` | Competes as a repository truth doc but now drifts on counts and current CMS/editor interpretation. | `docs/repo-audit/U00R2_*` |
| `docs/FULL_REPOSITORY_AUDIT_VERIFIED.md` | `DUPLICATE` | Another top-level “full audit” competing with newer and more accurate work. | `docs/repo-audit/U00R2_*` |
| `docs/FORENSIC_REPOSITORY_AUDIT.md` | `DUPLICATE` | Same problem: overlapping audit scope, stale counts, older maturity framing. | `docs/repo-audit/U00R2_*` |

## Delete Candidates
No files are deleted in this phase. The rows below are later cleanup candidates only.

| File | Classification | Why it is harmful / outdated / duplicate | What replaces it | Safe to delete later? |
|---|---|---|---|---|
| `docs/MASTER_FULL_REPOSITORY_AUDIT.md` | `DELETE_CANDIDATE` | Competes as repository truth while older counts and posture claims now create audit drift. | `docs/repo-audit/U00R2_*` | Yes, after link/reference sweep. |
| `docs/FULL_REPOSITORY_AUDIT_VERIFIED.md` | `DELETE_CANDIDATE` | Same “verified full audit” posture as newer docs, but no longer the best truth source. | `docs/repo-audit/U00R2_*` | Yes, after link/reference sweep. |
| `docs/FORENSIC_REPOSITORY_AUDIT.md` | `DELETE_CANDIDATE` | Overlaps strongly with the two files above and creates three competing “master” audits. | `docs/repo-audit/U00R2_*` | Yes, after link/reference sweep. |
| `docs/umbraco-parity/UMBRACO_PARITY_EDITORIAL_EXPERIENCE.md` | `DELETE_CANDIDATE` | Too thin to be safe as a parity reference and easier to misread than to trust. | `U00R2_PARITY_SCORECARD.md`, `U00R2_EDITOR_UX_FAILURES.md` | Yes, or merge into parity docs later. |

## Docs Judgment
The doc layer is not useless. It is crowded. The real damage comes from multiple top-level audit files competing to be “full truth” while code, routes, and migrations have continued moving. The next build phase should treat `docs/repo-audit/U00R2_*` as the active baseline and downgrade older audits to `HISTORICAL`, `DUPLICATE`, or `DELETE_CANDIDATE`.
