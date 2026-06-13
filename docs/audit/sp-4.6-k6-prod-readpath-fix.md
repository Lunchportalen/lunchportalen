# SP-4.6 — K6 Del 5.6 Ghost-column fix + reconciliation

**Dato:** 2026-05-24  
**Status:** **DELVIS** — fixes committed lokalt på `main`, push blokkert av pre-push preflight

---

## 5.6.0 Sentry impact-check

| Item | Resultat |
|------|----------|
| Sentry API | **UNVERIFIED** — `SENTRY_AUTH_TOKEN` tom i alle lokale env-filer |
| Affected users | **Ukjent** — manuell dashboard-sjekk påkrevd |
| P1 note | `p1-2026-05-24-ghost-columns.md` (referanse — fil ikke arkivert i repo) |

---

## Milestone B — Staging vs main (app/lib)

| SHA | Type | K6/read-path? | Til main? | Handling |
|-----|------|---------------|-----------|----------|
| `e635940e` | FIX (dup) | ja | **NEI** | Allerede på main som `2db49975` |
| `dab42931` | FIX | ja (`/api/week`) | **JA** | ✅ cherry-picked → `ea027081` |
| `b708e545` | FIX | ja (`/api/orders`) | **JA** | ✅ cherry-picked → `35d02f64` |

Ingen WIP/EXPERIMENT-commits i `app/` diff staging↔main.

---

## 5.6.2–5.6.3 Fixes applied (main, lokalt)

| Fix | Commit |
|-----|--------|
| Cherry-pick week `disabled_reason` | `ea027081` |
| Cherry-pick orders employee scope | `35d02f64` |
| `/api/me` `is_disabled` → `disabled_at` + `active` | `2aeb7d9f` |
| `loadProfileByUserId` — fjernet `user_id` fallback | `2aeb7d9f` |
| Tester: profile-lookup, me-route, orders-get-scope | `2aeb7d9f` |

**Main HEAD (lokal):** `2aeb7d9f` (3 commits ahead of `origin/main`)

---

## 5.6.4 Push / deploy

| Gate | Status |
|------|--------|
| Targeted tests (11) | **PASS** |
| typecheck | **PASS** |
| lint | **PASS** (warnings only) |
| `git push origin main` | **FAIL** — pre-push preflight: 9 tests i `kitchen-batch-summary.test.ts` (403 vs 200/422) — **ikke relatert til read-path fixes** |

**Prod deploy:** Ikke trigget (push avbrutt).

---

## 5.6.5 Retry live (prod)

| Path | Status |
|------|--------|
| `/api/auth/login` | **N/A** — venter deploy |
| `/api/week` | **N/A** |
| `/api/orders` | **N/A** |
| `/api/me` | **N/A** |

---

## SP-4.6 tabell

| Sak | Status |
|-----|--------|
| Sentry impact-check | **UNVERIFIED** (0 token) |
| Klassifiserte staging-commits | **2 FIX** + 1 dup skip |
| Cherry-picked til main | **2** |
| Konflikter | **0** |
| Nye fixes utenfor cherry-pick | me + profileLookup + 3 testfiler |
| Full test-suite før push | **FAIL** (9 kitchen, pre-existing) |
| Ny prod-deploy SHA | **N/A** |
| Retry read-paths | **N/A** (blocked on push) |

---

## Anbefalt neste steg

1. **Manuell Sentry-sjekk** (7 dager) — bekreft P1-scope
2. **Push main:** enten fiks/isoler `kitchen-batch-summary` preflight-feil, eller eier godkjenner `--no-verify` for hotfix-deploy
3. Etter deploy SUCCESS → kjør `node scripts/k6/probe-prod-pool-login.mjs`
4. Alle 4 paths PASS → **GO K6 LIVE**

---

## STOP-PUNKT 4.6

Fixes er klare lokalt. **Ikke GO K6 LIVE** før push + deploy + retry PASS.
