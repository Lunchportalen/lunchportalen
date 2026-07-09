# Localized generator SOT cutover design

**Status:** DESIGN ONLY · **SOT NOT STARTED** · **auto-rollout NOT STARTED**
**Date:** 2026-07-09
**Main HEAD (design audit):** `3c7dd918` — Complete 21-market locale coverage (#464)
**Predecessor plan:** [`docs/runbooks/localized-generator-sot-rollout-readiness.md`](../runbooks/localized-generator-sot-rollout-readiness.md)
**Readiness decision input:** SOT readiness decision audit (read-only, 2026-07-09) — SOT **NO-GO**, 1 of 4 activation gates PASS.

This document is the **Gate D design artifact** required by the launch decision matrix (phase **D — SOT activation**). Merging this document does **not** start SOT, does not authorize publish, does not authorize the rollback drill, and does not authorize any production mutation. Every executable step described below requires its own separate, scoped operator GO.

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded.**

---

## 1. Scope

### 1.1 What SOT means

**SOT (source of truth) cutover** for the localized generator means: **generated localized menu content becomes the authoritative input for provider menu materialization and downstream employee visibility for enrolled providers** — flowing through the existing publish/materialization chain (`menu_service_days` → employee `/week`) without changing any order write contract.

Target hierarchy (unchanged from the readiness runbook §5.3):

```
provider_settings (menuProfileId, locale, country)
        ↓
menu profile resolver (LP_MENU_PROFILE_RESOLVER)
        ↓
localized generator (LP_LOCALIZED_FIXED_MENU_GENERATOR) — apply creates Sanity drafts/catalog
        ↓
existing publish / materialization chain → menu_service_days → employee /week
        ↓
order write-path (UNCHANGED — lp_order_set)
```

SOT cutover changes **who owns step 3 as authoritative** for enrolled providers. It does not change steps 4–5.

### 1.2 What SOT does not mean

- SOT is **not** auto-rollout. No cron, no batch apply, no scheduled publish. Auto-rollout remains a separate, deferred product GO (phase E).
- SOT is **not** a publish action. Publish of generated docs remains a separate gated workflow.
- SOT is **not** an order-path change. **`lp_order_set` remains LOCKED** (Protected Golden Path). Order RPC wrappers, cutoff enforcement (`orders_cutoff_0800`, GUC path), order identity, item keys, variant slugs and tenant scoping are out of scope and must remain byte-identical in behavior.
- SOT is **not** billing. The Global Billing Engine / Stripe track (#463) is a separate track with its own gates; SOT cutover must have **zero** billing side effects and must not wire billing objects into the menu chain (per the billing implementation contract's runtime boundary).
- SOT does **not** production-apply Phase D. The 12 Phase D locales stay `SOURCE_ONLY` with zero production footprint. Phase D apply remains NO-GO behind its own separate scoped GO.
- SOT does **not** relax tenant isolation, employee API safety, or fail-closed behavior anywhere.

---

## 2. Current verified state (evidence-backed)

All facts below are backed by merged evidence on main:

| Item | State | Evidence |
|---|---|---|
| Phase C localized provider rollout | **Complete and evidence-backed** | [`final-phase-c-rollout-summary-readiness-audit.md`](../evidence/final-phase-c-rollout-summary-readiness-audit.md) (#458) |
| Locales/providers complete | 9 (nb-NO, sv-SE + da-DK, fi-FI, en-GB, de-DE, fr-FR, es-ES, it-IT) | Phase C evidence chain #446–#455 |
| Production providers | 9 · orders 17 | Launch decision audit (#459), post-launch monitoring (#462) |
| Generated Phase C menuDays | 120 — all far-future drafts | `customerVisible=true`: 0 · `approvedForPublish=true`: 0 |
| Generated Phase C catalog docs | 8 | Final Phase C readiness audit §9 |
| Global templates | 7 · rev hash length 320 · unchanged | Post-launch monitoring (#462) |
| Employee/API safety | **PASS** — authenticated 200/ok, anonymous safe 401, no economy/metadata/Phase D leakage | Final Phase C readiness audit §9 |
| Production launch | **Live and healthy** | Publish evidence (#461), post-launch monitoring (#462) |
| 21-market locale registry | Merged, source-only | #464 · `lib/i18n/localeRegistry.ts` |
| Phase D (12 targets) | `SOURCE_ONLY` · 0 production rows/settings/Sanity docs | Final Phase C readiness audit §6–7 |
| SOT | **NOT STARTED** | SOT readiness decision audit 2026-07-09 |
| Auto-rollout | **NOT STARTED · DEFERRED** | Readiness runbook §8 |
| SOT cutover flag in code | **None exists** — no accidental activation path | Repo scan 2026-07-09; readiness runbook §1.1 |
| Production flags | `LP_MENU_PROFILE_RESOLVER` ON · `LP_LOCALIZED_FIXED_MENU_GENERATOR` ON · unchanged through launch chain | Readiness runbook §1.1, monitoring (#462) |

---

## 3. SOT gates

Hard gates before any SOT cutover. Any FAIL → **STOP** (fail-closed).

### Gate A — Phase C stability

- **Status: PASS.**
- Evidence: complete Phase C chain (#446–#458), 9-locale staging matrix L1–L8 PASS, production inventory verified, post-launch monitoring healthy (#462).
- Regression trigger: any catalog `_rev` drift, order-count change, employee leakage, or Phase D production footprint > 0 reopens this gate.

### Gate B — Publish workflow proof

- **Status: MISSING. Required before SOT.**
- **Requires its own separate scoped GO** (production mutation — not authorized by this document).
- Must prove that **one** scoped generated localized doc can be approved and published safely through the existing publish workflow (see §9 for the plan).
- Must **not** be a broad rollout publish: exactly one provider, one week, minimal doc set.
- PASS criteria include correct `approvedForPublish`/`customerVisible` transitions, correct employee visibility semantics, no leakage, and a proven un-publish/rollback boundary.

### Gate C — Rollback drill

- **Status: MISSING. Required before SOT.**
- **Requires its own separate scoped GO** (production mutation — not authorized by this document).
- Must be **draft-only** and scoped: delete only session-created provider-scoped docs with `approvedForPublish=false` and `customerVisible=false` (see §8).
- Must document the exact rollback boundary and archive evidence, closing the "formal rollback drill not archived" risk carried since the launch readiness review.

### Gate D — SOT runtime design approval

- **Status: THIS DOCUMENT.**
- Requires separate review and merge as a docs-only PR.
- **Merging this document does not start SOT.** It only closes the "SOT design doc missing" blocker (classified High in the launch readiness review).

### Gate E — Final SOT readiness audit

- Required **after** Gates B, C and D are all closed.
- Read-only. No mutation.
- Must re-verify: production inventory, employee/API safety, publish proof evidence, rollback drill evidence, flag state, Phase D dormancy, order-count stability.
- Must end with an explicit **GO / NO-GO** statement.

### Gate F — SOT cutover GO

- Only after Gates A–E all PASS.
- Separate explicit operator GO with scoped provider allowlist and rollback plan.
- Related track: G5d.8 (compatibility SOT boundary, [`docs/runbooks/g5d8-planning.md`](../runbooks/g5d8-planning.md)) carries its own preconditions (byte/schema parity evidence, `canProceedToRuntimeHook` governance) where the employee menu assembly hook is involved; that track must be reconciled at Gate E if the cutover implementation touches it.

---

## 4. Proposed SOT architecture

Design only — no code is changed by this document.

1. **Generator output stays draft/invisible by default.** Apply continues to create Sanity drafts (`approvedForPublish=false`, `customerVisible=false`) under `create_missing_only_strict`. SOT does not change apply semantics.
2. **Cutover is an explicit, guarded runtime decision.** A new feature flag (see §5) selects generated localized content as the authoritative catalog/menuDay source **per enrolled provider**. There is currently **no** SOT flag in the codebase, so nothing can cut over accidentally; the flag is introduced only in a future scoped implementation PR.
3. **Enrollment is allowlist-based.** Only providers explicitly listed in the SOT provider allowlist are affected. Default: empty list → SOT inert even when the master flag is ON.
4. **Reversible by design.** Disabling the flag (or removing a provider from the allowlist) must instantly restore the previous authoritative source without data deletion, without republish, and without touching orders.
5. **Publish workflow unchanged.** Generated drafts become employee-visible **only** through the existing approved publish workflow. SOT never implies publish, and there is no publish-as-apply.
6. **Manual/provider-owned menu data remains safe.** For non-enrolled providers nothing changes. For enrolled providers, pre-existing manual catalog docs are never deleted or overwritten by cutover; SOT changes which source is read as authoritative, not the stored documents.
7. **Protected order path untouched.** The cutover point sits strictly **above** materialization output consumed by `/week`; the order write contract (`lp_order_set`, RPC wrappers, cutoff) is not modified, not re-wired, and not re-tested away.
8. **No auto-rollout coupling.** `runMenuWeekRollout*` and any batch/cron mechanism remain forbidden. Any future auto-rollout is a separate product GO (phase E) with its own flag and design.

---

## 5. Feature flag / kill switch design

Proposed flags — **design only, not implemented in this PR**. Names follow the existing `LP_*` convention (`lib/menu-generator/featureFlag.ts`, `lib/menu-profile/featureFlag.ts`).

| Flag | Purpose | Default |
|---|---|---|
| `LP_LOCALIZED_GENERATOR_SOT_ENABLED` | Master switch for SOT authoritative-source selection | **OFF** |
| `LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST` | Comma-separated provider IDs enrolled in SOT; empty ⇒ SOT inert | **empty** |
| `LP_LOCALIZED_GENERATOR_SOT_DRY_RUN` | Log/compare-only mode: computes SOT source decision and diff without serving it | **OFF** |
| `LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED` | Reserved name for the separate, deferred auto-rollout track — **not part of SOT cutover** | **OFF** (future) |

Kill switch behavior:

- `LP_LOCALIZED_GENERATOR_SOT_ENABLED=OFF` ⇒ immediate revert to current behavior for all providers. No Sanity deletion, no Supabase mutation, no republish.
- Removing a provider from the allowlist ⇒ same revert scoped to that provider.
- Flag evaluation must be fail-closed: missing/malformed env ⇒ treated as OFF; malformed allowlist entries ⇒ ignored (provider not enrolled), logged with RID.
- `LP_LOCALIZED_FIXED_MENU_GENERATOR=OFF` continues to disable apply UI/route independently (existing rollback lever, unchanged).

Required env verification before cutover (Gate F preflight):

- `/superadmin/system` health shows env/runtime OK (no DEGRADED cause introduced by new flags).
- Flag state read back and archived in cutover evidence (names and ON/OFF state only — never values of secrets).
- Restart/redeploy law respected: flag changes require redeploy; verification happens post-deploy, pre-enrollment.

---

## 6. Data safety rules

Binding for every SOT-related session (drill, proof, cutover):

- No `customerVisible=true` on generated docs before Gate B publish workflow proof exists — and after that, only through the publish workflow with scoped GO.
- No broad `approvedForPublish` mutation. Approval is per-doc, through the publish workflow only.
- No Phase D production apply: 0 provider rows, 0 settings rows, 0 Sanity providers, 0 menuDays, 0 catalog docs — must remain 0 throughout SOT work.
- No hidden publish-as-apply. Apply and publish remain separate workflows with separate GOs.
- No menuDays created outside the scoped provider/week of an authorized session.
- No mutation of the 7 global `lunchCategory` templates during any SOT activity (seed-only; rollback never deletes them).
- No order write mutation. Order counts must be identical pre/post every session (currently 17; verified against live count at session time).
- No pricing mutation: price rules, tier pricing and commercial snapshots are out of scope.
- No billing mutation: commission ledger, invoices, payment methods and Stripe objects are untouched; no billing wiring into the menu chain.

---

## 7. Protected Golden Path boundaries

Per [`docs/PROTECTED_GOLDEN_PATH.md`](../PROTECTED_GOLDEN_PATH.md), SOT cutover must hold these invariants:

- **`lp_order_set` unchanged** — no SQL, RPC signature, GUC, or trigger change.
- **Order write path unchanged** — `app/api/orders/*`, `lib/orders/rpcWrite.ts`, `lib/orders/orderWriteGuard.ts` untouched.
- **Employee order contract unchanged** — item keys, variant slugs, tenant scoping (`provider_id`/`company_id`/`location_id`) stable across cutover.
- **Cutoff enforcement unchanged** — employee 08:00 cutoff enforced; provider production advances remain scoped to the `lp_order_advance_status` GUC path.
- **Pricing snapshot / order logic unchanged** — no changes to order-line commercial truth.
- **No billing side effects** — the billing runtime boundary (no wiring into `lp_order_set`, menu publish, `/week`, cutoff, provider order status) remains in force.

Any implementation PR that touches protected files must declare **`Protected Golden Path Impact`**, include a read-only audit, regression tests and a rollback plan, and pass `npm run test:golden-path` plus `node scripts/ci/guard-protected-golden-path.test.mjs`. The expectation for SOT cutover is that **no protected file needs to change**; if implementation reveals otherwise, that is a design escalation requiring a new protected-path audit — not a silent edit.

---

## 8. Rollback strategy (plan only)

### 8.1 What can be rolled back

| Layer | Mechanism | Data loss |
|---|---|---|
| SOT source selection | Flag OFF / allowlist removal | None — instant source revert |
| Generated draft docs | Draft-only deletion (drill-proven) | Session-created drafts only |
| Published generated docs | Publish workflow rollback (un-publish/re-point) | None — stricter rules below |
| Generator apply capability | `LP_LOCALIZED_FIXED_MENU_GENERATOR=OFF` | None — UI/route disabled only |

### 8.2 Exact rollback boundaries

Draft-only rollback may delete a document **only if all of**:

- created in the controlled session being rolled back (session/idempotency-key traceable),
- `providerRef` matches the scoped target provider,
- `approvedForPublish=false` **and** `customerVisible=false`,
- doc is a provider-scoped `lunchCategory` or `menuDay` draft in the target week,
- doc is not order-locked (`assertCatalogWriteAllowed` boundary respected).

**Forbidden — always:**

- Deleting the 7 global `lunchCategory` templates.
- Deleting published menuDays or any doc with `approvedForPublish=true` without an explicit publish-rollback GO.
- Deleting pre-existing catalog docs that predate the session.
- Touching orders, order history, or order status rows.
- Touching auth users, `providers`, `organizations`, or `provider_settings` rows — unless onboarding corruption is proven and fixed under its own scoped GO.
- Touching any provider outside the scoped target (Melhus, Swedish/Danish/Finnish/UK/German/French/Spanish/Italian Lunch Pilots are each individually out of bounds unless explicitly the scoped target).

### 8.3 Rollback drill requirement (Gate C)

A formal **draft-only rollback drill** must be executed and archived before SOT:

1. Select one scoped provider + far-future week with session-created drafts.
2. Pre-snapshot: doc IDs, `_rev` of adjacent docs, order count, employee API state.
3. Delete drafts within the boundary above — nothing else.
4. Read-back: dryRun shows `would_create` restored for removed docs only; global template `_rev` unchanged; order count unchanged; employee APIs PASS.
5. Archive evidence as docs-only PR.

Published docs require the stricter publish-rollback path proven in Gate B — the drill does not touch published docs.

---

## 9. Publish workflow proof plan (Gate B — plan only)

Separate scoped GO required. Not executed by this document.

1. **Choose one scoped target:** one generated doc set (single provider, single far-future week; candidate: one Phase C pilot provider's generated menuDay tier-docs).
2. **Pre-proof snapshot:** doc state (`approvedForPublish=false`, `customerVisible=false`), order count, employee `/api/week` + `/api/order/window` baseline, anonymous 401 regression.
3. **Prove approval/publish handling:** move exactly the scoped doc(s) through the existing publish workflow; verify `approvedForPublish`/`customerVisible` transitions match contract.
4. **Prove no employee leakage before publish:** employee APIs must not expose the docs pre-publish.
5. **Prove correct employee visibility after publish** (if the intended proof includes visibility): materialized `menu_service_days` reflect the published docs; employee `/week` shows them; no economy/metadata fields exposed; wrong-tenant isolation verified.
6. **Prove rollback boundary:** un-publish/re-point restores prior state; orders unchanged; global templates unchanged.
7. **Archive evidence** as docs-only PR with RIDs, counts, PASS/FAIL per step.

Fail-closed: any unexpected diff, leakage, or order-count change → STOP, restore, archive incident evidence.

---

## 10. Observability / monitoring

Required for every SOT-related session and for cutover itself:

- **Pre-cutover snapshots:** provider/order counts, generated doc counts by flag state, catalog `_rev` set, flag states (names + ON/OFF only).
- **Post-cutover read-back:** same counters; source-selection decision logged per enrolled provider with `rid`, `providerId`, flag, allowlist hit.
- **Employee API checks:** authenticated `/api/week` + `/api/order/window` 200/ok; anonymous 401 regression; scan for economy/metadata fields.
- **Provider route checks:** `/leverandor/meny` and provider order surfaces load per enrolled and non-enrolled provider; no cross-tenant bleed.
- **Error logs:** apply/publish/cutover audit fields per the readiness runbook §7 (`rid`, `providerId`, `weekStart`, `menuLocale`, `menuProfileId`, `overwriteMode`, `dryRun`, `idempotencyKey`).
- **Leakage gates:** no economy/metadata leakage, no Phase D leakage, no draft leakage — each a hard stop.
- **No SOT auto-rollout:** monitoring must alert if any batch/cron-like apply pattern appears.

---

## 11. Test plan

Commands expected to PASS before any SOT cutover (Gate E/F verification set):

- `npm run typecheck`
- `npm run lint`
- `npm run ci:commercial-hardcodes-guard`
- `npm run test:golden-path`
- `node scripts/ci/guard-protected-golden-path.test.mjs`
- Locale/i18n: `npm run test:run -- tests/lib/i18n/localeRegistry.test.ts tests/lib/tiers/displayLabels.test.ts tests/static/tierDisplayUiGuard.test.ts tests/lib/provider-onboarding/phaseDLocales.test.ts tests/governance/language-menu-separation-contracts.test.ts tests/i18n/language-does-not-change-menu-identity.test.ts`
- Protected path focus: `npm run test:run -- tests/governance/protected-golden-path.test.ts tests/api/orders-idempotency.test.ts tests/api/orders-set-menu-scope.test.ts tests/providers/providerProductionStatusFlow.test.ts tests/providers/providerProductionCutoff.test.ts`
- Provider menu + employee API test suites relevant to the menu surface.
- Anonymous 401 regression on `/api/week` and `/api/order/window`.
- New SOT governance tests to be added in the implementation PR: flag default-OFF proof, allowlist inertness proof, kill-switch revert proof, dry-run no-serve proof, non-enrolled provider invariance proof.

---

## 12. Decision matrix

| Item | State |
|---|---|
| LIVE production | **Green without SOT** — no launch dependency on SOT |
| SOT | **NO-GO** until Gates A–E all PASS and Gate F GO is given |
| Auto-rollout | **NO-GO · DEFERRED** — separate future product GO |
| Phase D | **Source-only** — production apply remains NO-GO behind separate scoped GO |
| Billing / Stripe | **Separate track** — own gates, no coupling to SOT |

Next steps after this design doc merges (each requires its own separate GO, in order):

1. **Rollback drill GO** (Gate C — draft-only, scoped, production mutation).
2. **Publish workflow proof GO** (Gate B — one scoped doc set, production mutation).
3. **Final SOT readiness audit** (Gate E — read-only, explicit GO/NO-GO).
4. **SOT cutover GO** (Gate F) — only if all prior gates PASS.

---

## 13. Explicit non-goals

This document and its PR do **not** include and do **not** authorize:

- SOT start or any authoritative-source change.
- Publish of any document.
- Rollback drill execution.
- Any production mutation (Supabase or Sanity).
- Generator apply or onboarding apply.
- Phase D apply.
- Billing/Stripe work or invoice sending.
- Auto-rollout in any form.
- Order write-path or `lp_order_set` changes.
- Production flag changes.

**STOP.** Next action after merge requires a separate explicit GO.
