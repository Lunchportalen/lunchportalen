# AUDIT_MASTER — Forensic repository audit + Umbraco AI CMS gap analysis

**Run date:** 2026-04-05  
**Mode:** Read-only (no application code edits; audit artifacts added under `audit/forensic-2026-04-05/`).  
**Authoritative stack statement:** `AGENTS.md` — Next.js App Router · Supabase · Sanity.

---

## 1. Executive summary

- **What this repo is:** A large **Next.js 15** application (`package.json`: `next@15.5.10`) with **Supabase**, **Sanity client/studio**, extensive **`app/api`** surface, custom **backoffice** under `app/(backoffice)/backoffice/**`, and a substantial **`lib/ai`** ecosystem plus **`openai`** dependency.
- **What it is not:** An **Umbraco** repository. There are **zero** `.csproj`, `.sln`, or `.cs` files. **Umbraco is not the CMS core** here.
- **“Umbraco” in the tree:** Appears primarily as **parity / target-state documentation** (`docs/umbraco-parity/**`, `docs/repo-audit/U00R2_*.md`) and **comments** (e.g. `treeTypes.ts` “Umbraco 13 parity”), not as the Umbraco product runtime.
- **AI posture:** **AI-adjacent to a custom CMS**, not “Umbraco AI CMS” in the vendor sense. Real endpoints exist under `app/api/backoffice/ai/**` (31 `route.ts` files in that folder) and broader `app/api/ai/**`. **No** Umbraco.AI and **no** MCP package references found in a TS/JSON/MD/YML search for `modelcontextprotocol` / `@modelcontextprotocol`.
- **Brutal verdict on “100% Umbraco AI CMS”:** **Does not apply.** Fails hard gates **#1 Umbraco core**, **#21–22 Delivery/Media API (product)**, **#25 Management API (product)**, **#34 Umbraco.AI**, **#47 MCP (Umbraco Developer MCP)** per the scorecard in `UMBRACO_AI_CMS_SCORECARD.md`.

---

## 2. Coverage proof

| Item | Value |
|------|------:|
| Directories enumerated (excl. `node_modules`, `.git`, `.next`, `out`, `dist`, `coverage`, `.turbo`) | **1440** |
| Files enumerated (same exclusions) | **5713** |
| `node_modules` files (when present) | **~40104** (folder-level summary only) |
| `app/api/**/route.ts` | **569** |

**How coverage was obtained:** PowerShell recursion + CSV export (`AUDIT_FILE_LEDGER.csv`, `AUDIT_DIRECTORY_LEDGER.csv`). **Not** full-text read of every file — see `AUDIT_COVERAGE.md` for read-status policy and ledger correction log.

**Extension histogram (top):** `.ts` 3115, `.md` 1243, `.tsx` 761, `.sql` 160, `.json` 128 (from imported CSV).

---

## 3. Repository topology (high level)

| Area | Role |
|------|------|
| `app/` | Next.js App Router — public, admin, superadmin, backoffice, API routes |
| `app/api/` | HTTP surface (569 `route.ts`) — dominant integration plane |
| `lib/` | Domain logic — `lib/cms`, `lib/ai`, `lib/auth`, `lib/audit`, etc. |
| `components/` | Shared UI |
| `supabase/migrations/` | Postgres schema / migrations |
| `studio/` | Sanity studio configuration |
| `tests/` | Vitest tests; Playwright config present |
| `.github/workflows/` | CI pipelines |
| `docs/` | Large normative + parity + audit corpus (`docs/umbraco-parity`, `docs/audit`) |
| `scripts/` | Build/audit/guard scripts (`audit-repo.mjs`, `sanity-live.mjs`, etc.) |
| `public/` | Static assets / brand |

**Boundary note:** CMS concerns are **spread** across Postgres JSON content, TS contracts, backoffice UI, and Sanity — documented as both strength and risk in `docs/audit/full-system/UMBRACO_GAP_REPORT.md`.

---

## 4. File ledger summary

- **Machine-readable full list:** `AUDIT_FILE_LEDGER.csv` (5713 rows at generation time).
- **Binary heuristic:** extension-based flag only; not MIME sniffing.
- **Largest classes:** TypeScript + Markdown dominate; SQL migrations are a significant corpus.

---

## 5. Actual runtime architecture (evidence-based)

**Entrypoints**

- Next.js **`app/`** layouts and pages.
- **API:** `app/api/**/route.ts` handlers.
- **Workers:** `workers/worker.ts` referenced from `package.json` script `worker:queue`.
- **Middleware:** `middleware.ts` at repo root (not deep-read in this pass).

**CMS data plane (non-Umbraco)**

- Supabase migrations under `supabase/migrations/` (160+ `.sql` files in histogram).
- CMS helpers under `lib/cms/**`.
- Content API examples: `app/api/backoffice/content/**`, `app/api/content/global/**`.

**AI plane**

- Backoffice AI: `app/api/backoffice/ai/**/*.ts` (31 routes in folder).
- Additional AI routes: `app/api/ai/**`, cron/autonomy-related routes, `lib/ai/**` modules.

**Sanity**

- `@sanity/client` dependency; `studio/sanity.config.ts`, `studio/lunchportalen-studio/sanity.config.ts`.

---

## 6. Umbraco core assessment

| Question | Answer | Evidence |
|----------|--------|----------|
| Umbraco installed? | **No** | No `.csproj` / Umbraco packages |
| .NET host? | **No** | No C# project files |
| Backoffice? | **Custom Next.js** | `app/(backoffice)/backoffice/**` |
| Content model? | **Code + DB JSON** | `lib/cms/contentDocumentTypes.ts` (single `page` type) |
| Delivery API (product)? | **No** | Public Next routes + helpers |
| Management API (product)? | **No** | Custom JSON APIs |
| Extensions? | **Custom React/registry** | `docs/repo-audit/U00R2_BELLISSIMA_EXTENSION_TYPE_MATRIX.md` |

---

## 7. AI assessment

**What AI is here**

- OpenAI-capable server routes and utilities (`openai` dependency; capability route checks `OPENAI_API_KEY`).
- Rich endpoint set for text, layout, SEO, images, jobs, suggestions, etc. under `app/api/backoffice/ai/**`.
- Supporting governance UI/docs (e.g. `components/backoffice/AiGovernanceSettingsPanel.tsx`, `docs/umbraco-parity/U17_AI_GOVERNANCE_AND_POSTURE.md`).
- Audit/logging artifacts (`lib/audit/aiActivityAudit.ts`, SQL migrations naming `ai_activity_log`).

**What AI is not**

- **Not** Umbraco.AI integrated into Umbraco backoffice.
- **Not** proven (in this pass) to be exclusively gated on every route without further route-by-route review.
- **Not** MCP-driven Umbraco operations — **no** MCP references found in repo text search scope described in scorecard.

**“AI theatre” candidates (needs deeper pass)**

- Any UI that calls AI endpoints but lacks persistence or publish linkage — **not enumerated file-by-file here** (flagged as `NEEDS_VERIFICATION` in scorecard rows).

---

## 8. 100% Umbraco AI CMS gap matrix

See **`UMBRACO_AI_CMS_SCORECARD.md`** (56 capabilities, evidence pointers).

---

## 9. Folder structure audit

**Strengths**

- Clear separation of `app/api` vs `app/(public)` vs role areas.
- Extensive internal documentation under `docs/`.

**Weaknesses / confusion (cited)**

- Editorial UX monolith risk called out in `docs/audit/full-system/UMBRACO_GAP_REPORT.md` (historical line count on `ContentWorkspace.tsx`).
- Parallel “audit” namespaces (`docs/audit`, `lib/audit`, API audit routes) — legitimate but requires navigation discipline.

**Legacy gravity**

- Large `lib/ai` surface + many cron/API routes → operational complexity.

---

## 10. File and module audit (hotspots)

- **API hotspot:** 569 `route.ts` under `app/api`.
- **CMS model hotspot:** `lib/cms/**`, `app/(backoffice)/backoffice/content/**`.
- **AI hotspot:** `app/api/backoffice/ai/**`, `lib/ai/**`.
- **Existing deep audits to reuse:** `docs/audit/full-system/*`, `docs/repo-audit/U00R2_*`, `docs/umbraco-parity/*`.

---

## 11. Governance / security / workflow audit (summary)

- **Enterprise rules:** `AGENTS.md` defines API contracts, auth truth, frozen flows — **normative** for this product, not for Umbraco.
- **Umbraco-native governance:** **Absent** (users/groups/history as Umbraco features).
- **MCP scope:** **Not applicable** — no MCP implementation found in repo search.

---

## 12. Delivery / preview / API audit

- **Delivery:** Custom public rendering — partial analogue only (`docs/umbraco-parity/U30X_READ_R3_MANAGEMENT_VS_DELIVERY_PROOF.md`).
- **Preview:** Tests exist; gaps documented in `UMBRACO_GAP_REPORT.md`.

---

## 13. AI maturity verdict (against Umbraco AI CMS definition)

**Classification:** **AI-ADJACENT CUSTOM CMS** on Next/Supabase/Sanity — **not** `PARTIAL UMBRACO AI CMS` because Umbraco is absent.

If comparing only to “generic AI CMS” (vendor-agnostic): **PARTIAL / STRONG in endpoint breadth**, **UNCERTAIN in uniform governance** without per-route proof.

---

## 14. Contradictions and structural lies

| Claim risk | Reality | Evidence |
|------------|---------|----------|
| Calling the repo “Umbraco CMS” | **Misleading** | No Umbraco host |
| “100% Umbraco parity” | **False** if read literally | `UMBRACO_PARITY_OPEN_RISKS.md`, replatforming gap docs |
| Docs promising parity without code | Some docs flagged superseded/misleading | `docs/repo-audit/U00R2_DOCS_TRUST_AND_DELETE_CANDIDATES.md` |

---

## 15. Top findings (ranked, ≤50 — condensed)

1. **CRITICAL — Wrong product for literal Umbraco claim:** No `.csproj` / Umbraco (identity).
2. **CRITICAL — “100% Umbraco AI CMS” impossible without replatforming:** Scorecard row 56.
3. **HIGH — Management/Delivery APIs are app routes, not Umbraco products:** `U30X_READ_R3_MANAGEMENT_VS_DELIVERY_PROOF.md`.
4. **HIGH — Document type system minimal:** `contentDocumentTypes.ts` single `page`.
5. **HIGH — API surface enormous:** 569 `route.ts` → review/governance load.
6. **HIGH — `lib/ai` breadth:** prior audit notes ~295 files (see `UMBRACO_GAP_REPORT.md`).
7. **MEDIUM — Preview trust / test typing gaps:** `UMBRACO_GAP_REPORT.md` + `publicPreviewParity.test.ts` notes.
8. **MEDIUM — Media `<img>` vs Next `<Image>` warnings:** cited in `UMBRACO_GAP_REPORT.md`.
9. **MEDIUM — Duplicate/stray route copies risk:** example in `UMBRACO_GAP_REPORT.md` (superadmin repairs path).
10. **MEDIUM — Multi-store truth (Sanity + Postgres):** operational complexity.
11. **LOW — Naming “Umbraco parity” in TS comments:** cognitive hazard for new contributors.
12. **ARCHITECTURAL — Shadow Umbraco concepts:** Bellissima matrix shows partial/shadow mappings.
13. **HIGH — `ContentWorkspace.tsx` monolith (~6k+ LOC):** `docs/audit/full-system/REMAINING_TOP_10.md` row 1.
14. **MEDIUM — ESLint `exhaustive-deps` / `no-img-element` in CMS:** `REMAINING_TOP_10.md` row 2.
15. **HIGH — API surface count drift:** prior doc **324** `route.ts` vs this run **569** under `app/api` — recount methodology differs (`git ls-files` vs filesystem glob); treat as **large either way**.
16. **HIGH — `lib/ai` subtree size:** Glob `lib/ai/**` this run → **702** paths; `REMAINING_TOP_10.md` cites **295** via `git ls-files` — discrepancy likely from **command scope** (track only vs all files); treat as **large** in either case.
17. **HIGH (conditional) — `global_content` RLS breadth:** `REMAINING_TOP_10.md` row 5, migration `20260421000000_global_content.sql`.
18. **MEDIUM — JSONB / defaults without full runtime schema:** `REMAINING_TOP_10.md` row 6.
19. **MEDIUM — Build / `.next` fragility on Windows:** `REMAINING_TOP_10.md` row 7.
20. **MEDIUM — E2E not executed in this audit:** `REMAINING_TOP_10.md` row 8.
21. **LOW–MEDIUM — `@ts-nocheck` in some CMS tests:** `REMAINING_TOP_10.md` row 9.
22. **LOW — `/api/something` demo route:** `app/api/something/route.ts`, `REMAINING_TOP_10.md` row 10.
23. **MEDIUM — `enforceBlockComponentSafety` mutates data in place:** `UMBRACO_GAP_REPORT.md` §3.
24. **MEDIUM — `any` in `app/api/something` helpers cited:** `UMBRACO_GAP_REPORT.md` §5.
25. **MEDIUM — Stale media ref testing exists (strength) but img usage gaps:** `UMBRACO_GAP_REPORT.md` §6.
26. **HIGH — Role/tenant model is app-specific, not Umbraco groups:** Implies **re-learning cost** for Umbraco-native admins.
27. **MEDIUM — Cron / autonomy route proliferation:** Many `app/api/cron/**` routes increase ops review surface (inventory via glob).
28. **MEDIUM — Stripe webhook present:** `app/api/saas/billing/webhook/route.ts` — third-party event boundary.
29. **LOW — ONNX runtime dependency:** `onnxruntime-node` in `package.json` — native binary / deploy implications.
30. **MEDIUM — Redis client dependency:** `redis` in `package.json` — infra coupling.
31. **ARCHITECTURAL — Docs trust matrix flags misleading parity doc:** `docs/repo-audit/U00R2_DOCS_TRUST_AND_DELETE_CANDIDATES.md`.
32. **MEDIUM — Entity bulk actions absent vs Umbraco:** `U00R2_BELLISSIMA_EXTENSION_TYPE_MATRIX.md`.
33. **MEDIUM — No formal OpenAPI for 569 handlers:** integration discipline gap (inference).
34. **LOW — Multiple `sanity.config.ts` paths:** `studio/sanity.config.ts` + `studio/lunchportalen-studio/sanity.config.ts` — clarify canonical studio.
35. **MEDIUM — AI governance docs vs runtime proof gap:** Governance panels/docs exist; uniform enforcement **not proven** in this pass.
36. **HIGH — Literal “Umbraco AI CMS” marketing/legal risk:** Identity mismatch vs stack (`AGENTS.md`).
37. **MEDIUM — `auth/dev-bypass` route exists:** `app/api/auth/dev-bypass/route.ts` — verify env gating in deploy contexts (not executed here).
38. **LOW — Playwright snapshots / visual debt:** e2e folder present; maintenance cost.
39. **MEDIUM — Supabase migration volume (160+ `.sql`):** migration-order / drift risk class.
40. **ARCHITECTURAL — Parallel “audit” namespaces:** `docs/audit`, `lib/audit`, UI audit pages — navigation complexity.
41. **MEDIUM — Public slug router centralization:** `app/(public)/[slug]/page.tsx` — single choke point (also a control point).
42. **LOW — Brand/logo rules locked in `AGENTS.md`:** not Umbraco-related but production constraint surface.
43. **MEDIUM — `workers/worker.ts` queue path:** separate runtime from Next — deploy matrix complexity.
44. **MEDIUM — Large markdown corpus (1243 `.md`):** docs drift risk without single index.
45. **LOW — `.log` files in repo (18):** should confirm if tracked or local noise per `.gitignore` (histogram only).
46. **MEDIUM — AI activity SQL migrations:** evidence of logging ambition; completeness vs all AI routes unproven here.
47. **HIGH — No Umbraco Management API → no AI tool operating on Umbraco nodes:** structural.
48. **MEDIUM — Preview parity test history:** improvements noted in `REMAINING_TOP_10.md` “ikke lenger” section — still partial trust.
49. **ARCHITECTURAL — “Parity” language in code comments:** e.g. `treeTypes.ts` — risks overstating product identity.
50. **CRITICAL — Reconciliation:** This list mixes **fresh** counts with **prior** audit rows; re-validate any count before contractual use.

Further historical findings: `docs/audit/FULL_REPO_AUDIT_V2.md`, `docs/audit/full-system/WHOLE_REPO_AUDIT_REPORT.md`.

---

## 16. What is missing to reach 100%

See **`UMBRACO_AI_CMS_GAPS.md`** (grouped checklist).

---

## 17. Immediate actions

**If the business goal is literal Umbraco**

1. Stand up **separate** Umbraco .NET solution; define target Umbraco major version.
2. Design **content migration** from Postgres JSON / Sanity → Umbraco content/media.
3. Replace or proxy **delivery** via Umbraco Delivery API or front-end integration pattern.
4. Implement **Umbraco-native governance** or explicitly accept deltas.

**If the business goal is stay on Next/Supabase**

1. Stop using **“100% Umbraco”** externally; use **“Umbraco-inspired / parity-tracked”** language consistent with internal docs.
2. Continue closing gaps listed in `docs/umbraco-parity/*` and `U00R2_*` matrices.

**Do not touch first (without explicit charter)**

- Frozen flows listed in `AGENTS.md` (superadmin companies, onboarding phone rules, canonical header, etc.).

---

## 18. Final verdict

This repository is a **serious, large-scale Next.js product** with **real AI endpoints** and **documented Umbraco parity thinking**. It is **not** an Umbraco application, **not** an “Umbraco AI CMS” in the vendor/product sense, and **cannot** be certified as **“100% Umbraco AI CMS”** under the audit brief without **replatforming** or **changing the definition** of that phrase.

---

# Appendices (index)

| ID | Name | Location |
|----|------|----------|
| A | Directory ledger | `AUDIT_DIRECTORY_LEDGER.csv` |
| B | File ledger | `AUDIT_FILE_LEDGER.csv` |
| C | Package / dependency inventory | `package.json` + `package-lock.json` (not reprinted) |
| D | Umbraco package inventory | **Empty** — no NuGet/Umbraco |
| E | AI / MCP inventory | `app/api/backoffice/ai/**`, `app/api/ai/**`, `lib/ai/**`; MCP **not found** |
| F | Config surface | `.env.example`, `next.config.*`, `tailwind.config.cjs`, CI workflows under `.github/workflows/` |
| G | API / route inventory | **569** `app/api/**/route.ts` |
| H | Backoffice extension inventory | Custom under `app/(backoffice)/backoffice/**`, `components/backoffice/**`; see `U00R2_BELLISSIMA_EXTENSION_TYPE_MATRIX.md` |
| I | Workflow / permission / auth | `AGENTS.md`, `lib/http/routeGuard.ts`, `app/api/auth/**` (pointer-level only) |
| J | Dead code / stubs | `scripts/audit-repo.mjs` encodes some checks; prior reports under `docs/audit/ORPHAN_AND_DEAD_CODE_REPORT.md` |
| K | Version / upgrade risk | Umbraco N/A; Next 15 / React 19 — follow upstream advisories |
| L | Missing for 100% checklist | `UMBRACO_AI_CMS_GAPS.md` |
