# CMS boundary and runtime boundary report (V2)

## Definisjoner

| Begrep | Menes her |
|--------|-----------|
| **CMS** | Innhold (sider, blokker, media, preview/publish) i **backoffice** + `lib/cms` + `app/api/backoffice/content|media` |
| **Operativ kjerne** | Ordre, ukeplan, kjøkken, driver, avtaler, billing, auth |
| **Growth** | SEO/social/ESG «surface», AI-assistanse, superadmin growth — ofte **ved siden av** kjerne |

## CMS — hva som er «ekte» CMS nå

| Område | Bevis / inngang | Klassifisering |
|--------|-----------------|----------------|
| Content tree | `app/api/backoffice/content/tree`, `app/(backoffice)/backoffice/content/_tree` | **CANONICAL** |
| Pages / variants / publish | `app/api/backoffice/content/pages/**`, `variant/publish` | **CANONICAL** |
| Media library | `app/api/backoffice/media/**` | **CANONICAL** |
| Preview | `app/(backoffice)/backoffice/preview/[id]` | **CANONICAL** |
| Design / blocks | `lib/cms/**`, `ContentWorkspace` | **CANONICAL** + **TRANSITIONAL** (stor flate) |

## Runtime — operativ kjerne

| Område | Grense | Klassifisering |
|--------|--------|----------------|
| Ordre | `app/api/order/**`, `app/api/orders/**` | **CANONICAL** — **ikke** bland med CMS save |
| Week | `lib/week/**`, `app/(app)/week` | **CANONICAL** |
| Kitchen / Driver | egne app/api namespaces | **CANONICAL** |

## Grenser som er «rene» (arkitektur-intent)

- **Backoffice** route group `(backoffice)` er **fysisk** adskilt fra `(public)` — **CANONICAL**.
- **Server-only** helpers (`import "server-only"`) brukt i API — **ACTIVE** mønster.

## Grenser som fortsatt er «lekke» eller rotete

| Problem | Beskrivelse | Tag |
|---------|-------------|-----|
| **Social** | `app/api/social/**` + superadmin growth + backoffice social UI | **TRANSITIONAL** — flere «innganger» |
| **SEO** | Scripts (`seo-*.mjs`) + AI routes + CMS panel | **TRANSITIONAL** — skille **batch** vs **editor** |
| **ESG** | Admin/backoffice/superadmin API + cron ESG | **DUPLICATE** yte — bevisst rolle eller teknisk gjeld? |
| **AI** | `lib/ai/**` krysser CMS, growth, POS (`lib/pos`) | **SCALE_RISK** — kognitiv last |
| **Sanity** | `studio/**` ekskludert fra `tsc` | **TRANSITIONAL** — egen livssyklus |

## `docs/phase2/CMS_CORE_BOUNDARY.md` (ekstern referanse)

- Vurderes som **PARTIALLY_CURRENT** — sjekk mot faktisk `ContentWorkspace` ved neste endring.

## Konklusjon

- **CMS** er **implementert** og **testet** (mange `tests/cms/*`, `tests/api/content*`).  
- **Pilot:** Sikre at **ingen** CMS-endepunkt kan mutere **operativ** state uten eksplisitt kontrakt.  
- **Growth** (SEO/social/ESG) bør ha **én** eier-doc per flate (allerede delvis i `docs/phase2d`).
