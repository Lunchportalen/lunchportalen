# SP-4.5 — K6 Del 5.5 Prod Read-Path Diagnose (READ-ONLY)

**Dato:** 2026-05-24  
**Scope:** READ-ONLY — ingen prod-mutasjoner, deploys eller migrasjoner  
**Hypotese testet:** prod-deploy bak main vs schema-drift

---

## Milestone A — Prod deploy vs main

| Item | Verdi |
|------|-------|
| **Prod deploy** | `dpl_42qDAhTvGx8QicUWaxdT63J1LeKG` · Ready · ~17 min gammel (01:18 CET) |
| **Prod alias** | `app.lunchportalen.no` · `lunchportalen-git-main-lunchportalen.vercel.app` |
| **Prod deploy-SHA (inferert)** | **`3cf4e294`** — Vercel JSON mangler explicit git SHA; deploy-tid matcher main push (01:05 → 01:18) og `git-main`-alias |
| **Main HEAD** | **`3cf4e294`** `chore(k6): prod order_place threshold 3000ms` |
| **Commits bak (vs `b2b0e55b` kjent prod)** | **8** app/docs/k6 commits |
| **Inkluderer Del 2 app-fix (`2db49975`)?** | **Ja** — på main og i inferert prod-deploy |
| **Inkluderer orders-fix (`b708e545`)?** | **Nei** — kun på `staging`, ikke `main` |

### Commits `b2b0e55b..origin/main` som rører `app/api/` eller `lib/`

```
3cf4e294 chore(k6): prod threshold (scripts only)
f8f76c84 feat(k6): env-differentiated thresholds (scripts only)
2db49975 fix(dc-032): profiles.id + loadProfileByUserId (week/me/agreement/scope)
41e5b2c8 feat(perf): k6 suite (scripts only)
34ec4314 fix(dc-013): npm CVE patch
9d36fd21 fix(dc-026): tripletex flow1 flag
```

**Konklusjon A:** Prod er **ikke** generelt bak main — den kjører sannsynligvis **main HEAD**. Read-path-feil skyldes **delvis/incomplete fixes på main** og **staging-only commits**, ikke manglende deploy av hele Del 2.

---

## Root cause per endpoint

### 1. `/api/week` → 500 `PROFILE_LOOKUP_FAILED`

**Prod har Del 2-fix, men feilen er fortsatt reproducerbar.**

| Lag | Funn |
|-----|------|
| **Deploy-diff main vs staging** | `origin/main` week/route.ts selecter **`disabled_reason`** — kolonne finnes **ikke** i prod eller staging |
| **Staging** | Select uten `disabled_reason` → week fungerer (SP-3.6 baseline grønn) |
| **Helper** | `loadProfileByUserId` faller tilbake til `.eq("user_id", …)` når første query gir `{data:null, error:null}` — sekundær risiko |

**Root cause:** App-kode på **main** refererer ghost-kolonne `disabled_reason` → PostgREST-feil → 500. **Ikke schema-drift.**

---

### 2. `/api/orders` → 403

| Lag | Funn |
|-----|------|
| **main (prod)** | `requireCompanyScopeOr403` på `GET` og `POST` i `orders/today/route.ts` |
| **staging** | `b708e545` fjernet guard — employee scope inline |

**Root cause:** **`b708e545` ikke merget til main.** Prod deployer main → employee får 403.

---

### 3. `/api/me` → 403 `profile_missing`

| Lag | Funn |
|-----|------|
| **App** | `.select("role, company_id, is_disabled")` i `app/api/me/route.ts` |
| **Schema prod + staging** | `is_disabled` finnes **ikke** (identisk) |
| **Migrasjoner** | `rg is_disabled supabase/migrations/` → **0 treff** |

Del 2 (`2db49975`) fikset `.eq("user_id")` → `.eq("id")`, men beholdt `is_disabled` i SELECT.

**Root cause:** **App-kode mot ghost-kolonne** — aldri migrert, gjelder begge env. **Ikke staging-vs-prod schema-drift.**

---

## Schema-drift staging vs prod

| Tabell | Diff (K6-relevant) |
|--------|---------------------|
| profiles, companies, agreements, company_memberships, orders, day_choices | **0 kolonner** |

### Ghost-kolonner (app refererer, finnes i ingen env)

| Kolonne | Call-sites |
|---------|------------|
| `profiles.is_disabled` | `/api/me`, superadmin user-disable |
| `profiles.disabled_reason` | `origin/main` `/api/week` |
| `profiles.user_id` | `loadProfileByUserId` fallback |

**Kolonne-drift staging vs prod count: 0**

---

## Migration ledger

| Kilde | Antall |
|-------|--------|
| Repo | 267 |
| Prod | 98 |
| Staging | 63 |

**Migrasjoner som ROOT-cause-er read-path-feil: ingen** — feilene er app-kode.

---

## SP-4.5 oppsummering

| Funn | Verdi |
|------|-------|
| Prod-deploy-SHA vs main HEAD | **Lik** (inferert `3cf4e294`) |
| Commits bak (vs `b2b0e55b`) | **8** |
| Del 2 + orders-fix på prod? | Del 2 **ja** · orders **nei** |
| `/api/week` root cause | **`disabled_reason` ghost-kolonne på main** |
| `/api/orders` root cause | **`b708e545` staging-only** |
| `/api/me` root cause | **`is_disabled` ghost-kolonne (app)** |
| Schema drift staging vs prod | **0** (K6-tabeller) |

---

## Anbefalt sti

**☑ MEDIUM** — 2–3 små app-commits + main deploy + retest. **Ingen schema-migrasjoner.**

1. Fjern `disabled_reason` fra week select (match staging).
2. Cherry-pick/merge **`b708e545`** → main.
3. `/api/me`: bytt `is_disabled` → `disabled_at` / `active`.

**Ikke DEEP** — schema aligned; feil er main vs staging app-paritet.

---

## STOP-PUNKT 4.5

Ingen prod-endringer. **Vent bruker-GO** før fix-sesjon.
