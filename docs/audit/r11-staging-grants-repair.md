# R11: Staging Core-Table GRANTs Repair

**Date:** 2026-05-21  
**Migration:** `supabase/migrations/20260524120000_staging_repair_core_table_grants.sql`  
**Commit:** `dd52f5fe`  
**Apply:** Staging only (`uigxsboqeruxflgzqztl`) — prod had correct GRANTs

## Rotårsak

B3a staging-reroll (2026-05-20) gjenopprettet schema fra `pg_dump`, men ikke standard Supabase/PostgREST ACL for `anon` og `service_role`. `authenticated` fikk delvise grants senere via `20260517212645_grant_authenticated_private_rls_helpers.sql`; `anon` og `service_role` ble aldri reparert.

## Symptom

- 11 preflight-tester feilet med `42501 permission denied` (før RLS)
- Spesielt: `database-integrity`, `superadmin.agreements-lifecycle`, `editorAiMetricsPersistence`
- PostgREST-hint: `GRANT SELECT ON public.companies TO anon/service_role`

## Diagnose (pre → post staging)

| Rolle | `companies` SELECT (pre) | `companies` SELECT (post) |
|-------|--------------------------|---------------------------|
| anon | false | true |
| service_role | false | true |
| authenticated | true | true |

**Pre** (`information_schema.role_table_grants`): kun `authenticated` + `postgres` på kjerne-tabeller.

**Post:** 22 grant-grupper — 7 tabeller × (`anon` + `authenticated` + `service_role`) + `outbox`/`audit_events` × `service_role`.

Prod reference (`hkpokyapzarefrgqzkos`): `anon`, `authenticated`, `service_role` hadde full CRUD på `companies`, `orders`, etc.

## Fix

`20260524120000_staging_repair_core_table_grants.sql` — kun `GRANT` (ingen DDL/RLS):

- `companies`, `company_locations`, `profiles`, `agreements`, `orders`, `idempotency`, `ai_activity_log` → `anon`, `authenticated`, `service_role`
- `outbox`, `audit_events` → `service_role` only (matcher prod)

## Verifisering

| Suite | Før GRANT-fix | Etter GRANT-fix |
|-------|---------------|-----------------|
| `database-integrity` (6 GRANT-relaterte) | 6 fail (`42501`) | 7/7 PASS |
| `editorAiMetricsPersistence` | 1 fail | 1/1 PASS |
| `superadmin.agreements-lifecycle` | 4 fail (`42501`) | 4/4 PASS (etter test harness + `audit_events` grant) |
| Full `npm run preflight` | 11 fail | **2342/2342 PASS** |

Tillegg: integrasjonstester justert for `provider_id NOT NULL` (Patch 5) og PostgREST RLS-tom-resultat (`error === null`, 0 rader).

## Forhindre repeat

- B3a-reroll-scripts bør inkludere standard PostgREST GRANTs som del av schema restore
- Eventuelt: eget seed/repair-script etter dump-restore (denne migrasjonen som mal)
