# TPT-B-7b-hotfix-5 — Verify-flyt observability (audit metadata)

**Dato:** 2026-05-22  
**Forrige:** hotfix-4 (`e21057a7`) — Basic auth username `0` for whoAmI

---

## Problem

Smoke-test viste fortsatt «Token avvist av Tripletex» uten å vite om feilen var:
- stale deploy
- session-create 401
- whoAmI 401 etter username-fix
- scope-feil

Audit-log lagret kun aggregat (`auth_ok`, `company_match_ok`, `scope_ok`). Tripletex HTTP-status og `developerMessage` gikk tapt.

---

## Fix

1. **`onboardingVerify.ts`** — bygger `audit_diag` per verify-forsøk:
   - `steps.session_create`, `steps.whoAmI`, `steps.company_match`, `steps.scope`
   - `step_failed`, `expected_company_id`, `actual_company_id`, `hotfix_version: b7-h5`
   - Aldri token-verdier; kun HTTP-status, path og Tripletex `developerMessage`

2. **Migration `20260605120000`** — RPC `lp_provider_test_tripletex_token` merger `audit_diag` inn i `lifecycle_audit_log.metadata` (bakoverkompatibelt med eksisterende toppnivå-felt).

---

## Metadata-struktur (audit-log)

```json
{
  "all_passed": false,
  "tripletex_company_id": 93310337,
  "auth_ok": false,
  "company_match_ok": false,
  "scope_ok": false,
  "step_failed": "whoAmI",
  "steps": {
    "session_create": { "http_status": 200, "path": "/token/session/:create", "error": null },
    "whoAmI": { "http_status": 401, "path": "/token/session/>whoAmI", "error": "..." },
    "company_match": null,
    "scope": null
  },
  "expected_company_id": 93310337,
  "actual_company_id": null,
  "hotfix_version": "b7-h5"
}
```

---

## Verifisering etter bruker-retry

```sql
SELECT metadata
FROM lifecycle_audit_log
WHERE entity_type = 'provider_tripletex'
  AND entity_id = '742c7d6c-3632-4362-a665-da0e415aab8c'
  AND action = 'tripletex_onboarding_test_token'
ORDER BY created_at DESC LIMIT 1;
```

Forvent `hotfix_version = b7-h5` og utfylte `steps`.
