# UMBRACO_AI_CMS_SCORECARD — Lunchportalen repo

**Standard:** User-defined “100% Umbraco AI CMS” (Umbraco as CMS core + governance + delivery/management APIs + AI inside CMS workflow + MCP optional).

**Platform fact:** This repository is **Next.js App Router + Supabase + Sanity** per `AGENTS.md` and `package.json`. **Umbraco is not installed** (no `.csproj` / `.cs` / Umbraco packages).

**Legend — Status:** PRESENT | PARTIAL | ABSENT | VERSION_BLOCKED | MISWIRED | SHADOW_IMPLEMENTATION  
**M:** Maturity 0–5 | **Conf:** CONFIRMED | STRONG_INFERENCE | NEEDS_VERIFICATION

| # | Capability | Status | M | Conf | Evidence (files / search) |
|---|------------|--------|---|------|---------------------------|
| 01 | Umbraco core identity | **ABSENT** | 0 | CONFIRMED | Zero `.csproj`/`.cs`; `AGENTS.md` stack line 6 |
| 02 | Umbraco version suitability | **VERSION_BLOCKED** | 0 | CONFIRMED | N/A — product not present |
| 03 | Backoffice presence (Umbraco) | **ABSENT** | 0 | CONFIRMED | Custom `app/(backoffice)/backoffice/**` — not Umbraco backoffice |
| 04 | Document types / content model (Umbraco) | **ABSENT** | 0 | CONFIRMED | `lib/cms/contentDocumentTypes.ts` — code registry; single `page` type |
| 05 | Data types / property editors (Umbraco) | **SHADOW_IMPLEMENTATION** | 2 | STRONG_INFERENCE | TS schema + `SchemaDrivenBlockForm.tsx` — not Umbraco data types |
| 06 | Templates / rendering (Umbraco MVC) | **ABSENT** | 0 | CONFIRMED | Next.js `app/(public)/**` rendering |
| 07 | Block editor strategy | **PARTIAL** | 3 | STRONG_INFERENCE | Backoffice content workspace + block contracts; not Umbraco Block Grid/List product |
| 08 | Rich text extension strategy | **PARTIAL** | 2 | NEEDS_VERIFICATION | Editor stack in `app/(backoffice)/backoffice/content/**` — map to RTE in dedicated pass |
| 09 | Media architecture | **PARTIAL** | 3 | STRONG_INFERENCE | `app/api/backoffice/media/**`; tests e.g. stale refs — not Umbraco Media service |
| 10 | Multilingual / variants | **PARTIAL** | 2 | STRONG_INFERENCE | CMS docs claim variants; Umbraco variant system **ABSENT** |
| 11 | Dictionary / localization | **PARTIAL** | 2 | NEEDS_VERIFICATION | App i18n/Norwegian copy discipline — not Umbraco dictionary |
| 12 | Members / auth boundary | **PARTIAL** | 4 | STRONG_INFERENCE | Supabase/auth model — not Umbraco Members |
| 13 | Backoffice users / groups (Umbraco) | **ABSENT** | 0 | CONFIRMED | App role model — not Umbraco Users/Groups |
| 14 | Granular permissions (Umbraco node-level) | **SHADOW_IMPLEMENTATION** | 2 | STRONG_INFERENCE | Route guards + company scope — different semantics than Umbraco permissions |
| 15 | External login / SSO | **PARTIAL** | 2 | NEEDS_VERIFICATION | Not audited deeply here; not Umbraco external login |
| 16 | Workflow / approvals (Umbraco Workflow product) | **ABSENT** | 0 | CONFIRMED | `app/api/backoffice/content/pages/[id]/workflow/route.ts` exists — **app workflow**, not Umbraco Workflow |
| 17 | Audit trail / history (Umbraco-native) | **ABSENT** | 0 | CONFIRMED | `lib/audit/**`, `docs/audit/**` — custom audit, not Umbraco history DB |
| 18 | Versioning / rollback / cleanup (Umbraco) | **PARTIAL** | 2 | STRONG_INFERENCE | App/page versioning routes exist — not Umbraco version engine |
| 19 | Notifications (Umbraco) | **PARTIAL** | 2 | NEEDS_VERIFICATION | Email/app notifications — not Umbraco notifications |
| 20 | Webhooks / events (Umbraco) | **PARTIAL** | 2 | STRONG_INFERENCE | e.g. `app/api/saas/billing/webhook/route.ts` — not Umbraco webhook surface |
| 21 | Content Delivery API (Umbraco product) | **ABSENT** | 0 | CONFIRMED | `lib/cms/public/**`, `app/(public)/[slug]/page.tsx` — **SHADOW** delivery |
| 22 | Media Delivery API (Umbraco product) | **ABSENT** | 0 | CONFIRMED | App media routes |
| 23 | Preview support | **PARTIAL** | 3 | STRONG_INFERENCE | `tests/cms/publicPreviewParity.test.ts`; gaps noted in `docs/audit/full-system/UMBRACO_GAP_REPORT.md` |
| 24 | Protected content strategy | **PARTIAL** | 3 | STRONG_INFERENCE | Auth + RLS patterns — not Umbraco protected content |
| 25 | Management API usage (Umbraco) | **ABSENT** | 0 | CONFIRMED | `app/api/backoffice/**` — conceptual analogue only (`docs/umbraco-parity/U30X_READ_R3_MANAGEMENT_VS_DELIVERY_PROOF.md`) |
| 26 | OpenAPI / Swagger discipline (Umbraco-style) | **ABSENT** | 0 | STRONG_INFERENCE | No first-class OpenAPI artifact indexed here |
| 27 | Models Builder / strong typing | **ABSENT** | 0 | CONFIRMED | TypeScript + Zod — not Umbraco Models Builder |
| 28 | Backoffice extensions (Umbraco manifest runtime) | **SHADOW_IMPLEMENTATION** | 3 | STRONG_INFERENCE | `docs/repo-audit/U00R2_BELLISSIMA_EXTENSION_TYPE_MATRIX.md` |
| 29 | Dashboards | **PARTIAL** | 3 | STRONG_INFERENCE | Multiple dashboards — not Umbraco dashboard package |
| 30 | Custom sections | **PARTIAL** | 3 | STRONG_INFERENCE | Backoffice IA — not Umbraco sections |
| 31 | Content apps | **PARTIAL** | 2 | STRONG_INFERENCE | Panel model — see parity docs |
| 32 | Workspaces | **PARTIAL** | 3 | STRONG_INFERENCE | Content workspace shell — custom |
| 33 | Custom property editors | **PARTIAL** | 3 | STRONG_INFERENCE | Schema-driven forms — not Umbraco property editors |
| 34 | AI foundation package (Umbraco.AI) | **ABSENT** | 0 | CONFIRMED | No Umbraco.AI dependency |
| 35 | AI provider strategy | **PARTIAL** | 3 | CONFIRMED | `openai` in `package.json`; `OPENAI_API_KEY` checks in `app/api/backoffice/ai/capability/route.ts` |
| 36 | AI config / secrets handling | **PARTIAL** | 3 | STRONG_INFERENCE | Env-based keys; `scripts/check-ai-internal-provider.mjs` in CI |
| 37 | AI prompt / policy / governance | **PARTIAL** | 3 | STRONG_INFERENCE | `docs/umbraco-parity/U17_AI_GOVERNANCE_AND_POSTURE.md`, `components/backoffice/AiGovernanceSettingsPanel.tsx` |
| 38 | AI editor features | **PARTIAL** | 4 | STRONG_INFERENCE | **31** routes under `app/api/backoffice/ai/**` (glob) |
| 39 | AI media assistance | **PARTIAL** | 3 | STRONG_INFERENCE | `image-metadata`, `image-generator` routes |
| 40 | AI translation / localization | **PARTIAL** | 1 | NEEDS_VERIFICATION | Not mapped file-by-file in this pass |
| 41 | AI SEO / metadata | **PARTIAL** | 3 | STRONG_INFERENCE | `seo-intelligence`, `page-intelligence` routes |
| 42 | AI structured enrichment | **PARTIAL** | 3 | STRONG_INFERENCE | Block/page builder AI routes |
| 43 | AI automation / jobs / flows | **PARTIAL** | 3 | STRONG_INFERENCE | `app/api/backoffice/ai/jobs/**`, multiple `cron/*` routes |
| 44 | AI logging / traceability | **PARTIAL** | 3 | STRONG_INFERENCE | `lib/audit/aiActivityAudit.ts`, migrations `ai_activity_log*` |
| 45 | Human approval over AI output | **PARTIAL** | 2 | NEEDS_VERIFICATION | Workflow/publish gates exist in app — not proven end-to-end here |
| 46 | AI permission boundary | **PARTIAL** | 3 | STRONG_INFERENCE | Backoffice routes imply role gating — needs route-by-route proof |
| 47 | MCP integration (Umbraco Developer MCP) | **ABSENT** | 0 | CONFIRMED | Ripgrep `modelcontextprotocol` / `@modelcontextprotocol` in `*.{ts,tsx,js,json,md,yml}`: **no matches** |
| 48 | MCP security / tool filtering | **ABSENT** | 0 | CONFIRMED | No MCP server code located |
| 49 | Cursor readiness | **PARTIAL** | N/A | STRONG_INFERENCE | `.cursor` / mcps may exist in developer environment — **not** product Umbraco MCP |
| 50 | CI / tests / deploy protection | **PARTIAL** | 4 | CONFIRMED | `build:enterprise`, `ci:platform-guards`, Vitest, Playwright in `package.json` |
| 51 | Production observability | **PARTIAL** | 2 | NEEDS_VERIFICATION | Health routes; not fully audited |
| 52 | Content quality controls | **PARTIAL** | 3 | STRONG_INFERENCE | CMS integrity scripts/tests referenced in npm scripts |
| 53 | Structural cleanliness (long-term CMS) | **PARTIAL** | 2 | STRONG_INFERENCE | `UMBRACO_GAP_REPORT.md` flags monolith/workspace risk |
| 54 | Upgrade readiness (Umbraco) | **ABSENT** | 0 | CONFIRMED | Wrong stack for Umbraco upgrades |
| 55 | Legacy drag / migration debt | **PARTIAL** | 3 | STRONG_INFERENCE | Sanity + Postgres content + large `lib/ai` surface |
| 56 | Final “100% Umbraco AI CMS” | **ABSENT** | 0 | CONFIRMED | Fails #01–03, #21–22, #25, #34, #47 by hard absence |

**Verdict against stated “100%” definition:** The solution is a **custom AI-assisted CMS layer on Next/Supabase/Sanity**, **not** an Umbraco-centric deployment. Parity documentation under `docs/umbraco-parity/**` explicitly documents **replatforming gaps**.
