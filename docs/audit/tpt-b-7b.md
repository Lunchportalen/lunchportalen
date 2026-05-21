# TPT-B-7b — Audit

**Patch:** TPT-B-7b — Direct wizard UI  
**Plan:** TRIPLETEX-PLAN-V1 v3.15  
**Date:** 2026-05-21  
**Status:** ✅ COMPLETED  
**Arch-doc:** `docs/architecture/tripletex-onboarding-strategy.md` § 4.1, 5.3, 8

---

## Route pattern

Established provider area uses **`app/leverandor/`** (not `app/(provider)/`):

| Route | Purpose |
|---|---|
| `/leverandor/innstillinger/tripletex/koble-til` | Direct wizard (provider_admin) |
| `/leverandor/innstillinger/tripletex/status` | B-7c placeholder dashboard |

Auth: existing `app/leverandor/layout.tsx` + per-page `hasProviderRole(..., 'provider_admin')`.

---

## Wizard architecture

| Layer | Implementation |
|---|---|
| Server page | `loadProviderConnectionState()` — resume by `connection_state` |
| Server actions | `app/leverandor/innstillinger/tripletex/koble-til/actions.ts` |
| Client shell | `components/provider/tripletex-wizard/DirectWizard.tsx` |
| Steps | Token+verify → Provisioning poll → Webhook secret → Success |

**Server actions vs route handlers:** Server actions only (matches `app/leverandor/faktura/actions.ts` pattern).

---

## Token handling

- Employee token stays in **DOM ref** during step 1 only — never React state, never URL/query.
- `verifyTokenAction`: Node verify + audit via `service_role` (`testAndRecordTripletexToken`).
- `completeConnectionAction`: **re-verify** in Node before `completeTripletexConnectionAfterVerify` (defense in depth).
- Logging: masked `tok_***{last4}` in dev only.
- Webhook secret: generated server-side via `lp_provider_rotate_webhook_secret` (B-6), shown once — **not** user-pasted from Tripletex (arch-doc § 4.1 / B-6 contract).

---

## Polling strategy

**Custom `useEffect` + `setInterval` (3s)** — no SWR/TanStack Query in provider area.

- Max duration: 5 minutes → timeout message + support link
- Unmount: clears interval (`mountedRef`)
- Backoff: doubles interval cap 30s on repeated health errors (5xx path via `HEALTH_FAILED` code)
- Completion signal: `onboarding_provisioning_complete_at` via service_role read in `getHealthAction`

---

## A11y

- `aria-live="polite"` on verify status + provisioning progress
- `role="alert"` on form errors
- Progress bar: `role="progressbar"` + `aria-current="step"`
- Copy buttons: explicit `aria-label`
- `prefers-reduced-motion`: progress steps have CSS override from foundation (no extra animation in wizard)
- Touch targets: `ds-btn` + form controls via existing provider styles

---

## CSS

Foundation tokens only: `ds-wizard__*`, `ds-verify-*`, `ds-status-badge--*`, `ds-secret-*`. No new classes added.

---

## Tests

| File | Cases |
|---|---|
| `tests/actions/tripletex-wizard-actions.test.ts` | 8 |
| `tests/components/DirectWizard.test.tsx` | 6 |
| `tests/e2e/tripletex-onboarding-happy-path.test.tsx` | 1 |

**E2E note:** MSW not in project dependencies; happy path uses **mocked server actions** in Vitest (jsdom). Playwright E2E deferred to B-7-final.

**Preflight:** 2485/2485 PASS (2470 baseline + 15 new).

---

## Out of scope (explicit)

- Reconnect / disconnect UI → TPT-B-7b-edge
- Marketplace redirect → TPT-B-7a
- Full health dashboard → TPT-B-7c
- Video / help-center content

---

## Next

1. **TPT-B-7b-edge** — reconnect/disconnect for DEGRADED/DISCONNECTED states  
2. **TPT-B-7c** — replace status placeholder with full dashboard  
3. **TPT-B-7a** — marketplace redirect endpoint (parallel)
