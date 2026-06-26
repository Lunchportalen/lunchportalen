# G5d.3 — Staging-only mapping draft persistence audit (read-only)

**Status:** AUDIT ONLY — no migration, API, UI save, or Production flags  
**Date:** 2026-06-26  
**Prerequisite:** G5a–G5d.2 DONE (PR #353 merge `12537a39`), Production `LP_MENU_PROFILE_*` OFF  
**Related:** `G5d-menu-profile-cutover-audit.md`, `G5-menu-profile-cutover-plan.md`, ADR-019, `PROTECTED_GOLDEN_PATH.md`

---

## Executive summary

G5d.3 is the **first phase that may touch DB schema and RLS** for menu profile work. It must persist **shadow mapping proposal metadata only** — never runtime menu data, never publish/order/week paths, never Sanity writes.

**Recommendation:** First PR after this audit = **docs-only design review** (`docs(menu-profile): add G5d.3 mapping draft persistence design`). No migration until G5d.3b with explicit GO.

**Storage recommendation:** Dedicated table `provider_menu_profile_runtime_mapping_drafts` — **not** `provider_settings`.

**Safe next step:** G5d.3a docs + schema/RLS design review.  
**Not safe:** Single PR combining migration + API + UI save + any runtime wiring.

---

## Part 1 — Read-only audit findings

### 1.1 Current G5d stack (what exists today)

| Layer | Module | Persistence | Runtime wired? |
|-------|--------|-------------|----------------|
| G5d.1 | `lib/menu-profile/runtimeMapping.ts` | None (pure compute) | **No** — blocked from protected imports |
| G5d.2 | `lib/provider-menu/providerMenuRuntimeMappingProposal.ts` | None (SSR view model) | **No** — `assertNoRuntimeEnablement()` |
| G5d.2 UI | `ProviderMenuRuntimeMappingProposalPanel.tsx` | None (read-only) | **No** — no inputs/buttons/forms |

Proposal is built server-side on `app/leverandor/meny/page.tsx` when:

- `LP_MENU_PROFILE_RESOLVER=true` **and**
- `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL=true`

Data flow: `loadAndResolveProviderMenuProfile` → `buildMenuProfileRuntimeMapping` → `buildProviderMenuRuntimeMappingProposalPresentation` → props to `ProviderMenuBuilder`.

**No API route, no DB read/write, no client persistence.**

### 1.2 Existing table / pattern templates

| Pattern | Table / artifact | Provider scope | Write model | Relevance to G5d.3 |
|---------|------------------|----------------|-------------|-------------------|
| **Operational config (1:1)** | `provider_settings` | `provider_id` PK → `organizations` | SELECT: `app_active_org()` or platform admin; **WRITE: platform admin only** (RLS) — provider ops writes via **server actions + service_role** | **Poor fit** for drafts (see §3.2) |
| **Entitlements (1:N)** | `provider_package_entitlements` | `provider_id` + unique `(provider_id, package_key, entitlement_key)` | Same RLS as settings — platform admin write | Template for FK + indexes, not for JSON drafts |
| **Pricing (1:N)** | `provider_price_rules` | `provider_id` | Same RLS spine | Template for provider-scoped commercial data — **must not mix** with mapping drafts |
| **Provider admin CRUD** | `provider_service_areas` (archive migration) | `provider_id` | `provider_admin` via `provider_memberships` + `is_platform_admin()` | **Best RLS template** for provider_admin draft write |
| **Secure RPC gate** | `private.lp_assert_provider_admin_or_superadmin` | Used in lifecycle, Tripletex | SECURITY DEFINER RPCs | **Best API template** for fail-closed server writes |
| **Audit trail** | `lifecycle_audit_log` | Entity-scoped SELECT | INSERT via RPC / service paths | Future G5d.3f archive events |
| **Partitioned audit** | `audit_log` | System-wide | Superadmin / internal | Not for draft body storage |

**Migration style (project norms):**

- Timestamped files under `supabase/migrations/`
- Idempotent `ADD COLUMN IF NOT EXISTS`, explicit `COMMENT ON`
- RLS: `ENABLE ROW LEVEL SECURITY`, named policies, `REVOKE ALL FROM PUBLIC, anon`
- FK → `organizations(id) ON DELETE CASCADE` (not legacy `providers` table)
- `tg_set_updated_at()` triggers where applicable
- G2 precedent: `20260725120000_provider_settings_menu_profile_id.sql` — additive column, explicit “RLS unchanged”, CHECK constraint on registry ids

### 1.3 Provider scoping today

**Server truth (app layer):**

- `getProviderAdminContext(userId)` → `primaryProvider.id`
- `hasProviderRole(userId, providerId, role)` — hierarchy: `provider_admin` > `provider_kitchen` > `provider_viewer`
- Menu catalog/days API: `provider_id` from auth context, **never** from unchecked client body alone

**DB truth (RLS spine):**

- `app_active_org()` — JWT/session active org (identity spine phase 2)
- `app_is_platform_admin()` / `is_platform_admin()` — superadmin
- `can_access_provider(provider_id)` — any provider membership (broader than admin)
- `lp_assert_provider_admin_or_superadmin(provider_id)` — strict admin gate in RPCs

**Implication for G5d.3:** Draft API must resolve `provider_id` from server auth context (`getProviderAdminContext` + `requireProviderRole(..., "provider_admin")` for writes). RLS must mirror: admin write, viewer read (optional), no cross-provider.

### 1.4 RLS policy style in project

Common structure:

1. `service_role` → `FOR ALL USING (true) WITH CHECK (true)`
2. `authenticated` SELECT → `app_is_platform_admin() OR provider_id = app_active_org()` **or** `can_access_provider(provider_id)`
3. Admin write (when needed) → explicit `provider_memberships` role check, not permissive wildcards
4. `REVOKE ALL FROM PUBLIC, anon`; grant SELECT to `authenticated`, full to `service_role`

**Anti-patterns to avoid:**

- Permissive `USING (true)` for authenticated
- Trusting `provider_id` from request body without matching `auth.uid()` membership
- Hard DELETE of audit-relevant rows (prefer archive status)

### 1.5 Safe vs unsafe write paths

| Path | Safe for G5d.3 draft read? | Safe for G5d.3 draft write? | Notes |
|------|---------------------------|----------------------------|-------|
| `app/leverandor/meny/page.tsx` | Yes (future: load draft metadata) | No direct DB — via API only | Presentation host |
| `ProviderMenuBuilder.save()` | **No** | **Never** | Locked by G5d.0 — no `runtimeMappingProposal` in save block |
| `POST /api/provider/menu-days` | **No** | **Never** | Protected Golden Path |
| `POST /api/provider/menu-catalog` | **No** | **Never** | Provider-owned titles |
| `lib/menu-publish/**` | **No** | **Never** | Must not import `runtimeMapping` |
| `/api/week`, `/api/order/window` | **No** | **Never** | Employee surface |
| `app/api/orders/set` | **No** | **Never** | Order write-path |
| New `app/api/provider/menu-profile/mapping-draft` | Yes (G5d.3d+) | Yes (G5d.3d+) | Isolated, flag-gated, staging-only |

### 1.6 Where draft metadata can live without affecting runtime

**Acceptable:** New provider-scoped table or RPC-managed JSON blobs **read only by**:

- Provider menu workspace (flag ON)
- Superadmin diagnostics (read-only)
- Staging smoke tests

**Must never be read by:**

- `buildMenuDayPayload`, `menuCatalogWrite`, `runMenuWeekRolloutCore`, `syncMenuServiceDayItems*`
- `lp_order_set`, order enrichment, `/week` loaders
- Sanity sync/write clients

**Import guard (existing):** `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts` — protected paths must not import `/runtimeMapping/`. Extend in G5d.3b+ to forbid draft module imports in protected paths.

### 1.7 `provider_settings` — use or avoid?

**Current columns relevant to menu profile:**

- `menu_profile_id` (nullable, CHECK against registry) — G2, inert pointer to active profile
- Operational: currency, locale, cutoff, delivery_days, contact emails

**Why NOT store mapping drafts in `provider_settings`:**

1. **Cardinality:** One row per provider — cannot keep draft history, reviewed vs archived versions, or multiple proposal snapshots.
2. **Separation of concerns:** Settings = operational truth; drafts = disposable staging artifacts.
3. **RLS mismatch:** Provider admins cannot UPDATE `provider_settings` directly (platform admin RLS). Draft save would force service_role for all writes or require RLS change on settings — high blast radius.
4. **Validation:** JSONB column on settings lacks draft lifecycle (`draft_status`, `archived_at`, `mapping_version` pinning).
5. **Migration risk:** Accidental coupling — resolver reading settings might later “helpfully” consume draft JSON.
6. **Audit:** No row-level created_by/updated_by pattern on settings for proposal review workflow.

**Acceptable use of `provider_settings` in G5d.3:** Read-only join on `menu_profile_id` when loading draft context — **never** store `mapping_json` there.

---

## Part 2 — Draft persistence format (proposed)

Draft records store a **frozen snapshot** of the G5d.2 proposal view model at save time, plus metadata. They are **not** authoritative runtime configuration.

### 2.1 Core fields

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | `uuid` | PK | Draft identity |
| `provider_id` | `uuid` | FK → organizations | Tenant scope |
| `menu_profile_id` | `text` | NOT NULL | Registry id at save time |
| `mapping_version` | `text` | NOT NULL | e.g. `g5d.1` — pins builder version |
| `source_profile_version` | `text` | NULL OK | Future: registry semver/hash |
| `draft_status` | `enum` | NOT NULL | `draft` \| `reviewed` \| `archived` |
| `proposal_json` | `jsonb` | NOT NULL | Full `ProviderMenuRuntimeMappingProposal` snapshot |
| `unmapped_categories_json` | `jsonb` | NOT NULL DEFAULT `[]` | Denormalized for queries |
| `warm_dish_preview_json` | `jsonb` | NOT NULL DEFAULT `[]` | Denormalized warm dish preview slice |
| `validation_summary_json` | `jsonb` | NOT NULL | Result of server validation at write |
| `notes` | `text` | NULL | Provider admin free text (internal) |
| `created_by` | `uuid` | NOT NULL | `auth.users` — set server-side |
| `updated_by` | `uuid` | NOT NULL | Set server-side |
| `created_at` | `timestamptz` | NOT NULL | |
| `updated_at` | `timestamptz` | NOT NULL | |
| `archived_at` | `timestamptz` | NULL | Set when status → archived |

### 2.2 `proposal_json` schema rules

Must conform to G5d.2 types with enforced invariants:

- `isRuntimeEnabled: false`
- `isShadowOnly: true`
- All category `canSaveToMenuDay|canSaveToCatalog|canPublish|canOrder: false`
- All warm dish `canApplyToMenu|canPublish|canOrder: false`
- Summary counts all `0`
- No Sanity document IDs in any field
- No catalog title mutations — proposal references profile labels only
- `mappingVersion` must match column `mapping_version`

**Explicit non-goals in JSON:**

- No `sanityDocumentId`, `menuDayId`, `orderChoiceKey` overrides
- No price/currency override fields
- No `employeeVisible`, `publishEnabled`, `orderEnabled` flags

### 2.3 Draft lifecycle semantics

| Status | Meaning | Visible in UI (future) |
|--------|---------|------------------------|
| `draft` | Saved evaluation snapshot | “Utkast” |
| `reviewed` | Provider admin marked reviewed | “Vurdert” |
| `archived` | Soft-deleted / superseded | “Arkivert” |

**No auto-apply:** Loading a draft never mutates catalog, menu days, publish queue, or resolver output used by runtime.

**Default UX (future G5d.3e):** At most one “active” draft per `(provider_id, menu_profile_id)` — enforce via partial unique index OR app logic (see §3.3).

---

## Part 3 — Table name and model

### 3.1 Recommended name

**`provider_menu_profile_runtime_mapping_drafts`**

Rationale:

- Explicit: provider-scoped, menu profile domain, **runtime mapping**, **drafts** (plural)
- Distinguishes from future G5d.4 publish shadow tables
- Shorter alias `provider_menu_profile_mapping_drafts` acceptable but less precise

### 3.2 Why dedicated table beats `provider_settings`

See §1.7. Dedicated table enables:

- Multiple archived snapshots per provider
- Provider_admin RLS without weakening settings policies
- CHECK constraints on `draft_status` and `mapping_version`
- Clear REVOKE/GRANT surface
- Zero risk of publish/resolver reading draft JSON from settings row

### 3.3 Indexes and constraints

```sql
-- Suggested (design only — not applied in G5d.3 audit)

PRIMARY KEY (id)
FOREIGN KEY (provider_id) REFERENCES organizations(id) ON DELETE CASCADE
CHECK (draft_status IN ('draft', 'reviewed', 'archived'))
CHECK (mapping_version ~ '^g5d\.[0-9]+$')  -- or explicit allowlist
CHECK (char_length(trim(menu_profile_id)) > 0)

CREATE INDEX ... ON (provider_id, draft_status) WHERE draft_status != 'archived';
CREATE INDEX ... ON (provider_id, menu_profile_id, updated_at DESC);

-- Optional: one active draft per provider+profile
CREATE UNIQUE INDEX ... ON (provider_id, menu_profile_id)
  WHERE draft_status IN ('draft', 'reviewed');
```

### 3.4 JSONB usage

**Yes** for `proposal_json`, `validation_summary_json`, slices — matches `provider_package_entitlements.default_value` pattern.

**Validate on write** in application layer (G5d.3c) — Postgres CHECK cannot easily enforce nested `canPublish: false` for all array elements.

### 3.5 Audit / versioning

- **Row-level:** `created_by`, `updated_by`, timestamps, `archived_at`
- **Version pinning:** `mapping_version` + optional `source_profile_version`
- **Event log (G5d.3f):** Insert `lifecycle_audit_log` on create/archive with `{ draft_id, menu_profile_id, mapping_version }` — not full JSON in audit metadata (size/noise)

**Stale drafts:** When registry adds profiles or `MENU_PROFILE_RUNTIME_MAPPING_VERSION` bumps, old drafts remain readable but UI shows warning “generated under older mapping version” — no auto-migration of JSON.

---

## Part 4 — RLS policy proposal (pre-migration design)

Target roles:

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| `anon` | Deny | Deny | Deny | Deny |
| `authenticated` employee/customer | Deny | Deny | Deny | Deny |
| `provider_viewer` | Own provider | Deny | Deny | Deny |
| `provider_admin` | Own provider | Own provider | Own provider | Deny (archive only) |
| `provider_kitchen` | Deny or own read — **recommend deny** | Deny | Deny | Deny |
| Platform admin | All | All | All | Deny (archive only) |
| `service_role` | All | All | All | All (internal) |

### 4.1 Proposed policies (names illustrative)

1. **`..._service_role_all`** — `FOR ALL TO service_role USING (true) WITH CHECK (true)`
2. **`..._select_provider_scope`** — SELECT where `can_access_provider(provider_id)` AND (`provider_viewer`+ membership) OR platform admin
3. **`..._insert_provider_admin`** — INSERT WITH CHECK admin membership on `provider_id`
4. **`..._update_provider_admin`** — UPDATE USING/WITH CHECK admin membership; **WITH CHECK** `draft_status != 'archived'` OR only transition to archived (no resurrect without new insert)
5. **`..._select_platform_admin`** — platform admin SELECT all (if not covered by superuser path)
6. **No DELETE policy** for authenticated — archive via UPDATE

**Hard rules:**

- `provider_id` in INSERT must match membership — **never** accept mismatched body provider_id
- `created_by` / `updated_by` set in API from `auth.uid()`, not client payload
- No permissive `USING (true)` for authenticated

**Helper alignment:** Prefer same membership subquery as `provider_service_areas` policies; optionally wrap writes in RPC calling `lp_assert_provider_admin_or_superadmin`.

---

## Part 5 — API scope proposal (G5d.3d+, not implemented in audit)

### 5.1 Endpoints needed

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/provider/menu-profile/mapping-draft` | Load active/latest draft for current provider + profile |
| GET | `/api/provider/menu-profile/mapping-draft/history` | Optional — list archived (pagination) |
| POST | `/api/provider/menu-profile/mapping-draft` | Create draft from current computed proposal |
| PATCH | `/api/provider/menu-profile/mapping-draft/[id]` | Update status, notes; **not** arbitrary JSON patch |
| POST | `/api/provider/menu-profile/mapping-draft/[id]/archive` | Soft archive |

### 5.2 Endpoints NOT needed (G5d.3)

- Apply draft to catalog/menu-days
- Publish preview
- Sync to Sanity
- Employee/week read
- Cross-provider admin bulk export

### 5.3 API contract (aligned with enterprise law)

Success: `{ ok: true, rid, data }`  
Error: `{ ok: false, rid, error, message, status }`

**Server flow:**

1. `getAuthContext()` → fail 401
2. `getProviderAdminContext` → `provider_id` from server
3. `requireProviderRole(provider_id, "provider_admin")` for POST/PATCH/archive
4. Recompute proposal via G5d.1/G5d.2 builders — **persist computed snapshot**, not raw client JSON (fail-closed)
5. Run `assertNoRuntimeEnablement` + JSON schema validation (G5d.3c)
6. INSERT/UPDATE via service_role or RLS-compliant client

**Why publish/order/week never use these APIs:** No imports from draft module in protected paths; no read hook in menu-publish or order set; feature flag OFF in Production; contract tests extended in G5d.3d.

---

## Part 6 — Validation model

Reuse and extend `assertNoRuntimeEnablement()` (`providerMenuRuntimeMappingProposal.ts`).

### 6.1 Must be true (reject write if any fail)

| Invariant | Check |
|-----------|-------|
| `isRuntimeEnabled === false` | Top-level |
| `isShadowOnly === true` | Top-level |
| Category flags | All `canSaveToMenuDay/CanSaveToCatalog/canPublish/canOrder === false` |
| Warm dish flags | All `canApplyToMenu/canPublish/canOrder === false` |
| Summary counts | All `0` |
| Preview IDs | Warm dish IDs match `warm-dish-preview:` prefix only |
| No Sanity IDs | Regex scan proposal JSON |
| No profile keys in order fields | No `panini`, `insalata`, etc. as `runtimeOrderChoiceKey` unless mapped via NO bridge (still `canOrder: false`) |
| `mappingVersion` | Matches server `MENU_PROFILE_RUNTIME_MAPPING_VERSION` |
| `menu_profile_id` | Matches resolver output for provider |

### 6.2 Must reject (explicit)

- `canPublish=true`, `canOrder=true`, `canSaveToMenuDay=true`, `canSaveToCatalog=true`
- `runtimeEnabled=true`, `isShadowOnly=false`
- `employeeVisible=true`, `publishEnabled=true`, `orderEnabled=true`
- Warm dish preview ID used as Sanity document reference
- Client-supplied proposal with extra keys not in allowlist schema
- Currency/price fields differing from provider settings snapshot (if embedded)

### 6.3 G5d.3c deliverable

Pure module: `validateMappingDraftProposal(proposal): ValidationResult` + tests mirroring G5d.0 rejection cases.

---

## Part 7 — UI implications (future, not this phase)

G5d.2 panel today: always “live computed” — no persistence indicator.

**Future states (G5d.3e, explicit GO):**

| State | Copy (nb) |
|-------|-----------|
| No draft | “Ikke lagret” |
| `draft` | “Utkast” |
| `reviewed` | “Vurdert” |
| `archived` | “Arkivert” (history only) |

**Future primary action:** “Lagre vurdering som utkast” — **not** “Aktiver”, “Publiser”, “Bruk i meny”.

**G5d.3 audit constraints:**

- No buttons in G5d.3a–d
- No save wiring until G5d.3e
- Panel remains read-only for computed proposal; draft status is additive badge only

---

## Part 8 — G5d.3 risk map

| # | Risk | Likelihood | Consequence | Key files | Current guard | Missing guard | Mitigation | Required test (pre-impl) |
|---|------|------------|-------------|-----------|---------------|---------------|------------|-------------------------|
| 1 | Draft confused with runtime activation | Medium | Critical | Draft API, UI copy | G5d.2 shadow badges | Draft table naming + UI “utkast” | Never expose apply/publish actions; docs | E2E: save draft → menu-day unchanged |
| 2 | Publish imports draft JSON | Low | Critical | `lib/menu-publish/**` | G5d.0 import guard | Extend guard for draft module | Static import test | `assertNoForbiddenImports` on publish |
| 3 | `/week` reads draft | Low | Critical | `/api/week`, week loaders | No draft module exists | Keep zero imports | Contract test | Week response snapshot unchanged |
| 4 | Cross-provider draft leakage | Medium | Critical | RLS, API | N/A | Provider-scoped RLS + server context | Integration RLS tests uigx | Provider A cannot SELECT B draft |
| 5 | Provider sets canPublish=true in JSON | Medium | High | API validation | `assertNoRuntimeEnablement` | Schema validation on persist | Server recomputes proposal; reject client body | API rejects tampered payload |
| 6 | Loose JSONB unmigratable | Medium | Medium | DB schema | N/A | Version field + typed validation | Pin `mapping_version`; archive old | Fixture migration test |
| 7 | `provider_settings` overloaded | Low | Medium | settings | Separate column precedent | **Use dedicated table** | Design review | N/A |
| 8 | Role confusion (viewer writes) | Medium | High | RLS | Role hierarchy in app | Explicit admin-only INSERT/UPDATE policies | Match service_areas pattern | viewer POST → 403 |
| 9 | Stale draft after registry update | High | Low | UI | N/A | Warning banner on version mismatch | Show `mapping_version` in UI | Draft load shows stale warning |
| 10 | Production flag early enable | Low | Critical | Vercel env | All OFF in prod | New flag Preview-only default OFF | CI env guard | Production env scan |

---

## Part 9 — Recommended G5d.3 subphases

| Phase | Scope | DB | API | UI | Flag |
|-------|-------|----|----|-----|------|
| **G5d.3a** | Docs + schema/RLS design review | No | No | No | No |
| **G5d.3b** | Migration + RLS only | **Yes** | No | No | Staging deploy only |
| **G5d.3c** | Pure validation helpers | No | No | No | No |
| **G5d.3d** | API read/write behind flag | Uses table | **Yes** | No/minimal | `LP_MENU_PROFILE_RUNTIME_MAPPING_DRAFT` Preview-only |
| **G5d.3e** | UI “Lagre vurdering som utkast” | — | — | **Yes** | Same + requires G5d.2 flags |
| **G5d.3f** | Preview smoke + rollback + audit log wiring | — | — | — | Disable path documented |

**Flag proposal (G5d.3d+):**

`LP_MENU_PROFILE_RUNTIME_MAPPING_DRAFT` — requires resolver + runtime mapping proposal flags; default OFF; Preview/staging only until explicit Production GO (likely never before G5d.6).

---

## Part 10 — Recommended first PR

**Title:** `docs(menu-profile): add G5d.3 mapping draft persistence design`

**Contents:**

- This audit document (or refined subset after review)
- ERD sketch + RLS policy draft SQL in appendix (comment-only, not applied)
- Explicit “no runtime” checklist for reviewers

**Must NOT include:**

- Migration files
- API routes
- UI buttons
- Feature flag activation
- Production env changes

---

## Appendix A — Files inspected (read-only)

- `docs/engineering/G5d-menu-profile-cutover-audit.md`
- `lib/menu-profile/runtimeMapping.ts`
- `lib/menu-profile/runtimeMappingTypes.ts`
- `lib/menu-profile/featureFlag.ts`
- `lib/provider-menu/providerMenuRuntimeMappingProposal.ts`
- `components/providers/ProviderMenuRuntimeMappingProposalPanel.tsx`
- `components/providers/ProviderMenuBuilder.tsx` (save block via G5d.0 tests)
- `app/leverandor/meny/page.tsx`
- `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts`
- `tests/lib/menu-profile/runtimeMapping.test.ts`
- `tests/lib/provider-menu/providerMenuRuntimeMappingProposal.test.ts`
- `supabase/migrations/20260710120000_provider_config_foundation.sql`
- `supabase/migrations/20260725120000_provider_settings_menu_profile_id.sql`
- `supabase/migrations/20260714120000_provider_operational_contacts.sql`
- `supabase/migrations/_archive/20260520220000_provider_service_areas_admin.sql`
- `supabase/migrations/20260618120000_lp_company_lifecycle_strict_provider_gate.sql`
- `lib/auth/provider.ts`
- `lib/providers/loadProviderSettingsMenuProfile.ts`

## Appendix B — Files changed in this audit

- `docs/engineering/G5d3-mapping-draft-persistence-audit.md` (this file)

## Appendix C — Gates run

None — audit-only documentation. No product code, migration, or env changes.

---

**Recommendation:** **Safe next step** = G5d.3a docs PR + design review with RLS/security sign-off before G5d.3b migration.  
**Not safe** = combined migration + API + UI, or any draft data wired to publish/order/week.
