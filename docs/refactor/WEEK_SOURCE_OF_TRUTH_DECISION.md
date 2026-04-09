# Beslutningsutkast — Week: én operativ sannhet

**Dato:** 2026-03-28  
**Status:** Anbefaling til produkteier / tech lead — **ikke** implementert.

---

## 1. Problemstilling

Systemet har **flere lag** som alle beskriver «uke» eller «meny for en periode»:

| Lag | Teknologi | Typisk bruk |
|-----|-----------|-------------|
| A | Supabase `company_current_agreement` + daymap | `app/api/week/route.ts`, operativ avtale |
| B | Supabase `companies.agreement_json` | Legacy mønstre, `meal_contract`, `app/api/weekplan/route.ts` |
| C | Sanity `weekPlan` | Ukeplan-dokument, status `current`/`open`, kjøkken/dags retter |
| D | Sanity `menuContent` | Daglig meny per dato, `customerVisible`, godkjenning |
| E | Supabase `menu_visibility_days` | Speil fra cron for synlighet |
| F | `lib/week/availability.ts` | Torsdag 08:00 / fredag 14:00 for **app-logikk** (API order window) |

Uten eksplisitt hierarki oppstår **dobbelt sannhet** og vanskelige feilsøk når noe «ikke stemmer» mellom Studio, employee-UI og bestilling.

---

## 2. Anbefalt hierarki (operativ vs presentasjon)

### 2.1 Operativ sannhet (bestilling, pris, tier, cutoff)

**Anbefaling:** Behold **Supabase-avtale** som autoritativ for *hvem som kan bestille hva og når*:

- `lib/agreement/currentAgreement.ts` + `getCurrentAgreementState` (allerede uttrykt som system-sannhet i kommentarer i `currentAgreement.ts`).
- `app/api/order/window/route.ts` som **kanonisk** server-API for bestillingsvindu (allerede mest komplett: policy, day choices, CMS-meny, fallback).

**Begrunnelse:** Bestilling berører økonomi og drift; kilden bør være **transaksjonsnær** (Supabase) og konsistent med `profiles.company_id` / `location_id`.

### 2.2 Presentasjon / innhold (retter, bilder, tekst)

**Anbefaling:** **Sanity `menuContent`** (og relaterte CMS-helpers) som kilde for **daglig meny-innhold** som vises brukeren, med `approvedForPublish` / `customerVisible` styrt av redaksjonell flyt.

**Begrunnelse:** `app/api/cron/week-visibility/route.ts` opererer allerede på `menuContent` og speiler til `menu_visibility_days` — dette er et **innholds- og publiserings** spor, ikke nødvendigvis samme som kontrakts-tier.

### 2.3 Sanity `weekPlan` — deprecate som *operativ* sannhet?

**Anbefaling:** **Ja — marker `weekPlan`-sporet som ikke-nødvendig for operativ bestillingssannhet**, så lenge:

1. Kjøkken og drift kan jobbe fra `menuContent` + eventuelt egne kjøkkenvisninger som allerede finnes, **eller**
2. `weekPlan` kun brukes som **planleggings-/batch-dokument** som **mater** `menuContent` (énveis pipeline — ikke to konkurrerende «sannheter» for sluttbruker).

**Bevis på overlapp:**  
- `lib/sanity/weekplan.ts` henter `weekPlan` for employee-uke API.  
- `order/window` bruker **ikke** `weekPlan` direkte for tier/valg — den bruker avtale + CMS productPlan/meny.

**Konklusjon:** `weekPlan` kan **arkiveres/deprecated** som *employee-facing* kilde hvis employee-UI og API konsolideres mot én modell (se under). Det skal **ikke** slettes i Studio før dokumenterte avhengigheter (GROQ, `lock-weekplans`, Studio-UX) er kartlagt.

---

## 3. API-konsolidering (måltilstand)

| Dagens | Mål |
|--------|-----|
| `GET /api/week` og `GET /api/weekplan` med ulike avtalekilder | **Én** rute (eller én bakoverkompatibel fasade) som alltid leser samme avtale-lag (`company_current_agreement` + nødvendig JSON) |
| Klienter som blander kilder | Én klient-kontrakt for «ukekort» for ansatt |

**Migrasjon:** Behold begge endepunkter midlertidig med **identisk** datakilde og **deprecation header** / logg — ikke breaking change i én PR.

---

## 4. Tidsregler — én implementasjon

**Problem:**  
- `lib/week/availability.ts` — kontinuerlig fredag 14:00.  
- `app/api/cron/week-visibility/route.ts` — trigger kun `mi === 0`.  
- `week-scheduler` — 10-min vindu fredag for `lock-weekplans` (annen jobb).

**Anbefaling:**  
1. Definer **én** modul (foreslått navn: utvid `lib/date/oslo.ts` eller ny `lib/week/weekGates.ts`) som eksporterer: `canSeeThisWeek`, `canSeeNextWeek`, `isThursday0800Open`, `isFriday1400Transition` med **testbare** enheter.  
2. Cron som **må** kjøre på fast minutt bør enten:  
   - bruke **samme** hjelpefunksjon for «er vi i riktig tilstand» *eller*  
   - dokumenteres eksplisitt som «best effort batch» med **idempotent** patch (allerede delvis til stede).

---

## 5. Employee allowlist — innstramming (eksakt forslag)

**Dagens** `lib/auth/role.ts` `allowNextForRole` for employee:

```ts
nextPath.startsWith("/week") ||
nextPath.startsWith("/orders") ||
nextPath.startsWith("/min-side")
```

**Obs:** `middleware.ts` beskytter ikke `/min-side` ved kant; siden redirecter via `getScope`.

**Forslag hvis målet er «kun Week (+ nødvendige støtte»):**

| Sti | Anbefaling |
|-----|------------|
| `/week` | **Behold** — kjerne. |
| `/orders` | **Behold** hvis ordrehistorikk er produktkrav; ellers vurder redirect til `/week` med ordrepanel. |
| `/min-side` | **Erstatt** med eksplisitt profil-sti kun hør nødvendig — eller behold som **kun redirect** (som nå) og fjern fra allowlist hvis alle flows går via `/week` (krever produkt-OK). |

**Konkret minste innstramming:** Ingen endring i allowlist før middleware og `post-login` er oppdatert i **samme** endring — ellers risiko for redirect-loops (frozen område).

---

## 6. Oppsummering

| Beslutning | Anbefaling |
|------------|------------|
| Operativ bestilling | Supabase avtale + `order/window` |
| Meny-innhold | Sanity `menuContent` (+ cron-speil der det allerede finnes) |
| `weekPlan` | Deprecate som parallel employee-sannhet; behold i Studio til migrasjon eller konverter til planleggings-only |
| API | Slå sammen `/api/week` og `/api/weekplan` kontraktsmessig |
| Tid | Én modul for ukesporter; harmoniser cron vs kontinuerlig logikk |

---

*Dette dokumentet skal oppdateres når produkt beslutter skjebnen til `weekPlan` i Studio og om `/orders` er permanent employee-surface.*
