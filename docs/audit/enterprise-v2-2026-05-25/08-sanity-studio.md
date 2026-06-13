# Fase H — Sanity Studio

**Audit:** Enterprise v2 · **Dato:** 2026-05-25  
**Metode:** READ-ONLY · alle `studio/schemaTypes/*` åpnet · GROQ inventory · webhook v2 re-verify  
**Status:** **COMPLETE** → STOP-PUNKT H

**Canonical studio path:** `studio/` (root) — **not** `studio/lunchportalen-studio/` (DEPRECATED, hardcoded projectId)

**Artifacts:**

- `tests/menu-service-day-webhook.test.ts` — webhook signatur v2
- `scripts/sanity-live.mjs` — release gate `npm run sanity:live`
- `studio/schema.json` — exported schema snapshot

---

## Coverage-ledger (Fase H)

| Scope | Filer åpnet | Coverage |
| --- | ---: | ---: |
| Schemas (11 types) | 12 / 12 (`index` + 11) | 100% |
| Studio config | `sanity.config.ts`, `deskStructure.ts`, `WeekPlanner.tsx` | 100% |
| GROQ call sites (`lib/`) | 11 filer | 100% |
| Webhook route + verify | 3 filer + test suite | 100% |
| F-LYV cross-ref | Tier 1/2 vendor docs | 100% |

---

# H.1 — Studio layout & schemas

## H.1.1 Deploy / config

| Fil | Rolle |
| --- | --- |
| `studio/sanity.config.ts` | `projectId` + `dataset` fra env; deskTool + structure |
| `studio/sanity.cli.ts` | CLI deploy |
| `studio/package.json` | `sanity dev` / build |
| `Directory.Packages.props` | Umbraco separate; Sanity uses `studio/package-lock.json` |
| `lib/cms/sanityStudioUrl.ts` | Default `https://{projectId}.sanity.studio` |

**Packages (studio):** `sanity` desk v3, `@sanity/icons`, SeoToolkit **not** in active studio config (only in umbraco17) — Sanity SEO is schema/runtime only here.

## H.1.2 Schema inventory (alle åpnet)

| # | Type | Fil | Formål | I prod GROQ? |
| ---: | --- | --- | --- | --- |
| 1 | `provider` | `provider.ts` | Supabase mirror (read-only sync) | ✓ menuDay/productPlan filter |
| 2 | `announcement` | `announcement.ts` | Driftsmeldinger | ✓ |
| 3 | `menu` | `menu.ts` | mealType metadata + **images** | ✓ |
| 4 | `productPlan` | `productPlan.ts` | Pris + allowedMeals | ✓ |
| 5 | `weekTemplate` | `weekTemplate.ts` | Uke-mal mon–fre | ✓ |
| 6 | `closedDate` | `closedDate.ts` | Stengte dager | **✗ runtime stub** |
| 7 | `page` | `page.ts` | Generisk side (legacy?) | **✗** |
| 8 | `pricingInfo` | `pricingInfo.ts` | Prisinfo blokk | **✗** |
| 9 | `lunchCategory` | `lunchCategory.ts` | Statiske kategorivariant | ✓ |
| 10 | `mealIdea` | `mealIdea.ts` | Varmmatbank (~500+ linjer) | ✓ cron/rollout |
| 11 | `menuDay` | `menuDay.ts` | Dagkort (WeekPlanner) | ✓ + webhook |

**Desk UI (`deskStructure.ts`):** Exposes only **Ukeplan** (custom tool), **menu**, **closedDate**, **announcement**. Other types edited via WeekPlanner / Vision / direct doc list — **not** full IA in desk.

**Legacy:** `studio/schemas/dish.ts` — **not** in `schemaTypes/index.ts` (orphan).

---

# H.2 — GROQ queries (full liste) + cache/revalidation

## H.2.1 Client config (`lib/sanity/client.ts`)

| Setting | Read client | Write client |
| --- | --- | --- |
| `useCdn` | **true** | false |
| `perspective` | **published** | published |
| Caching | Sanity CDN edge | N/A |

**Next.js:** Ingen `revalidateTag` / `unstable_cache` på Sanity menu reads. Routes using CMS data typically `export const revalidate = 0` or dynamic — **fetch-on-request** + Sanity CDN TTL.

## H.2.2 Query matrix

| ID | Query / funksjon | Fil | Type filter | Cache layer |
| --- | --- | --- | --- | --- |
| Q-01 | `announcement` active | `lib/cms/menuDay.ts` `getActiveAnnouncement` | announcement | CDN + duplicate Q-02 |
| Q-02 | `announcement` active | `lib/sanity/queries.ts` | announcement | CDN (duplicate) |
| Q-03 | `menuDay` by date | `getMenuForDate` | menuDay + provider + publish filters | CDN |
| Q-04 | `menuDay` dates[] | `getMenuForDates` | menuDay | CDN |
| Q-05 | `menuDay` range | `getMenuForRange` | menuDay | CDN |
| Q-06 | `menuDay` admin dates | `getMenuForDatesAdmin` | menuDay (no customerVisible) | CDN |
| Q-07 | `menuDay` date+planTier | `getMenuForDateAndPlan` | menuDay | CDN |
| Q-08 | `menu` by mealTypes | `getMenusByMealTypes` | menu + image URLs | CDN |
| Q-09 | `menu` single | `getMenuByMealTypeDirect` | menu | CDN |
| Q-10 | `productPlan` by name | `getProductPlan` | productPlan + provider | CDN |
| Q-11 | `weekTemplate` by name | `getWeekTemplate` | weekTemplate | CDN |
| Q-12 | `lunchCategory` active | `fetchActiveLunchCategoryRows` | lunchCategory | CDN |
| Q-13 | `mealIdea` bank | `fetchMealIdeaBank` | mealIdea + season/tier/cost | CDN (cron) |
| Q-14 | `menuDay` rollout existing | `runMenuWeekRolloutCore` | menuDay varmrett | CDN |
| Q-15 | `menuDay` cooldown titles | `fetchCooldownTitleKeys` | menuDay 28d window | CDN |
| Q-16 | `menuDay` uniqueness | `menuDay.ts` schema validation | menuDay | Studio write-time |
| Q-17 | `closedDate` | `getClosedDatesForDate` | — | **STUB → [] always** |

**Publish filters (menuDay):** `approvedForPublish == true && customerVisible == true && !drafts`

| ID | Sev | Funn |
| --- | --- | --- |
| H-CACHE-01 | P2 | **Ingen** app-level cache invalidation on webhook — relies on Sanity CDN propagation + next request |
| H-CLOSED-01 | P2 | `closedDate` schema + desk entry, but **`getClosedDatesForDate` always returns []** |
| H-DUP-01 | P3 | Duplicate `getActiveAnnouncement` (menuDay + queries.ts) |

---

# H.3 — Webhook signatur-validering (v2 re-verify)

## H.3.1 Route

**`POST /api/webhooks/sanity/menu-day`**

| Step | Implementering |
| --- | --- |
| Allowlist | `lib/server/auth/apiAllowlist.ts` — middleware **no session** |
| Secret | `SANITY_WEBHOOK_SECRET` — **500** if missing (fail-closed config) |
| Verify | `verifySanityWebhookSignature` → `@sanity/webhook` `isValidSignature` |
| Body | Raw UTF-8 text before JSON parse |
| Fail | **401** `INVALID_WEBHOOK_SIGNATURE` |

## H.3.2 Tests (`tests/menu-service-day-webhook.test.ts`)

| Case | Expected |
| --- | --- |
| Bad signature | 401 |
| Non-menuDay payload | 200 skip |
| Published menuDay | UPSERT sync |
| customerVisible=false | delete path |
| Idempotent repeat | 200 × 2 |

**v2 verdict:** **REELL** — matches v1 OK; no regression found.

| ID | Sev | Funn |
| --- | --- | --- |
| H-WEB-01 | — | Webhook signature **PASS** (v2 re-verify) |

---

# H.4 — Image pipeline + alt-text

## H.4.1 Schema

| Type | Image fields | Alt-text enforcement |
| --- | --- | --- |
| `menu` | `images[]`, legacy `image` | Hotspot only — **no required `alt` field** |
| `mealIdea` / `menuDay` | No image fields in hot path | N/A (text/nutrition) |
| Sanity asset | Default `alt` on asset | **Optional** — editor discretion |

## H.4.2 Runtime

GROQ projects URLs only:

```groq
"imageUrls": images[].asset->url,
"legacyImageUrl": image.asset->url
```

**No** `@sanity/image-url` builder in app — **no** `alt` fetched for `<img>`.

| ID | Sev | Funn |
| --- | --- | --- |
| H-IMG-01 | P2 | Menu images served **without alt pipeline** — a11y/SEO gap for employee menu surfaces |
| H-IMG-02 | P3 | No image CDN transform params (width/quality) in GROQ |

---

# H.5 — Studio access control

## H.5.1 In-repo evidence

| Control | Status |
| --- | --- |
| Sanity project members / roles | **Not in repo** — managed at [sanity.io/manage](https://sanity.io/manage) |
| SSO / SAML | **Not configured** in `sanity.config.ts` |
| 2FA | **Sanity account-level** — not verifiable from git |
| `SANITY_WRITE_TOKEN` | Server-only env — used by `requireSanityWrite()` |
| Studio URL | Public `{projectId}.sanity.studio` — auth gate is **Sanity login** |

## H.5.2 Write paths

| Path | Auth |
| --- | --- |
| Sanity Studio UI | Sanity user session |
| `requireSanityWrite()` / scripts | `SANITY_WRITE_TOKEN` |
| Webhook inbound | HMAC signature |

| ID | Sev | Funn |
| --- | --- | --- |
| H-ACL-01 | P2 | **No documented** Sanity role matrix in compliance pack (who can publish menuDay) |
| H-ACL-02 | P2 | Write token in env — rotation procedure in `scripts/security/rotate-checklist` but **not** proven executed |

---

# H.6 — F-LYV cross-reference (Sanity-related claims)

| Claim (kilde) | Sanity-relevans | v2 verdict |
| --- | --- | --- |
| F-LYV-01…07 | **Ingen direkte** Sanity reference | N/A |
| **SoA A.15** / **VENDOR_MANAGEMENT** | Lists Sanity as vendor + DPA | **PARTIAL** — no Sanity SOC2/DPA artifact in repo |
| **COMPLIANCE_OVERVIEW §3** | Sanity (innhold) | **REELL** — used for menu CMS |
| **ENTERPRISE_RFP §8** | Sanity CMS vendor | **PARTIAL** — no access-control evidence attached |
| **SOC2 CC6** «Implementert» | CMS publish → webhook → DB | **PARTIAL** — webhook OK; closedDate/runtime gaps |
| Implied «content moderation» | — | **Not claimed** explicitly |

**Ingen ny LYVENDE** purely on Sanity — gaps are **PARTIAL** (vendor/access documentation).

| ID | Sev | Funn |
| --- | --- | --- |
| H-LYV-01 | P2 | Vendor docs list Sanity but **no** studio ACL / token rotation evidence for DD |

---

# Fase H — funn-oppsummering

| ID | Sev | Rolle | Funn |
| --- | --- | --- | --- |
| H-WEB-01 | — | SANITY | Webhook signature verified (PASS) |
| H-CLOSED-01 | P2 | SANITY | closedDate schema unused at runtime |
| H-CACHE-01 | P2 | SANITY | No app cache invalidation on publish |
| H-IMG-01 | P2 | SANITY | Menu images without alt in schema/GROQ |
| H-ACL-01 | P2 | SANITY+COMPLIANCE | No Sanity role matrix in compliance pack |
| H-ACL-02 | P2 | SANITY | Write token rotation not evidenced |
| H-LYV-01 | P2 | COMPLIANCE | Vendor claim vs missing Sanity ACL evidence |
| H-DUP-01 | P3 | SANITY | Duplicate announcement query |
| H-IMG-02 | P3 | SANITY | No image transform params |
| H-DESK-01 | P3 | SANITY | Desk exposes subset of schema types |
| H-LEGACY-01 | P3 | SANITY | `page`/`pricingInfo` schemas unused in GROQ |

---

## Completeness

| Item | Status |
| --- | --- |
| All 11 schemaTypes opened | **COVERED** |
| GROQ inventory (17 queries) | **COVERED** |
| Webhook v2 re-verify | **COVERED** |
| Image + alt audit | **COVERED** |
| Studio ACL / 2FA | **COVERED** (out-of-repo noted) |
| F-LYV Sanity cross-ref | **COVERED** |

---

## STOP-PUNKT H

**Fase H COMPLETE.**

**Kumulativ severity:** **2 P0** · **22 P1** · **53 P2** · **11 P3**.

**Neste:** Vent **`GO Fase I`** (`99-executive-summary-v2.md`) — blocked until I.

*READ-ONLY — ingen studio/schema/webhook endringer i denne sesjonen.*
