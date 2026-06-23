# 🧠 LUNCHPORTALEN – ARCHITECTURE DECISIONS (ADR)

Dette dokumentet beskriver arkitektoniske beslutninger som er tatt i Lunchportalen.

Hver beslutning følger formatet:

- Context
- Decision
- Consequences

Målet er å:

- Dokumentere hvorfor systemet er bygget slik
- Hindre utilsiktet arkitektur-drift
- Sikre konsistens over tid
- Gi revisjons- og investorklarhet

---

# ADR-001 – Database-first enforcement

## Context
Forretningsregler (cut-off, avtale, tenant-isolasjon) kan ikke overlates til frontend eller API-lag alene.

## Decision
All kritisk logikk håndheves på databasenivå via:

- RLS
- RPC
- Composite FK
- UNIQUE constraints

## Consequences
+ Systemet er deterministisk
+ Ingen UI-bypass mulig
+ Fail-closed
− Mer kompleks SQL
− Krever sterk CI og dokumentasjon

---

# ADR-002 – RPC-only writes for orders

## Context
Direkte writes i API-ruter skaper risiko for bypass av avtale/cutoff.

## Decision
All skriveoperasjon på `orders` skjer via:

- `lp_order_set`
- `lp_order_cancel`

Direkte `.insert/.update` er forbudt i produksjonskode.

## Consequences
+ Idempotens
+ Konsistent feilrespons
+ Ingen skjulte writes
− Krever CI-guard

---

# ADR-003 – No DELETE on orders

## Context
Bestillinger må være sporbare.

## Decision
Orders slettes aldri.
Status settes til `CANCELLED`.

## Consequences
+ Revisjonsspor
+ Ingen tap av historikk
− Tabellvekst håndteres via retention/partisjonering

---

# ADR-004 – Multi-tenant via company_id

## Context
Lunchportalen er B2B multi-tenant.

## Decision
Tenant-isolasjon håndheves via:

- company_id
- location_id
- Composite FK
- RLS

## Consequences
+ Ingen cross-tenant leak
+ Skalerbar modell
− Kompleksitet i policies

---

# ADR-005 – Fail-Closed Cut-off Enforcement

## Context
Cut-off 08:00 er kjerne i forretningsmodellen.

## Decision
Cut-off håndheves i DB (timezone Europe/Oslo).

## Consequences
+ Ingen manuelle unntak
+ Forutsigbar drift
− Krever presis tidshåndtering

---

# ADR-006 – Service-role allowlist

## Context
Service-role kan omgå RLS.

## Decision
Service-role er kun tillatt i:

- cron
- system/superadmin
- migrations
- workflows

CI stopper brudd.

## Consequences
+ Ingen utilsiktet bypass
+ Sikker rollebruk
− Krever streng repository-disciplin

---

# ADR-007 – Single Active Agreement per Location

## Context
Flere ACTIVE avtaler skaper uklarhet.

## Decision
Partial unique index:

(company_id, location_id) WHERE status='ACTIVE'

## Consequences
+ Entydig avtalegrunnlag
+ Ingen tvetydighet
− Krever korrekt avtaleprosess

---

# ADR-008 – No-exception rule

## Context
Manuelle unntak skaper systemisk risiko.

## Decision
Systemet tillater ingen manuelle overstyringer.

## Consequences
+ Forutsigbarhet
+ Enklere skalering
− Mindre fleksibilitet i edge cases

---

# ADR-009 – Write-minimal design

## Context
Høy write-kompleksitet skaper race conditions.

## Decision
Orders har to write-paths.
Resten er read-heavy.

## Consequences
+ Lav risiko
+ Skalerbarhet
+ Enkel debugging
− Krever presis RPC-implementasjon

---

# ADR-010 – Logging via ops_events

## Context
Kritiske endringer må være sporbare.

## Decision
Alle mutations logges i `ops_events`.

## Consequences
+ Revisjonsspor
+ Incident-analyse
− Økt log-volum

---

# ADR-011 – Partition-ready orders

## Context
Orders vokser lineært.

## Decision
Designet er kompatibelt med fremtidig RANGE partition.

## Consequences
+ Fremtidssikker
+ Ingen redesign nødvendig
− Ikke aktivert før nødvendig

---

# ADR-012 – Enterprise CI hardening

## Context
Utviklerfeil er største risiko.

## Decision
CI stopper:

- Service-role misuse
- Direct order writes
- Tenant-isolation brudd

## Consequences
+ Arkitekturbeskyttelse
+ Langsiktig stabilitet
− Krever disiplin

---

# ADR-013 – Deterministisk API-kontrakt

## Context
Stille feil er uakseptabelt.

## Decision
Alle RPC returnerer strukturert:

- code
- message
- rid
- timestamp

## Consequences
+ Forutsigbarhet
+ Debugging enklere
− Streng API-standard

---

# ADR-014 – No implicit admin overrides

## Context
Admin kan fristes til å overstyre bestillinger.

## Decision
Company_admin kan ikke endre ansattes ordre.

## Consequences
+ Modellbeskyttelse
+ Ingen skjulte avvik
− Mindre fleksibilitet

---

# ADR-015 – Snapshot-based kitchen visibility

## Context
Kjøkken trenger stabile tall.

## Decision
Kjøkken kan bruke snapshot-struktur fremfor live-query hvis nødvendig.

## Consequences
+ Stabil produksjon
+ Lav risiko for race conditions
− Litt ekstra kompleksitet

---

# ADR-016 – Provider-scoped configurable core (inert foundation)

## Context
Priser (90/130/170), cutoff (08:00 Europe/Oslo), tier-meny og pakke-entitlements er hardkodet i TypeScript, Sanity-seed og SQL-RPC (`lp_order_set`). Hardkode-audit (2026-06) viste dupliserte kilder og skjulte avhengigheter — uten én provider-scoped konfigurasjonsmodell kan ikke nye leverandører on-boardes uten kodeendring.

## Decision
Introduiser **additiv**, **inert** provider-config i databasen:

- `provider_price_rules` — tier-/pakkepriser og fremtidige overrides (customer/agreement/category)
- `provider_settings` — valuta, land, tidssone, cutoff, kjøkkenbuffer, leveringsdager, locale
- `provider_package_entitlements` — pakke-nøkkel (BASIS/LUXUS/ENTERPRISE) → entitlement_key + `default_value`

Første seed: **Melhus Catering AS** (Trondheim), oppslag via `providers.slug` / spine `organizations` — ingen hardkodet UUID.

RLS på nye tabeller bruker spine-hjelpere `app_active_org()` og `app_is_platform_admin()` (les/skriv platform admin; les provider-org for authenticated).

**Ingen runtime-leser** fra disse tabellene i denne changeset. Eksisterende konstanter, RPC, onboarding (FROZEN A1.5) og Sanity forblir uendret.

Uke-synlighet (torsdag 14:00 / fredag 15:00) modelleres **ikke** her — uløst inkonsistens i app-lag; egen patch senere.

## Consequences
+ Deterministisk fremtidig kilde for provider-parametre (database-first, ADR-001-aligned)
+ Melhus/Trondheim-seed speiler dagens `PLAN_CATEGORIES` og prisfasit
+ Fail-closed seed hvis provider eller spine-org mangler
− Dual maintenance inntil resolver-patches kobler runtime
− Spine RLS på config-tabeller krever JWT hook (Fase 3) for provider-admin lesing uten platform admin
− `lp_order_set` og TS-priskilder forblir autoritative inntil eksplisitt cutover-ADR

---

# ADR-017 – Global Market & Commercial Localization Model

**Status:** Proposed

## Context

Lunchportalen skal støtte flere land og språk. UI-språk, matkultur, market/commercial, priser, VAT/MVA, provisjon og fakturaregler er **separate domener**. Feil kobling kan gi feil priser, feil avgift, feil faktura, feil provisjon, feil menyforslag og dårlig internasjonal brukeropplevelse.

### Core principle

- **UI language** oversetter produktet (knapper, labels, hjelpetekst, statuser).
- **Menu culture profile** påvirker leverandørens fremtidige menyforslag (varmrettbank-vekting).
- **Market/commercial config** styrer penger, tax, provisjon og fakturering.
- **Provider/customer agreement** definerer faktiske kommersielle betingelser ved bestilling og fakturagrunnlag.

Fire akser skal holdes atskilt:

| Aks | Eksempler | Styrer | Styrer ikke |
|-----|-----------|--------|-------------|
| **A) UI locale** | `nb`, `en`, `de`, `lp_locale`, `profiles.preferred_locale` | UI-tekst, dato/nummerformat i UI der relevant | Matretter, menyforslag, priser, VAT, provisjon |
| **B) Menu culture profile** | `nordic_neutral`, `german_central_eu`, `international_office_safe` | Vekting av fremtidige varmrett-/Enterprise-forslag | UI-språk, publiserte menyer, ordre, priser |
| **C) Market/commercial** | `NO`, `SE`, `DE`, `UK` | Valuta, VAT-visning, provisjonspolicy, faktura/e-faktura, legal copy | UI-språk direkte, menyforslag direkte |
| **D) Agreement** | tier, `price_per_meal`, leveringsdager, cutoff | Faktisk pris og avtalevilkår per kunde | Global app-språk, andres markeder |

## Current state findings (read-only audit, 2026-06)

- **NO-first commercial:** NOK/`kr`, `formatNok` og norsk MVA-copy i flere surfaces.
- **`lib/menu-publish/tierPricing.ts`:** 90/130/170 eks. mva + `VAT_RATE = 0.15` (matmoms) som global fallback.
- **`provider_price_rules`:** `amount_ex_vat`, `vat_rate`, `currency` finnes; `loadProviderMenuPrices()` leser tier-priser — **ikke** full market resolver; currency ikke eksponert i menu price view.
- **`provider_settings`:** `default_country_code`, `default_currency`, `locale` finnes (ADR-016) — **delvis inert** i runtime.
- **Tripletex/EHF:** norsk integrasjon (`0192:` EHF, Tripletex MVA-sync) — **NO-spesifikt**, ikke global billing truth.
- **Provisjon 5 %:** `LUNCHPORTALEN_COMMISSION_RATE` i display/billing-estimat; **ingen** `commission_ledger` eller produksjonsklar provisjonsfakturering.
- **Commission base:** `computeBillingBasis()` prefererer eks. mva når data er complete; fallback `gross_only` beregner på inkl. mva — **ikke** eksplisitt enough for multi-market.
- **Order lines:** `subtotal_cents_ex_vat`, `vat_cents`, `gross_cents_inc_vat` — god grunnmur for fremtidig money model.
- **Employee `/week`:** ingen employer-pris i kanalen (by design).
- **Fase 3A i18n:** provider UI via `lp_locale`/next-intl; matretter og provider-owned content oversettes ikke.

## Decision

### D1 — UI locale is not market

- `lp_locale`, `profiles.preferred_locale` og `provider_settings.locale` skal **aldri** bestemme currency, VAT/MVA, commission eller menu culture profile.
- Customer/employee språkvalg oversetter **kun** UI-tekst.

### D2 — Menu culture profile is provider-controlled

- Kun cateringfirma/leverandør kan **eksplisitt** velge menyprofil.
- Customer/employee locale endrer aldri matretter eller menyforslag.
- Menyprofil påvirker kun **fremtidige forslag** (generator/rollout preview), aldri publiserte menyer eller eksisterende ordre.

### D3 — Market config controls commercial rules

- `market_code` styrer: currency default, tax/VAT display policy, commission policy reference, invoice/e-invoice profile, legal/commercial copy templates.
- Market config er **separat** fra UI locale og menu culture profile.

### D4 — Provider prices are market-scoped

- Provider-priser modelleres som: `provider` + `market_code` + `currency` + `package/tier` + `tax_basis` + `valid_from` / `valid_to`.
- Eksisterende NO-priser (90/130/170 NOK eks. mva) beholdes som seed/fallback inntil resolver er bygget og verifisert.

### D5 — Money values need currency and tax basis

Alle fremtidige money-felt skal bære:

- `amount` (minor units eller decimal — én konvensjon per lag)
- `currency` (ISO 4217)
- `tax_basis`: `ex_tax` | `inc_tax` | `unknown`
- `tax_category` eller `tax_rate_id` der relevant
- `market_code` der relevant

Eksisterende order-line-mønster (ex / vat / gross i cent) er referanse — utvid med metadata, ikke erstatt uten cutover-ADR.

### D6 — Commission base must be explicit

Provisjonspolicy skal ha:

- `commission_rate`
- `commission_base`: `net_ex_tax` | `gross_inc_tax` | `provider_revenue_ex_tax` | `other`
- market-specific override (`market_code`, optional `provider_id`)
- `effective_from` / `effective_to`
- audit (policy_id, beregnet grunnlag, tidspunkt)

**Anbefalt default:** `commission_base = net_ex_tax`.

**Må juridisk/regnskapsmessig valideres per marked** før produksjonsfakturering. Eksisterende `gross_only` fallback i display-kode skal **ikke** bli global sannhet.

### D7 — No automatic mutation of published commercial facts

Endring i market, currency, VAT, commission eller menu culture profile skal **aldri** mutere:

- historiske ordre og ordrelinjer
- publiserte menyer (`menuDay` published)
- låst fakturagrunnlag
- materialiserte commercial facts uten eksplisitt versjonert cutover

### D8 — Market-specific integrations

- Tripletex og norsk EHF er **NO-spesifikke** market integrations.
- De skal **ikke** behandles som global billing truth.
- EU/UK og andre markeder får egne `e_invoicing_profile` / integration adapters senere (Peppol, XRechnung, osv.).

### D9 — Provider/customer agreement remains operational truth

- Agreement styrer faktisk pris, pakke, leveringsdager, cutoff og kundeavtale.
- Global market config gir **rammer** (valuta, tax display, integration); agreement og materialiserte order facts er sannhet ved bestilling og fakturagrunnlag.

## Proposed domain model (konsept — ikke migration)

| Entitet | Rolle |
|---------|--------|
| **`market_configs`** | `market_code`, country, default_currency, timezone, tax_label, tax/price display mode, invoice_rules_profile, e_invoicing_profile |
| **`tax_rate_rules`** | `market_code`, tax_category, rate, valid_from/to, source_note, requires_manual_validation |
| **`provider_market_settings`** | provider + market: currency, timezone, invoice_integration, tax_registration, default_price_tax_basis |
| **`provider_price_rules`** (utvidelse av ADR-016) | + market_code, tax_basis, tax_category, valid_from/to |
| **`commission_policies`** | rate, base, tax_treatment, market/provider scope, effective window |
| **`commission_ledger`** | order/period, amounts, base, rate, commission_amount, currency, policy_id, audit_ref |

Fremtidig resolver-hierarki (illustrativ):

```text
market_code → tax_rate_rules + commission_policies
provider + market → provider_market_settings + provider_price_rules
company → agreement (operational price/tier)
order write → materialized ex/vat/gross (Golden Path — ADR-002)
```

UI locale resolves **kun** via next-intl — **utenfor** denne kjeden.

## Roadmap

| Fase | Innhold |
|------|---------|
| **R0** | ADR only (dette dokumentet) |
| **R1** | Read-only commercial inventory (grep/report: NOK, kr, MVA, `VAT_RATE`, `formatNok`) |
| **R2** | Market config skeleton — inert (`market_configs`, `tax_rate_rules`) |
| **R3** | Money/tax display helpers — NO only aktiv |
| **R4** | Provider price settings market-ready (scoped rules, fortsatt NO seed) |
| **R5** | Commission policy skeleton — inert |
| **R6** | Commission ledger dry-run (beregner, ikke fakturerer) |
| **R7** | Provider billing integration per market (NO Tripletex/EHF først) |
| **R8** | Multi-market enablement bak feature flag + legal sign-off |

Menu culture profile følger **egen ADR/roadmap** — ikke blandet inn i commercial resolver.

## Risks

- Feil VAT-rate per marked eller produktkategori (mat vs SaaS).
- Provisjon beregnet på tax (brutto inkl. mva).
- Provider pris i feil currency uten validering.
- Retroaktive policy-endringer uten ledger versioning.
- E-invoicing-krav per land (EHF, Peppol, XRechnung, …).
- Legal/commercial copy på feil språk vs. feil marked.
- Utilsiktet kobling mellom `lp_locale` og `market_code`.
- Regression i Golden Path hvis commercial logic invaderer order write-path.
- Tripletex/EHF som utilsiktet global billing truth.

## Do not implement yet

- Koble `lp_locale`, `profiles.preferred_locale` eller `provider_settings.locale` til market, currency, VAT, commission eller menu culture.
- Auto-velge market fra UI-språk.
- Aktivere nye markeder (SE/DE/UK/…) uten resolver + legal sign-off.
- Endre billing runtime, Tripletex flows eller commission invoicing uten `commission_ledger` og policy.
- Hardkode DE/FR/ES/UK VAT-satser i runtime.
- Endre order write-path, `lp_order_set`, `lp_order_advance_status` eller Golden Path for commercial features.
- Oversette matretter/priser som del av UI i18n.
- Mutere historiske ordre, publiserte menyer eller låst fakturagrunnlag ved config-endring.

## Consequences

+ Tydelig fire-akse-modell for internasjonal skalering uten å bryte Fase 3A i18n-fasit
+ ADR-016 `provider_price_rules` / `provider_settings` får definert utvidelsesretning (market scope)
+ Fail-closed: feil kobling språk→penger blir eksplisitt forbudt
− Krever juridisk/regnskapsmessig validering per marked før enablement
− Dual maintenance inntil commercial resolver erstatter NO-hardkode (som ADR-016 for provider config)
− Commission og multi-currency settlement krever ledger og cutover-ADR før produksjon

**Relates to:** ADR-016 (provider config inert foundation), Fase 3A provider i18n (`lp_locale`), menu culture profile ADR (proposed separately)

---

# ADR-018 – Provider Menu Price Resolver Cutover (R4G)

**Status:** Proposed (R4F — gated; **no runtime cutover**)

## Context

After R4E-2, provider menu has:

- **Production `prices`** from legacy `loadProviderMenuPrices()` (no `market_code` filter)
- **Diagnostics `pricePreview`** from market-aware `loadProviderMenuPricesPreview()` when `LP_PROVIDER_PRICE_PREVIEW_DISPLAY=true`
- **Server publish** still uses `fallbackProviderMenuPrices()` in `menuDayPayload` — independent of both resolvers
- **Golden Path** still uses `TIER_PRICE_CENTS` — independent of provider menu display

R4F locked this state in docs and tests. Runtime cutover must not happen implicitly.

## Decision

### D1 — R4G is flag-gated resolver cutover only

- Introduce **`LP_PROVIDER_PRICE_MARKET_RESOLVER`** (default `false`) for staging/production cutover of **`prices`** only.
- **`LP_PROVIDER_PRICE_PREVIEW_DISPLAY`** remains diagnostics-only and must never change `prices`.

### D2 — R4G scope boundary

**In scope (R4G):** `loadProviderMenuPrices()` → market-aware v2 for `GET /api/provider/menu-days` → `prices` → provider UI tier/margin display.

**Out of scope (separate phases):**

- `menuDayPayload` / server publish validation → **R4G-publish**
- Billing, Tripletex, agreements → **R4G-billing**
- MSDI, `lp_order_set`, order write-path → **R4H** (Golden Path)
- Employee `/week`, employee APIs → **never**

### D3 — Preconditions before R4G GO

See [r4-provider-price-cutover-runbook.md](./r4-provider-price-cutover-runbook.md):

- R4F parity tests green
- Staging preview observation complete
- `differsFromProduction` understood or zero for pilots
- Employee price-free contract tests green
- Publish dual-truth explicitly accepted or R4G-publish scheduled
- `npm run test:golden-path` green (no Golden Path change in R4G, but regression gate)

### D4 — Fail-closed

- Flag off → identical to today (legacy resolver)
- Zero NO tier-default rows → fallback `tierPricing.ts` (unchanged semantics)
- No silent fallback from preview resolver into production without flag

## Consequences

+ Clear separation: diagnostics (R4E) vs cutover (R4G) vs publish alignment (R4G-publish) vs orders (R4H)
+ Staging can prove parity before production flag
− Dual truth (display vs publish) remains until R4G-publish unless bundled
− Multi-market production still requires explicit market selection beyond NO-only v2

**Relates to:** ADR-016, ADR-017, [r4-provider-price-plan.md](./r4-provider-price-plan.md), [r4-provider-price-cutover-runbook.md](./r4-provider-price-cutover-runbook.md)

---

# KONKLUSJON

Lunchportalen sin arkitektur er basert på:

- Database-first enforcement
- Minimal write paths
- Multi-tenant sikkerhet
- Deterministiske operasjoner
- No-exception modell

Enhver endring i:

- Roller
- RLS
- RPC
- Service-role policy
- Cut-off logikk
- Agreement-modell
- Market/commercial config (ADR-017)
- UI locale vs. market/currency coupling

må føre til ny ADR-oppføring eller ADR-017 amendment.

Arkitektur skal aldri endres implisitt.