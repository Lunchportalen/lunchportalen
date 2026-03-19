# Order flow verification map and status

Senior order-flow reliability view: UI trigger, request path, guard layer, persistence, status/receipt. Order flow is only marked VERIFIED where a real trigger and truthful result path are exercised (no silent false-success).

---

## 1. Order-flow map

| Layer | Detail |
|-------|--------|
| **UI trigger** | WeekClient (app/(portal)/week/WeekClient.tsx): loadWindow() → GET `/api/order/window?weeks=2`; setLunchForDay() → POST `/api/order/set-day` with { date, wants_lunch, choice_key, note }; setChoiceForDay() → POST `/api/order/set-choice`. Uses cookie auth (no scope header). Guards in UI: uiCanAct (billing hold), daySnapshot.isEnabled, daySnapshot.isLocked. |
| **Request paths** | **Primary (week UI):** GET order/window; POST order/set-day (place/cancel); POST order/set-choice. **Alternate:** POST orders/upsert (Idempotency-Key, date, slot, note); POST orders/toggle (date, action place|cancel, slot). order/cancel: POST (legacy day_choices cancel path). |
| **Guard layer** | **order/set-day:** getAuthedUserId() → 401; cutoffState(date) → 423 LOCKED; weekdayKeyOslo → 400 WEEKDAY_ONLY; profile/company → 403; contract tier/day → 403 DAY_NOT_ENABLED; variant gate → 400 MISSING_VARIANT; then lpOrderSet/lpOrderCancel. **order/set-choice:** assertCompanyActiveOr403; parseSetChoiceBody; validateCutoffAndWeekday → LOCKED. **orders/toggle:** scopeOr401 → 401; requireRoleOr403(orders.toggle), requireCompanyScopeOr403 → 403; isIsoDate → 400; cutoffStatusForDate (PAST, TODAY_LOCKED) → 403; getCompanyStatus (PAUSED, CLOSED, !ACTIVE) → 403; requireRule (agreement delivery_days, rule) → 403; then lpOrderSet/lpOrderCancel. **orders/upsert:** scopeOr401 → 401; requireRoleOr403(orders.upsert), requireCompanyScopeOr403 → 403; Idempotency-Key → 400; rate limit → 429; lpOrderSet → 409 (CUTOFF_PASSED, AGREEMENT_NOT_ACTIVE, DELIVERY_DAY_INVALID, etc.). **order/cancel:** getAuthedUserId → 401; cutoffState → 423; assertCompanyActiveOr403. |
| **Persistence path** | lpOrderSet / lpOrderCancel (lib/orders/rpcWrite.ts) → RPC lp_order_set / lp_order_cancel (Supabase). orders/upsert also uses idem_put for idempotency. |
| **Status/receipt path** | order/window returns days with orderStatus, wantsLunch, lastSavedAt. set-day response: receipt (orderId, status), date, wants_lunch, choice_key, updated_at. orders/toggle returns { order } from select after write. |

---

## 2. Status matrix

| ORDER FLOW AREA | STATUS | EVIDENCE | FAILURE LAYER | EXACT FILES INVOLVED |
|-----------------|--------|----------|---------------|----------------------|
| **Employee opens order surface (week)** | VERIFIED | E2E: core-flows "week page loads as authenticated employee" → /week, main visible. Window load: GET order/window in WeekClient; smoke-api-routes GET order/window non-500. | Auth redirect if unauthenticated. | WeekClient.tsx, app/api/order/window/route.ts; e2e/core-flows.e2e.ts, tests/api/smoke-api-routes.test.ts |
| **Allowed day/action evaluated safely** | VERIFIED | orders/toggle: cutoffStatusForDate PAST → 403 DATE_PAST, TODAY_LOCKED → 403 CUTOFF_LOCKED. order/set-day: cutoffState → 423 LOCKED; weekdayKeyOslo → 400. order/set-choice: validateCutoffAndWeekday → LOCKED (unit: order-set-choice-helpers.test.ts). | lib/date/oslo cutoffStatusForDate; set-day/set-choice cutoffState. | lib/date/oslo.ts, orders/toggle/route.ts, order/set-day/route.ts, order/set-choice/route.ts; tests/api/order-set-choice-helpers.test.ts |
| **Create order request (real path)** | PARTIAL | Week UI sends POST order/set-day (real fetch). No E2E that clicks place and asserts 200 + receipt or 4xx. API: orders/upsert and order/set-day require auth; upsert requires Idempotency-Key. **tests/api/order-api-guards.test.ts**: orders/upsert 401 without auth, 400 without Idempotency-Key (proves guard). | 401, 400, 423, 403, 409 from guards or lpOrderSet. | WeekClient.tsx (postJson set-day), order/set-day/route.ts, orders/upsert/route.ts; tests/api/order-api-guards.test.ts |
| **Response state truthful** | PARTIAL | Code: set-day returns receipt/date/status; window returns days[].orderStatus. No E2E that asserts success payload or error payload after action. | — | WeekClient (setLunchForDay success/error handling), set-day route |
| **Cancel/unorder path safe** | VERIFIED | orders/toggle: action "cancel" → lpOrderCancel; cutoff and company gates apply. ordersLifecycleGate: PAUSED/CLOSED → 403 (cancel and place). order/set-day: wantsLunch false → lpOrderCancel; same cutoff/auth. | COMPANY_PAUSED, COMPANY_CLOSED, CUTOFF_LOCKED, DATE_PAST. | orders/toggle/route.ts, order/set-day/route.ts, order/cancel/route.ts; tests/rls/ordersLifecycleGate.test.ts |
| **Forbidden/invalid state fails safely** | VERIFIED | orders/toggle: PAUSED → 403 COMPANY_PAUSED; CLOSED → 403 COMPANY_CLOSED; requireRule → 403 AGREEMENT_DAY_NOT_DELIVERY, AGREEMENT_RULE_MISSING (orderAgreementRulesGate.test.ts). order/set-day: invalid date 400, locked 423, WEEKDAY_ONLY 400, PROFILE_MISSING_SCOPE 403, DAY_NOT_ENABLED 403. orders/upsert: Idempotency-Key missing 400; lpOrderSet error → 409 with code. | All above. | orders/toggle, order/set-day, orders/upsert; tests/rls/ordersLifecycleGate.test.ts, tests/rls/orderAgreementRulesGate.test.ts, tests/api/order-api-guards.test.ts |
| **No silent false-success** | VERIFIED | Guards return 401/403/400/423/409 with ok:false and error code. Unit tests assert 403 and error code for PAUSED, CLOSED, AGREEMENT_DAY_NOT_DELIVERY, AGREEMENT_RULE_MISSING. orders/upsert stores idem response on 409. | — | All order routes; lifecycle + agreement gate tests |
| **Cut-off enforcement** | VERIFIED | orders/toggle: cutoffStatusForDate PAST/TODAY_LOCKED → 403. order/set-day: cutoffState(date).locked → 423. order/set-choice: validateCutoffAndWeekday. Unit: order-set-choice-helpers LOCKED when past date. | lib/date/oslo cutoffStatusForDate; set-day/set-choice local cutoff. | lib/date/oslo.ts, orders/toggle, order/set-day, order/set-choice; order-set-choice-helpers.test.ts |
| **Agreement-inactive / delivery-day block** | VERIFIED | orders/toggle: requireRule (delivery_days, rule) → 403 AGREEMENT_DAY_NOT_DELIVERY, AGREEMENT_RULE_MISSING (orderAgreementRulesGate.test.ts). order/set-day: company contract tier per day → 403 DAY_NOT_ENABLED. lpOrderSet can return AGREEMENT_NOT_ACTIVE, DELIVERY_DAY_INVALID (orders/upsert 409). | requireRule mock; company contract; RPC. | orders/toggle (requireRule), order/set-day (contract_week_tier), lib/orders/rpcWrite (mapOrderRpcErrorCode); orderAgreementRulesGate.test.ts |
| **orders/upsert guard (idempotency, auth)** | VERIFIED | Unit: order-api-guards.test.ts — unauthenticated → 401; missing Idempotency-Key → 400. | scopeOr401; Idempotency-Key header. | orders/upsert/route.ts; tests/api/order-api-guards.test.ts |
| **Order window (GET)** | VERIFIED | Smoke: GET order/window non-500. Tenant-isolation and buildDayModel tests. | scopeOr401; company/agreement in window. | order/window/route.ts; tests/api/smoke-api-routes.test.ts, tests/api/order-window-dayModel.test.ts, tenant-isolation-agreement |

---

## 3. E2E gap

- **No E2E** that clicks "Bestill" / "Avbryt" on week and asserts request sent and response (success or safe error). Employee week page **load** only (core-flows). Adding that would require seeded agreement/delivery day and optional cut-off bypass or future date; documented as PARTIAL for "create order request" and "response state truthful".

---

## 4. Exact files (summary)

| Role | Files |
|------|--------|
| Week UI | app/(portal)/week/WeekClient.tsx |
| Order API routes | app/api/order/window/route.ts, app/api/order/set-day/route.ts, app/api/order/set-choice/route.ts, app/api/order/cancel/route.ts, app/api/orders/upsert/route.ts, app/api/orders/toggle/route.ts |
| Guards / cutoff | lib/date/oslo.ts (cutoffStatusForDate, isIsoDate), lib/orders/rpcWrite.ts (lpOrderSet, lpOrderCancel, mapOrderRpcErrorCode), lib/agreement/requireRule, lib/guards/assertCompanyActiveApi |
| Tests | tests/rls/ordersLifecycleGate.test.ts, tests/rls/orderAgreementRulesGate.test.ts, tests/rls/companyAdminStatusGate.test.ts, tests/api/order-set-choice-helpers.test.ts, tests/api/order-window-dayModel.test.ts, tests/api/order-api-guards.test.ts, tests/api/smoke-api-routes.test.ts |
| E2E | e2e/core-flows.e2e.ts (week page loads) |
