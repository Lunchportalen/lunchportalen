# Cursor phased prompts — Lunchportalen V5

Use these prompts in order.

---

## Prompt 1 — Truth map, scan, dedupe, and implementation plan only

```txt
You are working inside the Lunchportalen repository.

IMPORTANT:
- Do NOT start by building new features.
- Do NOT create duplicate files, parallel systems, mock replacements, or dead code.
- Do NOT break login, registration, Supabase auth, onboarding, or Vercel deploy.
- Do NOT expose any secrets from .env.local. You may read env variable NAMES used by the app, but never print secret values.
- Do NOT remove working business-critical functionality.
- First scan the repo deeply and create a strict truth map before touching implementation.

MISSION
Turn this repository into a CMS-first enterprise Lunchportalen platform with:
- CMS as the central operating surface
- Supabase as core auth/data layer
- Sanity as content/menu layer where appropriate
- mobile-first employee ordering/cancel flows
- company admin finance + employees + invoices + locations
- superadmin full control
- kitchen production overview
- driver mobile delivery overview with delivered-status actions
- AI deeply integrated in CMS and operations
- no duplicate or unused systems
- seamless Vercel deployment

NON-NEGOTIABLE BUSINESS RULES
1. Lunchportalen is an enterprise SaaS lunch platform replacing canteens.
2. Minimum 20 employees per customer.
3. Binding period 12 months.
4. Termination notice 3 months before binding end.
5. Company admin must receive reminder before renewal/termination choice.
6. No-exception rule.
7. One platform = single source of truth.
8. Company registration starts as pending.
9. Superadmin approves before activation.
10. Company admin can then invite employees.
11. Employees are self-service only.
12. Cutoff is 08:00 and must be server-validated.
13. Company admin can manage employees, locations, finance, invoices, and customer-side administration, but must NOT be able to mutate superadmin-only core agreement powers unless explicitly allowed.
14. Superadmin can change/delete everything.
15. Kitchen sees production lists by date, company, location, employee, meal.
16. Driver sees today’s deliveries and can mark delivered from mobile.
17. Current week must disappear Friday 15:00 Europe/Oslo.
18. Next week must become visible Thursday 08:00 Europe/Oslo.
19. Overlap must exist from Thursday 08:00 to Friday 15:00 where both weeks are visible.
20. Billing is invoice-oriented and biweekly to company admin.
21. No Vipps/Klarna customer checkout in the target model.
22. CMS must become top-tier, on Umbraco/Avensia quality level or better, with AI as force multiplier.
23. Mobile performance for employees and drivers is critical.
24. Fail closed: no loose states, no permissive fallbacks.

KNOWN REPO REALITIES YOU MUST RESPECT
- The repo is a Next.js 15 monolith with Supabase/Postgres, Sanity, Stripe, large backoffice/CMS, large AI surface, many API routes, cron routes, and workers.
- The report identified that Friday is currently coded as 14:00 in week logic and weekPlan schema. This must be treated as a contradiction against the target rule of 15:00.
- The report identified that employee routing currently allows more than /week.
- The report identified two parallel week/menu truth candidates: Sanity weekPlan and order-window menu/agreement logic.
- The report identified worker stubs and strict:false in tsconfig.
- The repo must be scanned and consolidated before feature expansion.

FIRST TASK: CREATE A TRUTH-MAP PACKAGE
Before any code change, generate these files in a new docs/refactor/ directory:
1. docs/refactor/REPO_TRUTH_MAP.md
2. docs/refactor/DUPLICATE_AND_DEAD_CODE_REPORT.md
3. docs/refactor/ROLE_ACCESS_MATRIX.md
4. docs/refactor/WEEK_SINGLE_SOURCE_OF_TRUTH_DECISION.md
5. docs/refactor/CMS_GAP_PLAN.md
6. docs/refactor/DESIGN_SYSTEM_AUDIT.md
7. docs/refactor/PERFORMANCE_BASELINE_PLAN.md
8. docs/refactor/SOCIAL_SEO_ESG_SCOPE.md
9. docs/refactor/IMPLEMENTATION_SEQUENCE.md

YOUR SCAN MUST ANSWER THESE QUESTIONS WITH FILE REFERENCES
A. Auth and onboarding
- Which exact files control login, registration, post-login, middleware, and profile activation?
- Which routes must never break?
- Which env variables are required by auth and Supabase flows?

B. Roles and access
- What can superadmin, company_admin, employee, kitchen, and driver access today?
- Which routes and APIs violate the target access model?
- Which mutations must remain superadmin-only?

C. Week/order domain
- Which exact files compute visible weeks, cutoff, day models, menus, locks, and agreement gating?
- Is Sanity weekPlan authoritative, or is menu + agreement_json authoritative, or both?
- Recommend one authoritative model and mark the other as presentation-only or remove/merge target.

D. CMS core
- Map content tree, block system, preview, page rendering, workspace, autosave, media handling, design tokens, color system, typography, iconography, and component duplication.
- Identify the real weak points: content tree, media, workspace monolith, inconsistent design language, typography, color governance.

E. AI surface
- Identify which AI modules are real production-critical features versus experiments.
- Map AI in editor, AI page builder, AI SEO/CRO, AI design optimizer, AI content generation, AI operational helpers.
- Flag any AI features without persistence proof or governance.

F. Social publishing
- Find existing auto-post/social/calendar code.
- Determine what already exists for generated image/text/hashtags/calendar/scheduling/edit/delete/publish.
- The target is Lunchportalen-only posting, not multi-tenant agency posting.

G. SEO and search intelligence
- Find current SEO systems.
- Do NOT implement prohibited scraping. Base recommendations on approved integrations and existing data sources only.
- Map how the system can use Search Console, analytics, internal content performance, and approved keyword sources to dominate lunch-related SEO.

H. ESG / sustainability
- Find current ESG-related models, metrics, dashboards, or placeholders.
- Map how cancellation and waste reduction can become measurable ESG outputs.

I. Performance
- Identify the heaviest mobile journeys for employee ordering/cancel and driver delivery actions.
- Identify duplicated fetches, large bundles, over-rendering, slow APIs, weak caching, and opportunities for optimistic UI without violating correctness.

J. Vercel and deployment
- Map current Vercel constraints, build scripts, env dependencies, cron/scheduled jobs, and worker assumptions.
- Ensure any plan is deployable without breaking current production.

OUTPUT REQUIREMENTS FOR THE SCAN
- Be precise and brutal.
- Every claim must cite file paths.
- Clearly label: KEEP / REFACTOR / MERGE / REMOVE / DEPRECATE.
- Explicitly identify duplicate systems, duplicate components, dead files, and placeholder routes.
- End docs/refactor/IMPLEMENTATION_SEQUENCE.md with a phased plan: Phase 0, 1, 2, 3, 4.

AFTER THE SCAN
Stop and summarize in chat:
1. 20 biggest truths about the repo
2. 10 biggest contradictions to the target product
3. the single-source-of-truth decision for Week
4. the safest implementation order
Do NOT begin implementation yet.
```

---

## Prompt 2 — Controlled refactor and build into a CMS-first pro system

```txt
You are now allowed to refactor and build, but only according to the truth-map files in docs/refactor/.

NON-NEGOTIABLE RULES
- Preserve working login, registration, post-login redirects, pending onboarding, and Supabase auth.
- Keep Vercel deployable at all times.
- No duplicate systems.
- No unused files.
- No mock replacements if a real system already exists.
- Refactor in vertical slices with tests.
- If a feature already exists, improve/consolidate it instead of rebuilding it elsewhere.
- All changes must be reversible, typed, and production-minded.

PRIMARY PRODUCT GOAL
Create a seamless CMS-first Lunchportalen platform that feels premium, calm, fast, and trustworthy.
The CMS must be the main operating system for content, growth, AI, brand, and editorial control.
The operational lunch engine must be strict, fast, and fail-closed.
The whole system must feel coherent, not stitched together.

TARGET EXPERIENCE
1. Employee
- ultra-fast mobile-first Week experience
- order/cancel in very few taps
- clear cutoff feedback
- only sees what is relevant
- no admin clutter

2. Company admin
- dashboard for company, employees, locations, invoices, agreement visibility, reminders, cancellation/renewal timeline, finance overview
- can add/delete employees, manage company-side data, view invoices, export relevant data
- cannot bypass core agreement rules reserved for superadmin

3. Superadmin
- full control tower
- companies, agreements, approvals, billing control, operations, ESG, SEO/growth oversight, AI oversight, system health
- can edit/delete everything

4. Kitchen
- production view by date/company/location/employee/meal
- fast status workflows
- print/export friendly

5. Driver
- mobile-first delivery view
- today’s deliveries, route clarity, mark delivered quickly, resilient tap targets

6. CMS users
- world-class editing experience
- content tree
- media library
- page builder
- AI assistant
- preview identical to public render
- strong design system
- typography, spacing, color, motion, iconography all governed

PHASED IMPLEMENTATION ORDER

PHASE 1 — CORE TRUTH AND ACCESS HARDENING
Implement first:
1. Enforce one authoritative source of truth for Week.
   - If order-window/menu/agreement is the core truth, make Sanity weekPlan presentation/editorial only or merge it cleanly.
   - Remove ambiguity.
2. Fix Friday timing from 14:00 to 15:00 consistently across:
   - week logic
   - schema labels
   - tests
   - UI copy
3. Harden role access.
   - Employee must only access the intended employee surface.
   - If /orders or /min-side remain, they must be justified and explicitly aligned with the product model.
   - Add centralized route/API policy enforcement.
4. Preserve and test onboarding/pending/activation/invite flows.
5. Add/update tests for auth, roles, week visibility, cutoff, invoice window.

PHASE 2 — CMS FOUNDATIONS TO UMbraco-LEVEL QUALITY
Implement/refactor:
1. Real content tree backed by persistent data.
   - no mocks
   - move, reorder, nest, duplicate, archive, restore
2. Media library.
   - upload/select/search/filter
   - metadata, alt text, focal point, variants if supported
3. Break up ContentWorkspace monolith.
   - modular workspaces, panes, tabs, controllers, hooks
4. Design system reset.
   - new token architecture for color, typography, spacing, radius, elevation, motion
   - fix poor design, font hierarchy, weak color governance, inconsistent UI
   - premium but calm B2B aesthetic
5. Component dedupe.
   - unify duplicated UI roots/components
6. Preview parity.
   - editor preview must use the same render pipeline as public pages

PHASE 3 — AI-NATIVE CMS AND GROWTH ENGINE
Build on top of existing AI features, do not fork them.
1. AI editor assistant
   - generate pages, sections, blocks, headlines, body copy, CTAs, SEO metadata, CRO suggestions
2. AI page builder
   - create entire pages from structured intent
3. AI asset pipeline
   - integrate existing image workflows if present
   - if image generation is incomplete, create a provider abstraction and editorial review flow without breaking production
4. AI design optimizer
   - suggest layout, hierarchy, readability, conversion improvements
5. AI governance
   - explicit persistence proof: AI output -> editor -> save -> reload -> same result
   - audit trail for AI-generated changes where sensible

PHASE 4 — OPERATIONAL SURFACES BY ROLE
Build/refine all role surfaces using existing domain logic first.
1. Employee
   - optimize Week for mobile speed
   - reduce bundle and API latency
   - clear order/cancel state
   - resilient empty/error states
2. Company admin
   - finance dashboard
   - invoices and invoice periods
   - employees CRUD
   - locations management
   - renewal/termination reminder workflow
   - agreement visibility without superadmin-only mutation power
3. Superadmin control tower
   - approvals
   - agreement control
   - billing controls
   - customer suspension/termination
   - system health and queue visibility
4. Kitchen
   - production planning surface
5. Driver
   - delivery completion surface optimized for mobile

PHASE 5 — SOCIAL, SEO, ESG, AND ENTERPRISE POLISH
1. Social calendar for Lunchportalen only
   - generated posts for Facebook/Instagram
   - generated text, hashtags, and image suggestions
   - editorial review queue
   - edit/delete/schedule/publish calendar
   - themes: lunsj, lunch, kontorlunsj, lunsjtid, office lunch, sustainability, employee wellbeing, canteen replacement
   - not a multi-client agency tool
2. SEO dominance engine
   - integrate with approved sources and existing SEO stack
   - topic planning, landing page generation, internal linking suggestions, SERP opportunity tracking
   - do NOT implement prohibited crawling or terms-violating scraping
3. ESG system
   - waste reduction metrics from cancellations
   - sustainability insights
   - company-level reporting where appropriate
4. Performance hardening
   - mobile first budgets
   - route-level caching where safe
   - reduced bundle size
   - eliminate duplicated data fetching
5. Type safety hardening
   - move toward strict typing where realistic
   - reduce any/fallback-heavy logic in critical paths

DESIGN DIRECTION
The current CMS design, font handling, and color control are not good enough.
Rebuild the design layer into a premium editorial-operational system with:
- strong typography scale
- clear visual hierarchy
- governed semantic color tokens
- refined surfaces, spacing, and iconography
- desktop power for admins, mobile speed for employees/drivers
- calm Scandinavian premium B2B feeling
- minimal clutter, excellent affordance, excellent readability

PERFORMANCE RULES
- Employee and driver flows are highest priority for mobile performance.
- Prefer server-side correctness with lightweight clients.
- Avoid overfetching.
- Keep critical actions fast and resilient.
- No heavy editor code on employee-facing routes.

DATA + INFRA RULES
- Supabase remains the source of truth for auth and operational data.
- Sanity remains content/menu/editorial layer where appropriate.
- Do not break existing .env.local-driven setups.
- Never print secret values.
- Keep cron/worker behavior compatible with Vercel reality; where workers are incomplete, stabilize with clear boundaries.

TESTING RULES
For each phase, add/update tests covering at minimum:
- auth invariants
- onboarding invariants
- role access
- week visibility
- Friday 15:00 behavior
- Thursday 08:00 behavior
- cutoff 08:00
- billing biweekly window
- company admin permissions
- superadmin full permissions
- mobile-critical employee/driver flows where applicable

WORK STYLE
- Work in small commits/patches.
- After each vertical slice, summarize:
  1. files changed
  2. why changed
  3. what duplicate/dead code was removed or deprecated
  4. what tests were added/updated
  5. what remains risky

FIRST IMPLEMENTATION STEP
Read docs/refactor/IMPLEMENTATION_SEQUENCE.md and begin with Phase 1 only.
Do not jump ahead.
When Phase 1 is complete, stop and summarize before Phase 2.
```

---

## Recommended execution order

1. Run Prompt 1.
2. Review the generated docs/refactor/ files.
3. Run Prompt 2.
4. Approve each phase before continuing.
