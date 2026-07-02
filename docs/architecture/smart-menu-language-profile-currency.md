# SMART-MENU — Employee language, provider menu profile, approved translations and contract currency

**Status:** SMART-0 — design + invariant tests only (**no runtime implementation**)  
**Date:** 2026-07-01  
**Owner:** Lunchportalen Engineering  
**Relates to:** ADR-019, [PROTECTED_GOLDEN_PATH.md](../PROTECTED_GOLDEN_PATH.md), PR #388 (merged), PR #389 (superseded / not merged)

---

## 1. Owner model (locked)

These four rules are **product law** for SMART-MENU. They override display shortcuts and must not be mixed in implementation.

| Rule | Owner | Effect |
|------|-------|--------|
| **Employee UI language** | Employee (cookie / `profiles.preferred_locale`) | Translates **employee menu display** only: approved titles/descriptions, category/allergen labels, help/status copy |
| **Menu profile** | Provider / catering company | Controls food culture, category defaults, warm dish bank, package composition, market defaults |
| **Currency** | Catering company country / contract | Follows agreement/provider commercial scope — **never** employee UI language |
| **Menu content translations** | Provider approval workflow | Employees see **approved** translations only; drafts/suggestions/rejected/stale never surface |

**Hard separation:** UI language may change what the employee **reads**. It must never change what the system **orders**, **prices**, **bills**, or **identifies**.

---

## 2. Non-goals for SMART-0

SMART-0 delivers **this document** and **governance invariant tests** only.

| Out of scope in SMART-0 | Notes |
|---------------------------|-------|
| Runtime implementation | No `/week`, `/api/week`, order, or provider UI changes |
| DB / RLS migration | No `menu_content_translations` table yet |
| Provider approval UI | Design only |
| Employee translation runtime | No approved overlay read model yet |
| Sanity schema changes | Original provider text stays in Sanity |
| G5d.8 | Not started; separate owner GO required |
| Cutover | No compatibility cutover activation |
| Source-of-truth switch | No menu profile runtime source switch |
| Auto-rollout | No staged employee exposure |
| Production flags | All `LP_MENU_PROFILE_*` remain **OFF** |
| Order write path changes | `choice_key` + `itemKey` invariant locked |
| PR #389 merge | Superseded — do not merge as employee meal translation |

**READY FOR SMART-1** only after SMART-0 is merged **and** owner gives explicit GO.

---

## 3. Current state (read-only audit, 2026-07-01)

### 3.1 Merged foundations

| Item | SHA / PR | What it locked |
|------|----------|----------------|
| **PR A — language/menu identity guards** | Merged on main | `tests/i18n/language-does-not-change-menu-identity.test.ts`, `tests/governance/language-menu-separation-contracts.test.ts` — menu APIs ignore UI locale for identity |
| **PR B — employee week language UX** | PR #388 @ `778bdf5320f7c13084d98ea8c6aa03b72527b8c8` | Employee `LocaleSwitcher` hidden; honest copy that menu text is provider original |

### 3.2 Superseded work

| Item | Status | Why superseded |
|------|--------|----------------|
| **PR #389** — `fix/employee-week-display-i18n-fallback` | **OPEN — do not merge as-is** | Client-side display-label fallback only; does **not** implement approved meal title/description translations, provider approval, menu profile selection, or contract/provider currency |

### 3.3 Runtime truth today

| Area | Current behavior |
|------|------------------|
| Employee menu text | Provider original text from Sanity / published menu pipeline — **no approved translation overlay** |
| Employee week language switcher | Hidden for employees (PR B) |
| Menu profile registry | `lib/menu-profile/**` — inert registry; `provider_settings.menu_profile_id` column exists; **all `LP_MENU_PROFILE_*` flags OFF** |
| Currency | Schema has `agreements.currency`, `provider_settings.default_currency`, `provider_price_rules.currency`; runtime is NOK-first pilot; **not driven by employee language** |
| Employee price visibility | Hidden — `/week` and order window remain price-free |
| Order write | `choice_key` + `itemKey` + server-side tier/price rules — stable keys only |
| G5d.8 / cutover | **Not started** — design in `docs/engineering/G5d7-compatibility-cutover-design-plan.md` only |

---

## 4. Four-layer architecture

SMART-MENU extends ADR-019 with an explicit **provider-approved translation layer** between UI language and menu profile.

```
┌─────────────────────────────────────────────────────────────────┐
│ A) Employee UI Language Layer                                   │
│    buttons, help, status — + approved menu display overlays     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ display only
┌───────────────────────────────▼─────────────────────────────────┐
│ B) Provider-approved Translation Layer                            │
│    original → draft/suggested → approved/rejected/stale           │
└───────────────────────────────┬─────────────────────────────────┘
                                │ never identity
┌───────────────────────────────▼─────────────────────────────────┐
│ C) Provider Menu Profile Layer                                    │
│    categories, warm dish bank, package composition, food culture  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ commercial separate
┌───────────────────────────────▼─────────────────────────────────┐
│ D) Commercial Locale / Currency Layer                             │
│    currency, VAT context, billing, Tripletex currency (future)    │
└─────────────────────────────────────────────────────────────────┘
```

### A. Employee UI Language Layer

**Controls:**

- Employee UI copy (navigation, buttons, errors, onboarding)
- **Approved** menu title display
- **Approved** menu description display
- Category display labels (when approved overlay or static i18n dictionary exists)
- Allergen display labels
- Help / status text on `/week`

**Must never control:**

- `category` key / slug
- `choice_key`
- `item_key` / `itemKey`
- `planTier`
- `provider_id` / provider scope
- `menuDay` identity
- Warm dish identity
- Order RPC args
- Price
- Currency
- VAT / MVA
- Commission / provisjon
- Invoice / billing

**Sources today:** `lp_locale` cookie, `profiles.preferred_locale`, `resolveAppLocale()` — UI only.

### B. Provider-approved Translation Layer

**Controls:**

- Original provider text (Sanity — immutable source)
- Suggested / draft translation (Postgres — provider-only)
- Approved translation (Postgres — employee-visible overlay)
- Rejected translation (Postgres — provider-only)
- Stale translation (hash mismatch — employee sees original until reapproved)
- Fallback to original provider text

**Employee can see:**

- Approved translation for selected employee UI locale
- Original provider text when no approved translation exists

**Employee must never see:**

- Draft
- Suggested
- Rejected
- Stale (recommended default: hide stale overlay; show original)
- Internal metadata (`approved_by`, workflow state)
- Provider approval UI state

**RLS principle:**

- Provider manages only own `provider_id` rows
- Employee reads approved overlays **only through server read model** (future SMART-3)
- Employee never queries translation table directly

### C. Provider Menu Profile Layer

**Controls:**

- Active menu profile
- Food culture defaults
- Available category defaults
- Warm dish bank
- Package composition (Basis / Luxus / Enterprise contents per profile)
- Market defaults
- Provider/company-specific menu setup

**Source order (future):**

1. `provider_settings.menu_profile_id` — primary provider-level choice
2. Optional agreement/company override — **only if explicitly added later**
3. Market default from `marketConfig`
4. Fallback: `norwegian_company_lunch` / existing NO seed (`PLAN_CATEGORIES` behavior)

**Must not be controlled by:**

- Employee UI language alone
- `lp_locale` or `profiles.preferred_locale`

**Rules:**

- Profile change affects **future published menus only**
- Existing orders remain stable
- Profile may affect categories, warm dish bank, package composition
- Profile cannot directly alter billing currency unless contract/market also says so

### D. Commercial Locale / Currency Layer

**Controls:**

- Currency (ISO 4217)
- VAT / tax context
- Billing / invoice basis
- Tripletex currency mapping (future — not full automation in SMART-0..3)
- Provider price rules display currency

**Future resolver:** `resolveCommercialCurrency(scope)`

**Source order:**

1. `agreement.currency` if present
2. Company / customer contract currency if present
3. `provider_settings.default_currency`
4. `marketConfig.defaultCurrency` (from `lib/commercial/marketConfigs.ts`)
5. Explicit **NOK** fallback for NO pilot

**Must never use:**

- `lp_locale`
- `profiles.preferred_locale`
- Employee selected UI language

**Rules:**

- Employee language never changes currency
- Employee payload continues to hide price/currency unless separate product policy changes
- Billing / Tripletex must use agreement/provider currency
- Order write receives **no** employee currency input

---

## 5. Translation data model — SMART-1 implemented (storage + RLS only)

**Hybrid model (locked):**

| Store | Role |
|-------|------|
| **Sanity** | Original provider text for menu days, items, catalog labels |
| **Postgres** | Approved translations, status, RLS, audit trail |

**Migration:** `supabase/migrations/20260728120000_menu_content_translations.sql`  
**DB evidence (housekeeping):** [smart-menu-smart-1-db-evidence.md](./smart-menu-smart-1-db-evidence.md) — staging migrate/typegen verified; prod migrate pending Production environment approval  
**Pure helpers:** `lib/smart-menu/translationStatus.ts` (hash + employee visibility contract — no runtime wiring)

### Table: `menu_content_translations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `provider_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE CASCADE |
| `source_kind` | text NOT NULL | CHECK: `menu_day`, `menu_day_item`, `category_label`, `allergen_label` |
| `source_ref` | text NOT NULL | Stable ref (Sanity id, slug, or composite key) |
| `field` | text NOT NULL | CHECK: `title`, `description`, `label` |
| `locale` | text NOT NULL | CHECK: nine `APP_LOCALES` short codes (`nb`, `en`, …) |
| `original_text` | text NOT NULL | Snapshot at provider edit |
| `original_text_hash` | text NOT NULL | `sha256:` digest for stale detection |
| `translated_text` | text NULL | Nullable until approved |
| `status` | text NOT NULL DEFAULT `missing` | CHECK: `missing`, `draft`, `suggested`, `approved`, `rejected`, `stale` |
| `approved_by` | uuid NULL | FK → `auth.users(id)` ON DELETE SET NULL; required when `status = approved` |
| `approved_at` | timestamptz NULL | Required when `status = approved` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | `tg_set_updated_at()` trigger |

**Unique constraint:** `(provider_id, source_kind, source_ref, field, locale)`

**Indexes:** `provider_id`; `(provider_id, locale, status)`; `(provider_id, source_kind, source_ref)`; partial `(provider_id, locale, status) WHERE status = 'approved'`

### RLS principles (SMART-1)

| Actor | Access |
|-------|--------|
| `service_role` | ALL (future server read model in SMART-3) |
| Platform admin | ALL via `is_platform_admin()` |
| Provider member | SELECT own `provider_id` via `can_access_provider()` |
| Provider admin | INSERT/UPDATE own `provider_id` via `provider_admin` membership |
| Employee | **No direct table access** — no employee policy; outsider SELECT returns zero rows |
| `anon` | REVOKED |

**No DELETE** for authenticated — lifecycle via `status` only.

### Employee direct access: denied

Employees must **never** query `menu_content_translations` directly. Future SMART-3 approved overlay is **server read model only** (`service_role` + `isEmployeeVisibleTranslation()` filter).

### Stale policy

- When Sanity/original text changes, recompute `original_text_hash` via `hashOriginalText()`
- If stored hash ≠ current hash → mark row `stale`
- Employee sees **original provider text** until provider reapproves
- **Default:** stale approved translations are **hidden** from employee (`isEmployeeVisibleTranslation` requires `approved` + hash match)

### SMART-1 non-goals (still locked)

- No provider approval API/UI (SMART-2)
- No employee `/week` overlay (SMART-3)
- No LocaleSwitcher re-enable
- No order write path changes
- No `LP_MENU_PROFILE_*` activation
- No G5d.8 / cutover / source-of-truth switch / auto-rollout

**Next phase:** SMART-2 — provider translation approval API/UI (explicit owner GO required)

---

## 6. Provider approval workflow (SMART-2 — design only)

Minimal future flow:

1. Provider sees original text (from Sanity)
2. Provider sees suggested translation (optional AI or manual draft — open decision)
3. Provider can edit, approve, or reject
4. **Approved** only becomes employee-visible (via server read model)
5. Rejected / draft / suggested remain provider-only
6. Original menu text in Sanity is **never mutated** by approval — overlay only
7. Provider chooses supported employee locales (field location TBD — see open decisions)

---

## 7. Menu profile source of truth (SMART-4 — design only)

| Priority | Source |
|----------|--------|
| 1 | `provider_settings.menu_profile_id` |
| 2 | Agreement/company override (future, explicit GO only) |
| 3 | Market default |
| 4 | `norwegian_company_lunch` / NO seed fallback |

**Invariants:**

- Employee language cannot change profile
- Profile changes affect future publish only
- Existing orders unchanged
- All activation behind `LP_MENU_PROFILE_*` flags — **default OFF** through SMART-3

---

## 8. Currency source of truth (SMART-5 — design only)

```ts
// Future — not implemented in SMART-0
resolveCommercialCurrency(scope: {
  agreementId?: string;
  companyId?: string;
  providerId: string;
  market?: MarketCode;
}): { currency: string; source: string }
```

**Resolution chain:**

1. `agreement.currency`
2. Company/customer contract currency
3. `provider_settings.default_currency`
4. `marketConfig.defaultCurrency`
5. NOK fallback (NO pilot)

**Forbidden inputs:** `lp_locale`, `profiles.preferred_locale`, employee request body.

---

## 9. Order identity invariant (Protected Golden Path)

Orders **always** use:

- `date` (service date)
- `choice_key`
- `item_key` / `itemKey`
- Provider / company / agreement scope (server-resolved)
- Server-side tier / price rules (`lp_order_set` validation)

Orders **never** use:

- Translated title
- Translated category label
- Employee locale
- AI suggestion text
- Provider translation draft

**Reference:** `lib/orders/resolveOrderDayItemPersist.ts`, `lib/orders/orderWriteGuard.ts`, `lib/validation/schemas.ts` — `orderWriteBodySchema` has no first-class locale/language/currency from client.

---

## 10. PR sequence

| Phase | Scope | Runtime | DB/RLS | Flags | Golden Path risk | Gates |
|-------|-------|---------|--------|-------|------------------|-------|
| **SMART-0** | Design doc + invariant tests | None | None | None | None | **Merged** PR #390 |
| **SMART-1** | `menu_content_translations` migration + RLS + pure helpers + governance tests | **None** | Yes — migration only | None | Low | migration review, governance tests |
| **SMART-2** | Provider approval API + UI | Provider routes | RLS enforce | None | Low | + provider E2E |
| **SMART-3** | Employee approved overlay in `/week` read model; re-enable LocaleSwitcher with honest behavior | Employee read | Read approved only | None | **Medium** — touch `/week` | golden-path, week-visual |
| **SMART-4** | Provider menu profile selection for future publish | Provider admin | `menu_profile_id` write | `LP_MENU_PROFILE_*` per phase GO | **Medium** — publish path | publish shadow tests |
| **SMART-5** | `resolveCommercialCurrency` + agreement wiring | Billing display | Optional columns | Commercial flags TBD | **High** — commercial | commercial-hardcodes-guard |
| **SMART-6** | End-to-end golden tests across translation + profile + currency | Full | Full | Per GO | **High** | `test:golden-path` 91/91 |

Each phase requires explicit owner GO. No auto-rollout between phases.

---

## 11. PR #389 handling

| Decision | Detail |
|----------|--------|
| **Do not merge PR #389 as-is** | Superseded by SMART-MENU program |
| **Recommended status** | Leave OPEN or mark superseded in PR discussion — **do not close without owner GO** |
| **Possible later cherry-pick** | Safe static display label dictionaries; governance tests — **not** meal translation |
| **Do not use PR #389 for** | Approved meal title/description, provider approval, menu profile, currency |

PR #389 branch: `fix/employee-week-display-i18n-fallback` — client `createEmployeeWeekDisplayLabels(locale)` only.

---

## 12. P0 safeguards

| Safeguard | Enforcement |
|-----------|-------------|
| No draft translation to employee | Server read model filters `status = approved` only |
| No locale → currency mapping | `resolveCommercialCurrency` ignores UI locale |
| No locale → menu profile mapping | Profile resolver ignores `lp_locale` |
| No translation as order identity | Order write uses keys only |
| No employee price/commercial exposure | Existing price-free `/week` contract |
| No cross-tenant translation leakage | RLS on `provider_id` |
| No `LP_MENU_PROFILE_*` activation in SMART-0..3 | Flags default OFF; governance tests |
| No cutover / auto-rollout without separate owner GO | Documented in G5d.7 plan |
| G5d.8 not started | No runtime hook activation in Production |
| Production flags not enabled | SMART-0 does not enable env flags |
| Full Tripletex automation not enabled | Currency resolver design only |

---

## 13. Open decisions (defer beyond SMART-0)

| Topic | Options | Recommended default |
|-------|---------|---------------------|
| Exact enum names | `source_kind`, `status` values | **Locked in SMART-1** migration CHECK constraints |
| `supported_employee_locales` storage | `provider_settings` JSON vs separate table | Defer to SMART-2 |
| Company override field name | `agreement.menu_profile_id` vs company settings | Defer to SMART-4 |
| AI suggestions in SMART-2 vs later | Provider UI with/without AI draft | Defer — manual draft minimum |
| Stale approved UX | Hide vs show with warning | **Hide stale; show original** |

---

## 14. Recommendation

**SMART-0:** merged (PR #390 @ `0ba9c0a8`).

**SMART-1 is complete when:**

- Migration `20260728120000_menu_content_translations.sql` is merged on `main`
- `tests/governance/smart-menu-translation-model-contracts.test.ts` passes
- Existing smart-menu architecture, language-menu separation, and Golden Path tests pass
- No `/week`, order write, provider approval UI, or employee overlay runtime ships in the same PR

**SMART-1 DB housekeeping:** see [smart-menu-smart-1-db-evidence.md](./smart-menu-smart-1-db-evidence.md). Staging (uigx) migrate + typegen verified; production migrate run [28614693722](https://github.com/Lunchportalen/lunchportalen/actions/runs/28614693722) awaits owner Production environment approval. Employee translations are **not** live.

**Do not start SMART-2, G5d.8, cutover, source-of-truth switch, auto-rollout, or PR #389 merge until owner gives explicit GO after SMART-1 merge.**

**READY FOR SMART-2 only after SMART-1 is merged and owner gives explicit GO.**
