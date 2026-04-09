# Binding disposition — supabase / docs / artifacts (untracked)

**Date:** 2026-04-09  
**HEAD:** `8fa5dd238d8ba7727e38b5c3d97475eb77611f76`  
**Scope:** Untracked paths only (`git ls-files --others --exclude-standard`), buckets `supabase/**`, `docs/**`, `artifacts/**`. No deletes, no `.gitignore`, no product code edits in this package.

## Command snapshot (this run)

| Command | Result |
|--------|--------|
| `git status --short` | Large dirty tracked tree (hundreds of `M`/`D`); not remediated here. |
| `git diff --name-only` / `--stat` / `--cached` | Non-empty (tracked changes present). |
| `git ls-files --others --exclude-standard` | **3163** untracked paths total. |
| Untracked in `docs/**` | **1230** paths. |
| Untracked in `artifacts/**` | **315** paths. |
| Untracked in `supabase/**` | **82** paths — **all** under `supabase/migrations/` (no other `supabase/*` prefixes in untracked list). |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings only) |
| `npm run test:run` | PASS — 359 test files passed, 4 skipped. |
| `npm run build:enterprise` | PASS (exit 0), SEO gates OK. |

### Untracked grouping (2nd segment, selected)

| Bucket | Count (paths) |
|--------|----------------|
| `docs/umbraco-parity` | 652 |
| `docs/cms-control-plane` | 130 |
| `docs/umbraco-migration` | 105 |
| `supabase/migrations` | 82 |
| `docs/audit` | 71 |
| `docs/repo-audit` | 40 |
| `docs/phase2c` | 34 |
| `docs/phase2d` | 31 |
| `artifacts/u98c-proof-chain-lock` | 30 |
| `artifacts/u97i-proof-chain-lock` | 27 |
| `docs/hardening` | 27 |
| `artifacts/u97g-content-structure-live-proof` | 23 |
| `docs/phase2a` | 23 |
| `docs/refactor` | 22 |
| `docs/phase2b` | 22 |
| `artifacts/u98b-variants-publish-live-proof` | 21 |
| `artifacts/u95b-data-types-workspace-runtime-proof` | 21 |
| … | (see full `git ls-files --others` for remainder) |

### Artifacts shape (untracked)

- **~240** paths: `artifacts/**/*.png` (screenshot / visual proof).  
- **~71** paths: `artifacts/**/*.{json,txt,md,log}` (manifests, gate logs, runtime captures).  
- Mixture: several folders contain **both** PNG and text (e.g. proof-chain-lock packs).

### supabase on disk (directories)

- `supabase/migrations`, `supabase/.branches`, `supabase/.temp` — **untracked list contains only `migrations/*.sql`** (82 files). `.branches` / `.temp` not listed as untracked in this snapshot (likely already ignored or absent from index query).

---

## A) Factual characterization

| Bucket | What it is |
|--------|------------|
| **supabase/migrations** | SQL migration files only; content mixes **RC-relevant schema** (e.g. orders, agreements, fixes) with **large non-core / experimental surfaces** (AI logs, growth, SaaS experiments, etc.). **Not** reconciled in this package against production or a declared RC schema subset. |
| **docs/** | Authored **program and parity documentation** (Umbraco parity, CMS control plane, migration phases, audits, hardening, phase2*, commercial/support). Reads as **revision and program truth**, not random scratch. |
| **artifacts/** | **Curated proof / gate evidence**: PNG captures, JSON manifests, gate stdout (`gate-*`, `proof-*`, playwright, sanity, health). **Not** application runtime; **binary-heavy**. |

---

## B) Binding decisions (one outcome per sub-bucket)

Outcomes: **KEEP** | **IGNORE** | **DELETE** | **HOLD OUTSIDE BASELINE NOW**

### supabase

| Sub-bucket | Decision | Why | Blocks baseline directly? | Next package MAY | Next package MUST NOT |
|------------|----------|-----|---------------------------|------------------|-------------------------|
| `supabase/migrations/**` (82 untracked `.sql`) | **HOLD OUTSIDE BASELINE NOW** | Schema truth must match **deployed DB + RC scope**; mixture of core and experimental migrations makes blind **KEEP** or blind **DELETE** dishonest without reconciliation. | **Yes** — untracked migrations = git does not record schema evolution; baseline honesty fails while they float. | Diff against prod/staging; define RC-allowed subset; commit approved migrations (**KEEP** path) or remove confirmed junk (**DELETE** path); document order/conflicts. | Mass-commit without ordering review; silent drop of files that might match prod; conflate “looks legitimate” with **KEEP**. |
| `supabase/.branches`, `supabase/.temp` (if they appear untracked later) | **IGNORE** | Local Supabase CLI / tooling churn, not product revision truth. | Only if they show up as untracked noise. | Add ignore rules **in a dedicated ignore package** (not this one). | Treat as schema truth. |

### docs

| Sub-bucket | Decision | Why | Blocks baseline directly? | Next package MAY | Next package MUST NOT |
|------------|----------|-----|---------------------------|------------------|-------------------------|
| `docs/umbraco-parity/**` | **KEEP** | Formal parity / contract narrative for CMS/backoffice; program artifact. | **Yes** until committed — volume inflates dirty untracked set. | Stage/commit in slices; link from index if needed. | Relabel as disposable noise without review. |
| `docs/cms-control-plane/**` | **KEEP** | Control-plane specification and execution notes. | Same | Same | Same |
| `docs/umbraco-migration/**` | **KEEP** | Phased migration matrices and checklists. | Same | Same | Same |
| `docs/audit/**` (untracked under tree) | **KEEP** | Audit trail and gate records are organizational truth. | Same | Same | Delete without owner rule. |
| `docs/repo-audit/**` | **KEEP** | Repository / parity scorecard style evidence. | Same | Same | Same |
| `docs/phase2a/**`, `docs/phase2b/**`, `docs/phase2c/**`, `docs/phase2d/**`, `docs/phase2/**` | **KEEP** | Phase execution and decisions. | Same | Same | Same |
| `docs/refactor/**` | **KEEP** | Planned / recorded refactors; revision context. | Same | Same | Same |
| `docs/hardening/**` | **KEEP** | Hardening logs and execution. | Same | Same | Same |
| `docs/live-ready/**` | **KEEP** | Live readiness matrices. | Same | Same | Same |
| `docs/enterprise-ready/**` | **KEEP** | Enterprise ops/support posture. | Same | Same | Same |
| `docs/decision/**` | **KEEP** | Explicit decision records. | Same | Same | Same |
| `docs/product/**` | **KEEP** | Product-facing internal spec. | Same | Same | Same |
| `docs/security/**` | **KEEP** | Security README / posture. | Same | Same | Same |
| `docs/sales/**`, `docs/investor/**` | **KEEP** | Commercial / pitch docs; legitimate repo content. | Same | Same | Same |
| `docs/integrations/**` | **KEEP** | Integration notes. | Same | Same | Same |
| `docs/supabase-nextjs-audit-report.md` (root under `docs/`) | **KEEP** | Standalone audit report. | Same | Same | Same |

### artifacts

| Sub-bucket | Decision | Why | Blocks baseline directly? | Next package MAY | Next package MUST NOT |
|------------|----------|-----|---------------------------|------------------|-------------------------|
| `artifacts/**` (all untracked proof trees: PNG + JSON + gate logs + `.gitkeep` stubs) | **HOLD OUTSIDE BASELINE NOW** | This is **evidence bank**, not shipping code. Large binaries + volatile gate dumps should not enter a **baseline freeze** without **curation** and **storage policy** (what is canonical, what is ephemeral, optional LFS/external archive). | **Yes** as *noise / hygiene* on `git status` — does not block `build:enterprise` but blocks a **clean baseline story**. | Define canonical proof sets; archive or trim; selectively **KEEP** tiny manifests if policy says so; **DELETE** duplicates/obsolete after manifest; **IGNORE** only with explicit policy. | Mass **KEEP** of PNGs without size policy; **DELETE** without manifest review; pretend artifacts are product source. |

**Note:** `artifacts/u91-block-entry-model-proof/.gitkeep` is **not** product truth; disposition of the **tree** is **HOLD** until curation — the **next** technical package may reclassify that leaf as **DELETE** after confirmation.

---

## C) What still blocks baseline (after these decisions)

1. **This disposition is not execution** — `docs/**` and `supabase/migrations` remain **physically untracked** until add/commit or remove.  
2. **Large tracked dirty tree** (see `git status`) — out of scope here but still invalidates “clean baseline”.  
3. **~939** untracked paths under `lib/**` (not decided in this package) — largest **unclassified** structural remainder.  
4. **Other untracked** (`archive/**`, `app/**`, root files, etc.) — still outside this disposition.  
5. **Artifacts** — remain **HOLD** until curation; they will keep polluting status until handled.

---

## D) Baseline status (single)

**BASELINE ER BEDRE, MEN FORTSATT BLOKKERT**

**Reason:** Gates (`typecheck`, `lint`, `test:run`, `build:enterprise`) pass on this HEAD, but **repository baseline honesty** still fails: thousands of untracked paths, **82** uncommitted migrations, **315** artifact files, massive tracked diff. Binding decisions remove **ambiguity**; they do not **clear** the tree.

---

## E) Exactly one next package

**Name:** `owner decision on untracked lib tree`  

**Why:** `lib/**` has **~939** untracked paths — the **largest remaining structural bucket without a binding disposition** after this record. Until `lib/**` has the same class of decisions (KEEP / IGNORE / DELETE / HOLD), baseline remains **structurally dishonest** regardless of CMS/docs clarity.

**What it closes:** Explicit fate for `lib/**` untracked mass so the next execution wave can apply commits, ignores, or deletes **without** guessing.

---

## F) Sluttdom (binding)

Per nå er **supabase/migrations** **HOLD OUTSIDE BASELINE NOW** (krever avstemming mot RC/prod før KEEP/DELETE per fil), **docs/** (listed subtrees) **KEEP** (skal inn som repo-sannhet via egen commit-pakke), og **artifacts/** **HOLD OUTSIDE BASELINE NOW** (bevisbank som krever kuratering og lagringspolicy). Neste ærlige steg er **eierbeslutning for untracked `lib/**`-treet**.
