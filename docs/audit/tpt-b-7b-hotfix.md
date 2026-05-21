# TPT-B-7b-hotfix — Service_role guard-order i B-7 RPCs

**Dato:** 2026-05-21  
**Forrige commit:** `72d18aab`  
**Migrasjon:** `supabase/migrations/20260604120000_tpt_b7_hotfix_guard_order.sql`  
*(Timestamp `20260604120000` — `20260527120000` var opptatt av `tpt_a7_admin_ui.sql`)*

---

## Rotårsak

Smoke-test avdekket `PERMISSION_DENIED` når `verifyTokenAction` kalte
`lp_provider_test_tripletex_token` via `supabaseAdmin()` (service_role).

`lp_assert_provider_admin_or_superadmin` bruker `auth.uid()` og kjørte **før**
`lp_is_elevated_caller()`-bypass. Service_role har `auth.uid() = NULL` → assert
feilet permanent før elevated-sjekken.

---

## FASE 1 — Audit (staging, post-fix verifisert)

| RPC | Guard-rekkefølge (før fix) | App-lag kaller | Trenger fix |
|-----|----------------------------|----------------|-------------|
| `lp_provider_test_tripletex_token` | assert → elevated | `supabaseAdmin()` (service_role) | **Ja** |
| `lp_provider_complete_tripletex_connection` | assert → elevated | `supabaseAdmin()` (service_role) | **Ja** |
| `lp_provider_complete_onboarding_provisioning` | elevated only | service_role (worker) | Nei |
| `lp_provider_finalize_tripletex_connection` | assert only | `supabaseServer()` (user JWT) | Nei |
| `lp_provider_disconnect_tripletex` | assert only | user JWT (når UI kobles) | Nei |
| `lp_provider_reconnect_tripletex` | assert only | user JWT (når UI kobles) | Nei |
| `lp_provider_get_connection_health` | `lp_assert_provider_member_read` | `supabaseServer()` (user JWT) | Nei |

**2 RPCs fikset** — begge med trusted-app-layer-mønster (Node verifiserer → service_role persisterer).

---

## Pattern (elevated FIRST)

```sql
if not private.lp_is_elevated_caller() and not public.is_platform_admin() then
  perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);
end if;
```

**Lærdom:** Guards som bruker `auth.uid()` må **alltid** sjekke `lp_is_elevated_caller()` først når RPC også skal kalles fra service_role.

Andre sjekker (trusted verification_result, env-validering, audit) er uendret.

---

## Migrasjon apply

| Miljø | Project ref | Applied (MCP) |
|-------|-------------|---------------|
| Staging | `uigxsboqeruxflgzqztl` | 2026-05-21 |
| Prod | `hkpokyapzarefrgqzkos` | 2026-05-21 |

Post-apply verifisering (staging): `lp_provider_test_tripletex_token` og
`lp_provider_complete_tripletex_connection` → `elevated-first`.

---

## Test-gap

Eksisterende `lp_provider_test_tripletex_token.test.ts` brukte
`authenticatedClient(fx.superadmin.accessToken)` — superadmin passerer
`lp_assert_provider_admin_or_superadmin` via `is_platform_admin()`.

Prod-flyt: app validerer `provider_admin` via user JWT → kaller RPC med **service_role**.
Denne klassen av bug fangetes ikke før smoke.

**Nye tester (+6):**

| Fil | Tester |
|-----|--------|
| `tests/db/lp_provider_test_tripletex_token.serviceRole.test.ts` | 4 |
| `tests/db/lp_provider_complete_tripletex_connection.serviceRole.test.ts` | 2 |

---

## Smoke-test — klar for retry

**Test 1 (verify token):** Etter staging redeploy skal `verifyTokenAction` fullføre uten
`PERMISSION_DENIED` når provider_admin er innlogget og Tripletex env er satt.

**Forutsetninger (staging):**

- `TRIPLETEX_PROVIDER_ENV=test`
- `TRIPLETEX_BASE_URL=https://api-test.tripletex.tech/v2`
- `TRIPLETEX_CONSUMER_TOKEN` satt
- Provider admin: `provadmin-a.*@test.lunchportalen.no` med `provider_memberships`

**URL:** https://staging.app.lunchportalen.no/leverandor/innstillinger/tripletex/koble-til
