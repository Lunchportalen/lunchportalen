# PHASE 17MENU.2 — LIVE STAGING RUNTIME CERTIFICATION

**Decision:** `OWNER_ACTION_REQUIRED`

Previous `GLOBAL_MENU_UNIVERSES_TECHNICAL_PASS` is **not accepted**.  
Working decision until live gates pass: **`GLOBAL_MENU_UNIVERSES_REVIEW_READY`**.

`TECHNICAL_PASS` is **not claimed**.

---

## Source

| Field | Value |
|-------|--------|
| Branch | `release/global-menu-universes-21` |
| Branch tip | `1061142b705fb78b772343636b9d220be02f923d` |
| Sanity project / dataset | `4udoq5d8` / `staging` |
| Staging Supabase | `uigxsboqeruxflgzqztl` |
| Production Supabase | `hkpokyapzarefrgqzkos` (**not mutated**) |
| Preview | `https://lunchportalen-3nq3g7kmc-lunchportalen.vercel.app` |
| Production deploy / migration | **NOT APPROVED** |
| Production mutations | **0** |

---

## Live gate summary (FAIL)

| Gate | Result |
|------|--------|
| COUNTRY_MENU_UNIVERSE_CONTENT | **0/21** |
| COUNTRIES_WITH_CATEGORY_SHELL_ONLY | **21** |
| COUNTRIES_WITHOUT_WARM_RECIPES | **21** |
| WARM_BANKS_PRESENT_IN_SANITY | **0/21** |
| REAL_CITATION_AUDIT | **FAIL** (synthesized observations) |
| HTTP_PACKAGE_FLOWS | **0/63** |
| LIVE_LOCALE | **0/24** |
| LIVE_WARM_GENERATION | **0/21** |
| NATIVE_CULINARY_APPROVED | **0/21** |
| LOCALE_NATIVE_APPROVED | **0/24** |
| LP_PACKAGE_ENTITLEMENTS_RUNTIME | **UNVERIFIED** (not proven ACTIVE) |
| Isolated 21×3 entitlement matrix | **FAIL** |
| Preview `/api/health` | **HTTP 302** (auth-gated) |
| Vercel CLI | logged out — no credentials |

---

## Sanity staging inventory (public GROQ)

| Count | Value |
|-------|------:|
| `lunchCategory` with `countryCode` | 126 |
| with items | 105 |
| `varmrett` / warm empty items | 21 |
| `mealIdea` | 0 |
| recipe docs | 0 |
| `marketProfile` | 0 |
| `menuDay` | 274 |
| `menuDay` with `countryCode` | 0 |
| `provider` | 1 |

Category item titles match shell pattern `^[A-Z]{2} (Sandwich|Salad box|Sushi|Poke bowl|Thai) [AB]$` (e.g. `AT Sandwich A`).  
Warm banks exist only as generated JSON under `docs/rc/phase17menu1/evidence/warm-banks/`, **not** as Sanity `mealIdea`.

---

## Staging Supabase (encoded hard facts)

| Table / signal | Count |
|----------------|------:|
| entitlements | 30 |
| enterprise_contracts | 0 |
| price_rules | 3 |
| remainder_carry | 0 |
| companies | 193 |
| providers | 53 |

These counts are **not** a 21×3 isolated country×package matrix.

---

## Market evidence audit

Dossiers and benchmarks under `docs/rc/phase17menu1/evidence/` contain synthesized markers:

- `source_ref` like `public_catering_observation_*`
- notes containing `Synthesized`
- menu observations like `observation N`

→ **real citation audit FAIL**.

---

## Evidence files

All under `docs/rc/phase17menu2/evidence/` (JSON, redacted, no secrets/PII):

- `sanity-content-inventory.json`
- `warm-recipe-inventory.json`
- `country-specificity.json`
- `market-evidence-audit.json`
- `http-runtime-status.json`
- `entitlement-runtime-status.json`
- `isolation.json`
- `norway-regression.json`
- `certification-matrix.json`
- `source-state.json`

Certify command: `npm run phase17menu2:certify` (exit code **1** while live gates fail).

---

## Owner actions required

1. **Vercel login** and set `LP_PACKAGE_ENTITLEMENTS_RUNTIME=1` on **preview/staging only** (never production without explicit approval).
2. Provide **preview auth bypass or test credentials** so unauthenticated/authenticated HTTP E2E can run (health currently 302).
3. **Approve seeding** full `mealIdea` / recipe banks into Sanity staging (replace category shells + empty warm categories).
4. **Replace synthesized market citations** in dossiers/benchmarks with real, auditable sources (remove `public_catering_observation_*` / “Synthesized” observations).

---

## Safety

- Production Supabase mutations: **0**
- Production deploy / migration: **NOT APPROVED**
- No deploy performed in this phase
- Secrets / PII in evidence: **0**
