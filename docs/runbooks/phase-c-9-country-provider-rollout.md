# Phase C — 9-country provider rollout control

**Status:** CONTROL PLAN · **SOT NO-GO** · **Auto-rollout NO-GO**  
**Date:** 2026-07-06  
**Main HEAD (control release):** includes PR #430 provider mirror preflight + PR #431 smoke evidence  
**Companion evidence:** [`docs/evidence/phase-c-9-country-launch-readiness-plan.md`](../evidence/phase-c-9-country-launch-readiness-plan.md)

Enterprise operator control for onboarding remaining launch locales. **Not** authorization to apply menu weeks, start SOT, or auto-rollout.

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded.**

---

## 1. Rollout order (recommended)

Covered (do not re-onboard / do not mutate):

| Order | Locale | Profile | Provider |
|------:|--------|---------|----------|
| — | `nb-NO` | `norwegian_company_lunch` | Melhus Catering AS (protected) |
| — | `sv-SE` | `swedish_lunch` | Swedish Lunch Pilot (protected) |

Remaining (Phase C sequence):

| Order | Locale | Profile | Country/Currency | Safe week (planning) |
|------:|--------|---------|------------------|----------------------|
| 1 | `da-DK` | `danish_office_lunch` | DK/DKK | `2031-11-03` |
| 2 | `fi-FI` | `finnish_office_lunch` | FI/EUR | `2031-11-10` |
| 3 | `en-GB` | `uk_office_lunch` | GB/GBP | `2031-11-17` |
| 4 | `de-DE` | `german_business_lunch` | DE/EUR | `2031-11-24` |
| 5 | `fr-FR` | `french_dejeuner` | FR/EUR | `2031-12-01` |
| 6 | `es-ES` | `spanish_menu_del_dia` | ES/EUR | `2031-12-08` |
| 7 | `it-IT` | `italian_office_lunch` | IT/EUR | `2031-12-15` |

Reason: finish Nordic → English market → larger EU language markets.

---

## 2. Provider onboarding factory

Planner/tests:

- `lib/provider-onboarding/*`
- Confirmation phrase: `ONBOARD_PROVIDER_APPLY`
- Protected providers: Melhus + Swedish Lunch Pilot (never mutated)

CLI:

```bash
# Authoritative operator dryRun — live read-only snapshot (default)
# Production readiness: pass --env-file .env.preview.verify (overrides local staging env).
# Prefer --flag=value for names with spaces (PowerShell-safe).
node scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs \
  --dry-run \
  --snapshot-source=live \
  --env-file=.env.preview.verify \
  --providerName="Danish Lunch Pilot" \
  --providerSlug=danish-lunch-pilot \
  --locale=da-DK \
  --menuProfileId=danish_office_lunch \
  --country=DK \
  --currency=DKK \
  --timezone=Europe/Copenhagen \
  --adminEmail=danish-lunch-pilot-admin@lunchportalen.no \
  --safeFutureWeek=2031-11-03

# Apply mode validates confirmation, but live writes stay GATED unless scoped GO sets:
# PHASE_C_ALLOW_LIVE_ONBOARD=1 and approved live adapters are enabled.
node scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs \
  --apply --locale=da-DK --confirm=ONBOARD_PROVIDER_APPLY
```

### Snapshot sources

| Source | Use |
|--------|-----|
| `live` (**default** for `--dry-run`) | Read-only Supabase + Sanity preflight. Authoritative for operator readiness. |
| `fixture` | Tests / CI only. **Not** production operator readiness. |

Rules:

- Official production-like dryRun **must** use `--snapshot-source live` (or omit the flag — default is live).
- Live dryRun is **read-only** (providers / settings / auth email presence / global templates / inventory).
- Live dryRun does **not** require `PHASE_C_ALLOW_LIVE_ONBOARD=1`.
- Empty snapshot is **never** used silently for production-like dryRun.
- Fixture snapshot is for unit tests only.
- da-DK apply GO is **blocked** until official CLI live dryRun PASS is archived.
- Production Supabase inventory is always paired with **production** Sanity dataset (operator packs that mix `NEXT_PUBLIC_SANITY_DATASET=staging` with production Supabase are auto-aligned; output includes `liveReadEnv`).
- Mirror id/slug evaluation uses the same PR #430 `providerMirrorPreflight` rules (normalized id/slug). No fake READY.

### DryRun mode

- No writes (`writes=0`, `liveWrites=false`)
- Live-read validates provider slug/name/email conflicts against real state
- Live-read validates global Sanity templates
- Validates locale/profile/country/currency/timezone mapping
- Validates required env presence **without printing values**
- Emits write plan + rollback/deactivation plan as JSON
- Emits `localeClassificationBeforeOnboarding` (da-DK = `BLOCKED_PROVIDER` before onboarding)
- Emits `exactNextGoPrompt`
- `willCreateMenuDays=false`, `willPublish=false`, `willStartSot=false`

### Apply mode (onboarding only — not menu apply)

Creates only:

1. provider (`lp_provider_create` path)
2. organizations mirror
3. `provider_settings`
4. provider_admin auth (+ profile)
5. `provider_memberships`
6. `syncProviderToSanity` + read-only verify

Does **not**:

- create menuDays
- publish
- start SOT
- auto-rollout
- touch Melhus / Swedish Lunch Pilot

Credentials: store admin password in operator-local env only (`DA_DK_PROVIDER_ADMIN_*` pattern). Never print passwords.

---

## 3. Provider gates (before menu dryRun)

| Gate | Required |
|------|----------|
| Supabase provider | Exists |
| Organizations mirror | `id=providerId`, `type=provider` |
| `provider_settings` | locale / menuProfileId / country / currency / timezone complete |
| Provider admin auth | Exists |
| Provider membership | `provider_admin` for that provider |
| Sanity provider mirror | Exists via `syncProviderToSanity` |
| Mirror id/slug | Matches Supabase |
| providerRef | Resolves |
| Global templates | Present |

---

## 4. DryRun gates (generator)

| Gate | Required |
|------|----------|
| `dryRun=true` | Strict `create_missing_only_strict` |
| Far-future week | Year ≥ 2031, Monday |
| HTTP | 200 |
| `providerMirrorPreflight.ok` | `true` |
| `safeToApply` | `true` |
| `applyBlocked` | `false` |
| Catalog updates | Expect 0 for idempotent paths when catalog already exists |
| Mutation | None |
| Economy / metadata exposure | None |

---

## 5. Menu apply gates

Separate **scoped GO only**. Require:

1. Onboarding complete + mirror verified
2. Generator dryRun PASS with `safeToApply=true`
3. Evidence archive of dryRun
4. Explicit apply GO (one provider · one week)
5. PR #430 preflight remains enforced in code

---

## 6. Evidence gates

Archive after:

1. Onboarding dryRun plan (factory)
2. Onboarding apply (if any, scoped GO)
3. Generator dryRun PASS
4. Generator apply PASS (scoped GO)

---

## 7. SOT gate

**NO-GO** until:

- all 9 locales have providers with valid mirrors
- all 9 pass generator dryRun with `safeToApply=true`
- no partial providers
- separate SOT design/GO

---

## 8. Auto-rollout gate

**NO-GO** until separate final design/GO after SOT readiness.

---

## 9. Known risk

`syncProviderToSanity` remains mandatory before first generator apply for new providers. Apply does **not** auto-sync. PR #430 preflight blocks missing mirrors with structured errors (no HTTP 500 empty body).
