# Binding disposition — untracked `lib/**`

**Date:** 2026-04-09  
**HEAD:** `8fa5dd238d8ba7727e38b5c3d97475eb77611f76`  
**Scope:** `git ls-files --others --exclude-standard` under `lib/**` only. No edits under `lib/**`, no `.gitignore`, no commits in this package.

## Command snapshot (this run)

| Command | Result |
|--------|--------|
| `git rev-parse HEAD` | `8fa5dd238d8ba7727e38b5c3d97475eb77611f76` |
| `git status --short` | Large tracked dirty tree (unchanged by this package). |
| `git diff --cached --name-only` | Empty (nothing staged). |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings only) |
| `npm run test:run` | PASS — 359 test files passed, 4 skipped. |
| `npm run build:enterprise` | PASS — SEO gates OK. |

### `lib/**` untracked volume

| Metric | Value |
|--------|--------|
| Untracked paths under `lib/**` | **939** |
| Distinct top-level segments (`lib/<name>`) | **107** (sum of per-segment file counts = **939**) |
| Tracked paths under `lib/**` (`git ls-files`) | **1187** (partial tree already revisioned) |

### Path resolution note

`tsconfig.json` maps `@/lib/*` → `./lib/*` **and** `./src/lib/*` (dual root). **Untracked mass lives under repo-root `lib/`,** not `src/lib/` (only **2** tracked files under `src/lib/` in this snapshot).

### Critical pattern: “core” already tracked elsewhere, but `lib/core` is not

These subtrees have **0** untracked files (fully tracked): `lib/cms`, `lib/ai`, `lib/http`, `lib/date`, `lib/week`, `lib/db`, `lib/auth`, `lib/system`, `lib/superadmin`, `lib/phone`.

**Entire** `lib/core/**` is **untracked** (22 `.ts` files) while **many** `app/api/**` routes and other `lib/**` modules import `@/lib/core/*` (e.g. `structuredLog`, `traceRequest`, `featureFlags`, `tenantGuard`, `withCache`, `auditLog`). So the untracked set is **not** an optional sandbox — it is **shipped dependency surface** missing from git.

### Distribution (top untracked segments by count)

| Segment | Files |
|---------|------:|
| `lib/social` | 74 |
| `lib/sales` | 60 |
| `lib/growth` | 57 |
| `lib/revenue` | 45 |
| `lib/autonomy` | 38 |
| `lib/ads` | 33 |
| `lib/ml` | 30 |
| `lib/outbound` | 27 |
| `lib/core` | 22 |
| `lib/mvo`, `lib/global`, `lib/pipeline` | 20 each |
| … | (remaining segments sum to 939) |

**File-kind signal:** essentially all **TypeScript** implementation modules (not generated artifacts under `lib/`).

### What the mass is (evidence-based)

- **Real code / domain logic:** Typed modules with imports from `@/lib/...`, `@/lib/cms/...`, Supabase, etc.; wired from **tracked** `app/api/**`, `app/superadmin/**`, backoffice components (e.g. social calendar, sales cockpit, revenue routes).
- **Not a parallel `@/` tree:** `src/lib` is negligible; the parallel risk is **missing git objects** for root `lib/**`, not a second alias target.
- **Not “noise”:** Volume + import graph indicate **production-adjacent** implementation, including growth/sales/autonomy/ML naming (whether or not every route is RC-scoped is a **product** decision — not a reason to call the tree støy).
- **Unclear without graph closure:** At least **`lib/repo/query.ts`** appears **unused** by `@/lib/repo/*` imports in this audit’s `*.{ts,tsx}` ripgrep scan (see disposition below).

---

## Binding decisions (thematic underbøtter)

Outcomes: **KEEP** | **IGNORE** | **DELETE** | **HOLD OUTSIDE BASELINE NOW**

Each row lists **exact top-level directories** included (hyphenated names spelled as on disk, e.g. `self-healing`).

| # | Underbøtte (paths) | Decision | Why | Blocks baseline? | Next package MAY | Next package MUST NOT |
|---|-------------------|----------|-----|------------------|------------------|------------------------|
| 1 | **`lib/core/**`** | **KEEP** | Sole implementation of shared API/runtime helpers (`structuredLog`, `trace`, `featureFlags`, `tenantGuard`, `withCache`, …) with **broad** imports from tracked routes/libs. | **Yes** — revision hole in the hottest layer. | `git add lib/core/**`; verify no duplicate `lib/http` overlap unintentionally. | Treat as optional; delete without import graph. |
| 2 | **`lib/platform-transport/**`** — `infra`, `server`, `localRuntime`, `edge`, `runtime`, `distributed`, `eventBus`, `queue`, `cache` | **KEEP** | Concurrency, server adapters, edge hooks, queues, caching, pub/sub — **cross-cutting** infrastructure consumed from APIs and other `lib` modules. | **Yes** until committed. | Stage/commit; document ownership vs `lib/http` (tracked). | Assume redundant without diffing call sites. |
| 3 | **`lib/integrations-customer/**`** — `integrations`, `onboarding`, `crm`, `partners` | **KEEP** | HubSpot-style integrations, onboarding helpers, CRM/partner glue — **referenced** from tracked app surfaces. | **Yes** until committed. | Commit; optional security review for third-party keys usage. | Mark IGNORE as “local”. |
| 4 | **`lib/demand-generation-engine/**`** — `social`, `sales`, `growth`, `revenue`, `ads`, `outbound`, `gtm`, `moo`, `pipeline`, `salesAutonomy`, `sdr`, `acquire`, `leads`, `campaign` | **KEEP** | Large, coherent **go-to-market** implementation (social engine, sales sequences, growth loops, revenue attribution, ads) with **dense** imports from superadmin, cron routes, backoffice, orders. | **Yes** until committed. | Slice commits by domain if needed; align with RC commercial scope separately. | DELETE as “bloat” without explicit product/archival decision. |
| 5 | **`lib/autonomous-operations/**`** — `autonomy`, `autopilot`, `ml`, `selfheal`, `self-healing`, `evolution`, `agents`, `ceo`, `cto`, `neural`, `rl`, `predictive`, `forecast` | **KEEP** | Autonomous runners, ML-ish pipelines, CEO/CTO orchestration, neural/RL helpers — **imported** from cron/API and other libs (e.g. autonomy → neural). | **Yes** until committed. | Commit; later: RC scope gate per route if needed. | Conflate with “experiment” and IGNORE. |
| 6 | **`lib/product-and-economics/**`** — `experiment`, `experiments`, `mvo`, `product`, `pricing`, `procurement`, `pos`, `engine`, `controlTower`, `settings` | **KEEP** | Experiments/MVO/POS/pricing/procurement/**control-tower** economics — wired into superadmin, APIs, and tests. | **Yes** until committed. | Commit; separate policy for which **routes** stay RC. | Assume duplicate of `lib/cms` without reading imports. |
| 7 | **`lib/strategy-simulation-meta/**`** — `strategy`, `finance`, `business`, `market`, `scale`, `global`, `monopoly`, `domination`, `exit`, `investor`, `board`, `pitch`, `ipo`, `simulation`, `chaos`, `golive`, `repo-intelligence` | **KEEP** | Strategy/finance/investor surfaces, simulation + chaos **routes**, system-graph builder types — **used** from superadmin control tower / API (e.g. `simulation`, `chaos`, `repo-intelligence`). | **Yes** until committed. | Commit; chaos/simulation may deserve env gating later (separate package). | DELETE chaos/sim as “test junk” without route audit. |
| 8 | **`lib/security-compliance-telemetry/**`** — `security`, `compliance`, `monitoring`, `alerts`, `analytics`, `metrics`, `sre` | **KEEP** | Guards, compliance hooks, monitoring metrics/alerts — consumed from libs and APIs. | **Yes** until committed. | Commit. | IGNORE. |
| 9 | **`lib/presentation-and-remaining/**`** — all **other** untracked top-level segments **not** listed in rows 1–8 (e.g. `content`, `layout`, `video`, `hooks`, `ui`, `data`, `demo`, `saas`, `tenant`, `learning`, `invites`, `personalization`, `recovery`, `execution`, `workflow`, `approval`, `driver`, `domain`, `network`, `platform`, `enterprise`, `live`, `menu`, `automation`, `attribution`, `pilot`, `i18n`, `errors`, `types`, `utils`, `validation`, and other ≤5-file leaves) | **KEEP** | Residual **single-purpose** modules still part of the same import graph (UI hooks, content helpers, demo/saas stubs, small domain utils). | **Yes** until committed. | Commit in one or more batches; run unused-export analysis **after** tree is tracked. | Blanket DELETE small folders without import proof. |
| — | **`lib/repo/**`** (currently `query.ts` only) | **HOLD OUTSIDE BASELINE NOW** | Implements JSON query over `repo-intelligence/` on disk; **no** `@/lib/repo` import hits in this audit’s `*.{ts,tsx}` search — **orphan risk** vs **intentional CLI**. | **Weak** — small file count; **integrity** risk if deleted wrongly. | Prove unused (knip/ts-prune/CI) then **DELETE** or wire into a supported entry; or **KEEP** if productized. | **DELETE** in the same breath as “no grep hits” without a second verifier. |

**`IGNORE` / `DELETE`:** None for the bulk tree in this package — no evidence of generated cache dirs or safe-delete orphans at **folder** level except the **caveat** on `lib/repo/**`.

---

## Remaining blockers (after this disposition)

1. **Execution gap:** 939 files still **untracked** until `git add` / commits land.  
2. **Prior packages unchanged:** `docs/**` (KEEP, uncommitted), `artifacts/**` (HOLD), `supabase/migrations/**` (HOLD), large **tracked** dirty diff.  
3. **`lib/repo/**`:** Explicit **HOLD** until closed by proof or adoption.

---

## Baseline status (single)

**BASELINE ER BEDRE, MEN FORTSATT BLOKKERT**

**Reason:** Tooling gates pass, but **git still omits** most of `lib/**` that the bundle imports — baseline **cannot** be called revision-honest. Decisions only **classify**; they do not **record** history.

---

## Exactly one next package

**Name:** `apply lib disposition`  

**Why:** Every substantive underbøtte is **KEEP**; the honest follow-through is **version-control inclusion** (sliced commits, explicit handling of `lib/repo/**` per HOLD row).  

**What it closes:** Removes the **939-file** untracked hole in `lib/**` (except the deliberately held `lib/repo/**` until resolved).

---

## Sluttdom

Per nå er **untracked `lib/**` i hovedsak produksjons-/API-koblede TypeScript-moduler som skal inn som repo-sannhet (KEEP på tematiske underbøtter), med **eksplisitt unntak `lib/repo/**` → HOLD** til avklaring. Neste ærlige steg er **`apply lib disposition`** (staging/commit av KEEP-massen + lukke HOLD på `lib/repo/**` med bevis eller sletting).
