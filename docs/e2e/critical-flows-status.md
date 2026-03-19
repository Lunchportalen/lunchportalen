# Critical flows — E2E status

Principal E2E hardening view: which critical user flows are proven end-to-end, and what blocks the rest.

**Rules:** Small safe patches only; no broad refactor; no fake success. A few real E2E proofs are more valuable than many shallow tests.

---

## 1. Critical flows selected

| Flow | Why selected |
|------|----------------|
| **A. Login** | Auth is the gate to all protected surfaces; login loop = BLOCKING (AGENTS.md E5). |
| **B. Protected route redirect** | Unauthenticated must hit `/login?next=...`; no silent failure or wrong landing. |
| **C. Backoffice / content page loads** | CMS is product-critical; shell must load without crash. |
| **D. Editor save** | Content must persist through normal save path; “UI changed” is not proof. |
| **E. Key API-backed list page** | Employee week, admin dashboard, or orders list = core product surfaces. |
| **F. Order / business action** | Order create or cancel is business-critical where applicable. |
| **G. Admin or superadmin safe render** | Admin/superadmin must render without crash and show truthful state. |

---

## 2. E2E status per flow

| Flow | Status | Notes |
|------|--------|------|
| **A. Login** | **VERIFIED** | Login page renders, no loop; invalid creds show error, no redirect; with creds: login → leave /login, main visible. |
| **B. Protected redirect** | **VERIFIED** | Unauthenticated /week, /admin, /superadmin, /backoffice/content → /login?next=...; next param correct; external/evil next rejected. |
| **C. Backoffice load** | **VERIFIED** | With superadmin: backoffice content shell loads; all top-nav modules (Content, Releases, Media, …) load without crash or placeholder copy. |
| **D. Editor save** | **VERIFIED** | (1) ai-cms: SEO apply → Lagre → “Sist lagret” → reload → GET body has persisted meta. (2) Page builder append/replace → Lagre → GET blocks. (3) editor-save-smoke: title edit → Lagre → “Sist lagret” → GET title matches. |
| **E. API-backed list** | **VERIFIED** | Week page loads (employee); admin dashboard and admin orders load; superadmin/system loads. All require role creds. |
| **F. Order action** | **PARTIAL** | Orders **page loads** (employee + admin) verified. **Order create or cancel** not covered by E2E (no test that submits an order or cancels one). |
| **G. Admin/superadmin render** | **VERIFIED** | Admin dashboard, superadmin root, superadmin/system load; backoffice module smoke; no crash text, no placeholder “kommer snart”. |

---

## 3. Exact tests added (this pass)

- **`e2e/editor-save-smoke.e2e.ts`**  
  - **editor save (title):** superadmin → create page via API → open editor → fill “Sidetittel” with unique value → click Lagre → expect “Sist lagret” → GET `/api/backoffice/content/pages/:id` → assert `data.page.title` equals typed value.  
  - Proves: page loads, core interaction (edit + save), no hard crash, success state truthful, re-fetch returns saved value.

No other new tests; existing E2E already cover A–C, E, G and the heavier editor/AI flows in ai-cms.

---

## 4. Exact tests (existing) per flow

| Flow | File(s) | Test(s) |
|------|---------|---------|
| A. Login | `auth.e2e.ts` | login page no loop, next preserved, invalid creds error; `auth-role.e2e.ts` login + land (skip no creds); `core-flows.e2e.ts` login as employee/admin/superadmin → land. |
| B. Redirect | `auth.e2e.ts` | unauthenticated /week, /admin, /superadmin, /backoffice/content → login?next=...; `shells.e2e.ts` unauthenticated → login for week, orders, admin, superadmin, backoffice, driver, kitchen; `auth-redirect-safety.e2e.ts` next internal only, evil next rejected, role-disallowed next rejected. |
| C. Backoffice | `backoffice-smoke.e2e.ts` | each module loads, top nav; `core-flows.e2e.ts` backoffice content shell; `backoffice-content-tree.e2e.ts` tree + workspace + preview. |
| D. Editor save | `ai-cms.e2e.ts` | SEO apply → Lagre → Sist lagret → GET body; page builder append/replace → Lagre → GET blocks; **`editor-save-smoke.e2e.ts`** | title edit → Lagre → Sist lagret → GET title. |
| E. List pages | `core-flows.e2e.ts` | week, orders (employee); admin dashboard, admin orders; superadmin root, superadmin/system. |
| F. Order action | — | Only list load; no create/cancel E2E. |
| G. Admin/superadmin | `core-flows.e2e.ts`, `backoffice-smoke.e2e.ts` | As above. |

---

## 5. Blockers for remaining flows

| Flow | Blocker |
|------|---------|
| **F. Order create/cancel** | No E2E that submits an order or cancels one. Would require: seeded menu/slot/company data, auth as employee (or admin), stable selectors for create/cancel UI, and possibly date/slot handling. Not added in this pass to keep scope minimal. |
| **Authenticated runs in CI** | All login/role/backoffice/editor tests **skip** when `E2E_*` secrets are not set. CI runs them when secrets are configured; without secrets only unauthenticated + public tests run. |

---

## 6. Honest confidence level

- **Unauthenticated + public:** High. Redirects, login page, invalid creds, public front and /status are covered and run without secrets.
- **Authenticated (with creds):** High for login, role landing, backoffice load, editor save (title + AI/page-builder paths), week/orders/admin/superadmin load. Depends on real Supabase + seeded or created data for content/orders.
- **Order create/cancel:** Low. Only “orders page loads”; no proof that placing or cancelling an order works E2E.
- **Flakiness:** Editor and AI tests depend on network and API latency; timeouts (15–20 s) are used. No known fake success; failures indicate real breakage.

**Summary:** Critical paths (login, redirect, backoffice, editor save, key list pages, admin/superadmin render) are covered by real E2E. The main gap is order create/cancel; documenting it as PARTIAL and not adding fake coverage.
