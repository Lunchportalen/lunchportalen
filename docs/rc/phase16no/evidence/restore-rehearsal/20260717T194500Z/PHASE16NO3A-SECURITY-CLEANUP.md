# PHASE 16NO.3A — VERCEL TOKEN ROTATION & EVIDENCE SEAL

## Decision

**SECURITY_CLEANUP_PASS**

## Required results

| Field | Value |
|-------|-------|
| VERCEL_EXPOSED_TOKEN_REVOKED | **YES** |
| TOKEN_REPOSITORY_MATCHES | **0** |
| UNAUTHORISED_VERCEL_ACTIVITY | **0** |
| PRODUCTION_HEALTH | **PASS** |
| RESTORE_REHEARSAL | **PASS** |

## What happened

During Phase 16NO.3, a local Vercel CLI access token (`vca_…`, length 60) briefly appeared in a failed `vercel promote` command error stream. It was not committed to the repository.

## Actions taken

1. Fingerprinted the token (SHA-256 prefix only; value not stored in evidence).
2. Revoked via official API: `DELETE /v3/user/tokens/current` → HTTP 200; subsequent `/v2/user` → HTTP 403.
3. Wiped Vercel CLI `auth.json` (token + refreshToken nullified).
4. Cleared process env leftovers; confirmed GitHub `VERCEL_*` secrets absent.
5. Scrubbed Cursor terminal logs that contained fingerprint fragments.
6. Searched repository working trees, agent transcripts, and Phase 16NO.3 Actions logs for `vca_` patterns → **0** matches.
7. Did **not** create a replacement token (not required for production operations).
8. Preserved restore-rehearsal evidence pack under this directory.

## Production verification

- Health: `ok=true`, summary `ok`
- SHA: `38b18c38742e1b50eb727f6bf807e1a1499f69fb` (unchanged)
- Deploy / migration locks: ACTIVE per 16NO.1 lock evidence (no lock changes in 16NO.3A)

## Cost note

- Org project-create cost API (Supabase MCP): **USD 10 / month** (mirrored restore-to-new class).
- Exact invoice line for deleted recovery project `msecmoqfncvxrucnlpmm`: **confirm in Supabase Dashboard billing** (project already deleted).

## Owner follow-ups (non-blocking)

- Optional Vercel Dashboard activity review for 2026-07-17
- `vercel login` only when CLI is needed again
- Paste exact recovery-project charge into billing evidence when the invoice is available

## Secrets

No database passwords, service-role keys, or token values are stored in this report.
