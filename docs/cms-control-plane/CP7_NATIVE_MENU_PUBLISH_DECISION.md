# CP7 — Native menu publish (beslutning)

## Hva employee runtime faktisk leser i dag

- **`GET /api/week`** (`app/api/week/route.ts`):
  - **Supabase:** `company_current_agreement` (aktiv avtale, tier, `delivery_days`).
  - **Sanity:** `menuContent` per kalenderdato via `getMenuForDates` → `lib/sanity/queries.ts` (publisert perspektiv, kundesynlig filter).
- **Ikke** primær kilde for ansatt-bestilling: Sanity **`weekPlan`** (redaksjonelt spor, se nedenfor).

## Hva som er publisert sannhet i dag

- **`menuContent`** i **publisert datasett-perspektiv** (ikke `drafts.*`), med synlighetsregel:
  - `isPublished == true` **eller** (`approvedForPublish == true && customerVisible == true`).
- **`menu`** (måltidstype-dokumenter) brukes bl.a. til beredskapstabell / `getMenusByMealTypes` — supplementær CMS-sannhet, ikke dag-radene i `GET /api/week`.

## Er Sanity menu/menuContent fortsatt operativ source of truth?

- **Ja.** Operativ visning for ansatt uke bygger på **`menuContent`** + avtale (Supabase). Ingen ny tabell eller parallell menymotor er introdusert i CP7.

## Er Studio eneste trygge mutasjonspunkt i dag?

- **Før CP7:** Redigering og «Publish» i Studio var den kanoniske måten å flytte utkast → publisert.
- **Etter CP7:** Samme **Sanity Actions API** (`sanity.action.document.publish`) kan kjøres fra **server-broker** (`/api/backoffice/sanity/menu-content/publish`) når `SANITY_WRITE_TOKEN` er satt — **samme semantikk** som Studio Publish for draft → published.

## Hvordan CMS/backoffice får ekte publish control uten ny sannhet

- **Én kilde:** Fortsatt Sanity Content Lake.
- **Én publish-motor:** Sanity Actions (ikke duplikat logikk i Postgres).
- **Broker:** Next API + `requireSanityWrite()` + eksplisitt superadmin-gate.

## CP7 valg: eksisterende publish vs broker

| Alternativ | CP7 |
|------------|-----|
| Eksisterende Studio publish | Bevares; primær CTA i handoff-kort. |
| Trygg server-side broker til samme kilde | **Implementert** for `menuContent` per dato. |
| Embedded Studio iframe | **Ikke** valgt (CP6 allerede dokumentert som ustabilt/blokkert). |

## Read-only / review / publish-control

|flate|modus|
|-----|-----|
| Runtime ordre/avtale/billing | Read-only fra CMS; mutasjon kun via eksisterende runtime-ruter |
| `menuContent` redaksjon | Studio eller fremtidig utvidelse; **publish** kan trigges fra broker |
| `weekPlan` | Redaksjonelt / policy — **ikke** `GET /api/week` |

## Hva CP7 implementerer nå

- Server-broker publish for **`menuContent`**-utkast per **dato**.
- UI-panel på **`/backoffice/week-menu`**.
- Dokumentasjon for sikkerhet, routing og weekPlan-avgrensning.

## Hva som må vente (unngå dobbel sannhet)

- Bulk-publish av hele uker uten eksplisitt dato-regel.
- Automatisk synk mot `menu_visibility_days` (DB) uten egen arkitektur-gate — **ikke** endret i CP7.
- Redigering av felter i `menu`/`menuContent` fra LP utenom Studio — **ikke** i scope (unngår divergerende editor).
