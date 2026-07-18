# PHASE 17MENU.2B — REAL STAGING MENU CERTIFICATION

## Source

- Branch: `release/global-menu-universes-21`
- Release SHA: branch tip (see latest green `phase17menu2b-staging-cert` run)
- Worktree: `C:\prosjekter\lunchportalen-16no`
- Staging URL: GHA `next start` on exact SHA against staging Supabase `uigxsboqeruxflgzqztl`
- PR: https://github.com/Lunchportalen/lunchportalen/pull/504
- Supabase target: `uigxsboqeruxflgzqztl`
- Sanity target: `4udoq5d8` / `staging`
- Production mutations: **0**
- Production SHA (live health): `771a4207e9743fd232971eb95ecc27e45723a89d` (unchanged)

## Recipe banks

- Published recipes: **1155/1155**
- Structurally complete: **1155**
- Missing fields: **0**
- Provider-cost records: **0**
- Supplier/catalog records: **0**
- Country benchmarks / estimates: see `evidence/recipe-provenance-audit.json`
- Fabricated sources: **0**
- Country-specific banks: **21/21**
- Norway clone countries: **0**

## Market evidence

- Complete country dossiers: **21/21**
- Price evidence complete: **21/21**
- Menu evidence complete: **21/21**
- US / Canada regional clusters: present
- Missing citations: **0**

## Runtime

- Staging authentication: cookie session via `/api/auth/session` (Bearer alone returned 401)
- Entitlement runtime: `LP_PACKAGE_ENTITLEMENTS_RUNTIME=1` on GHA runtime (**ACTIVE** when health/build pass)
- Synthetic providers / companies: seeded on staging (21×3)
- HTTP package flows: see latest GHA artifact `http-certification-summary.json`
- Basis / Luxus / Enterprise: same
- Direct API bypasses: tracked in isolation report

## Pricing and commission

- Canonical rate: **500 bps**
- Snapshot / remainder / refund proofs: GHA artifact (required for TECHNICAL_PASS)

## Warm generation

- Generation-ready banks: **21/21**
- Eight-week country runs: **21/21**
- Days generated: **840**
- Days with fewer than 3 eligible: **0**
- Auto-publications: **0**

## Localization

- Live locale flows: GHA artifact
- Issue #503: remains open until 24/24 locale HTTP green

## Operations / concurrency / safety

- Phase 18 capacity packet: `docs/rc/phase18scale/OWNER-CAPACITY-TEST-PACKET.md`
- `GLOBAL_SCALE_CERTIFIED = NO`
- Production health PASS; Stripe off; other countries disabled (prior lock)

## Native review

- Native culinary approved: **0/21**
- Locale native approved: **0/24**

## Decision

**`GLOBAL_MENU_UNIVERSES_REVIEW_READY`**

Do not declare `GLOBAL_MENU_UNIVERSES_TECHNICAL_PASS` until the latest GHA staging HTTP cert shows **63/63** package flows + **24/24** locales + price/commission proofs + concurrency canaries, with production still untouched.

`OWNER_AUTHENTICATION_REQUIRED` only if Vercel preview alias deployment is mandated beyond GHA `next start` (repo lacks `VERCEL_TOKEN`).
