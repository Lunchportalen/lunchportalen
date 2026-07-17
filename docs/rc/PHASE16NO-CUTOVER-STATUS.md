# PHASE 16NO — CUTOVER STATUS

**Updated:** 2026-07-17T17:00:00Z  
**NORWAY_TAX_MODEL_STATUS:** `OWNER_APPROVED_WITH_OFFICIAL_SOURCE_SUPPORT`

## Owner tax decision

| Key | Value |
|-----|--------|
| OWNER_NORWAY_TAX_MODEL_CONFIRMATION | CONFIRMED |
| OWNER_ACCEPTS_NORWAY_TAX_CLASSIFICATION_RESPONSIBILITY | YES |
| ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER | YES |
| ACCOUNTANT_NORWAY_TAX_CONFIRMATION | NOT_REQUIRED_FOR_CUTOVER |
| Accountant confirmation required for cutover | **NO** |

Do **not** represent as accountant approved / externally reviewed / independently certified.

## MVA registration (factual)

| Key | Value |
|-----|--------|
| Legal name | LUNCHPORTALEN AS |
| Org.nr | 937155239 |
| LUNCHPORTALEN_MVA_REGISTERED | **NO** |
| PLATFORM_INVOICE_VAT_25_ENABLED | **FALSE** |
| Source | Brønnøysundregistrene Enhetsregisteret API |
| URL | https://data.brreg.no/enhetsregisteret/api/enheter/937155239 |
| Field | `registrertIMvaregisteret: false` |
| SHA-256 | `19032673fbeec4b6102ab97cb2207b74ddf018ba106828faaf13df3c788a9ed2` |
| Evidence | `docs/rc/phase16no/evidence/mva/` |
| Owner action | `docs/rc/phase16no/evidence/mva/OWNER_MVA_REGISTRATION_ACTION.md` |

## Release control

| Key | Value |
|-----|--------|
| Branch | `release/norway-first-live` |
| Pre-override tip | `f9fc96a156a90d06f510a9bfe79e663b7f9b74db` |
| SOURCE_RC_SHA | `b88aaf99780e0a5d71404e831fd87eb90031fb6e` |
| Migration range | `20260819120000` → `20260902120000` (exclude `20260901120000`) |
| Production baseline app SHA | `98b3b15e258966dd61ad967af5876982bcfcb959` |
| Production DB head (before) | `20260818120000` |
| Backup | PASS run `29598013983` (latest physical `1135896161`) |

## Progress

| Step | Status |
|------|--------|
| 1 MVA registration verify | DONE — NOT REGISTERED |
| 2 Production backup | PASS |
| 3 Isolated PITR restore rehearsal | SCHEMA branch created (`mackamwfbighrjlagyxs`); auto-migrations FAILED mid-chain; **data PITR not available via API** (`pitr: null`) |
| 4 Migration rehearsal | Staging owner/MVA gate apply + verify (in progress / PASS expected) |
| 5 Rollback/forward-fix | Pending |
| 6 Security/RLS/tenant gates | Pending |
| 7 Other 20 countries disabled | Code + DB trigger |
| 8 Exact-SHA dark deploy | Pending (Vercel lock) |
| 9 Existing prod functionality | Pending post-deploy |
| 10 Protected prod migrations | Pending |
| 11 Prod RLS/health | Pending |
| 12 Enable Norway only | Pending (ordering OK; real MVA invoice blocked) |
| 13–16 Canary math / refunds / no MVA basis | Pending |
| 17 Stripe = 0 | Policy locked |
| 18 Other countries disabled | Pending verify |
| 19 LIVE smoke | Pending |
| 20 Restore locks | Pending |
| 21 Monitoring | Pending |

## Expected final decision (given MVA = NO)

`NORWAY_TECHNICALLY_LIVE_PLATFORM_INVOICING_AWAITS_MVA_REGISTRATION`

(not `NORWAY_LIVE` until Merverdiavgiftsregisteret = YES)
