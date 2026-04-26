# Kanonisk Umbraco content-modell — Lunchportalen public-lag

**Formål:** Én tydelig, redaksjonell, blokkbasert modell for `lunchportalen.no` (marketing / tillit / landing).  
**Grenser:** Umbraco = public innhold. **Sanity** = ukeplan/meny. **Supabase** = operativ sannhet. **Next** = rendering og integrasjon.

## Dokumenttyper (Document Types)

| Navn (UI) | Alias | Rolle |
|-----------|-------|--------|
| Marketing page | `marketingPage` | Eksisterende fase-1-mal; repo-seed (`home`, `phase1-demo`). |
| Home | `homePage` | Forside — samme felt som `marketingPage`; én instans under rot (redaksjonell disiplin). |
| Content page | `contentPage` | Standard innholdsside. |
| Contact page | `contactPage` | Kontakt; kun innhold (ingen ticket-/ordre-logikk i CMS). |
| Legal page | `legalPage` | Vilkår / personvern / juridisk tekst. |
| Landing page | `landingPage` | Kampanje-URL-er. |
| Global settings | `globalSettings` | «Site settings»: navn, analytics, globale blokker (header/footer-innhold), m.m. |
| Design settings | `designSettings` | Design-/tema-kontekst (pekes til fra global settings). |

Alle sider over (unntatt settings) bruker **samme innholdsfelt**: `pageTitle`, `routeSlug`, `bodyBlocks` (LP Marketing Phase1 Body Blocks), `mainContent` (LP Main content blocks) + **komposisjon** `seoMeta` (SEO Defaults).

## SEO / metadata

- **Komposisjon** `seoMeta`: `seoTitle`, `seoDescription`, `seoCanonical`, `seoOgImage`, `seoNoIndex`, `seoNoFollow`, `socialTitle`, `socialDescription`.
- Mapper til Next-body `meta.seo` / `meta.social` via `lib/cms/umbraco/mapDeliveryItemToLegacyMarketingBody.ts`.

## Elementtyper / blokker (Block List)

### Enkle LP-blokker (`bodyBlocks` + tilgjengelig i `mainContent`)

| Element (alias) | LP `type` (Next) | Merknad |
|-----------------|------------------|---------|
| `lpHero` | `hero` | Toppseksjon. |
| `lpRichText` | `richText` | Brødtekst / overskrift. |
| `lpCards` | `cards` | Verdi-kort / enkel grid; `items` kan være JSON-array (textarea). |
| `lpCta` | `cta` | CTA-band (tittel, brødtekst, knapp, href). |
| `lpImage` | `image` | Bilde + alt. |

### Strukturerte blokker (typisk `mainContent` med settings)

| Element | LP `type` | Formål |
|---------|-----------|--------|
| `accordionOrTab` | `accordionOrTab` | FAQ / trekkspill (nested items). |
| `alertBox` | `alertBox` | Varsel. |
| `anchorNavigation` | `anchorNavigation` | Anker-lenker. |
| `banners` | `banners` | Banner / CTA-strip. |
| `codeBlock` | `codeBlock` | Kode (kontrollert). |
| `textBlock` | `textBlock` | Tekstblokk med settings. |
| `heroBannerBlock` | `heroBannerBlock` | Hero-variant (kampanje). |
| `dualPromoCardsBlock` | `dualPromoCardsBlock` | To-kolonne promo / verdi-punkter. |

### Redaksjonell mapping (ønskede begreper → eksisterende typer)

| Ønsket begrep | Bruk i Umbraco |
|---------------|----------------|
| Value props | `lpCards` eller `dualPromoCardsBlock` |
| CTA band | `lpCta` eller `banners` |
| FAQ | `accordionOrTab` |
| Quote / testimonial | Utvidelse: egne elementer kan mappes i `UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE` når Delivery-kontrakt er klar (`testimonial_block`, `quote_block` i kodebase). |
| Logo grid | `logo_cloud` (når tilsvarende element er opprettet i Umbraco og mapper). |
| Contact info | Redaksjonell tekst i blokker + ev. `contactPage`; ikke operativ kundekontekst. |

## Header / navigasjon / footer

- **Global settings** har faner for bl.a. globale komponenter (`topComponents`, `bottomComponents`, `pods`) — samme block catalogue som `mainContent` der det er aktivert.
- Next leser design/global via eksisterende design-pipeline (ikke beskrevet her som operativ logikk).

## Kilde for typer og innhold

- Dokument- og datatyper lever i **Umbraco-databasen** (Azure SQL i produksjon), ikke som sync-filer i repo.
- Stabile nøkler (kode / seed): `Umbraco/MarketingPhase1/MarketingPhase1Guids.cs`
- Delivery → legacy body: `lib/cms/umbraco/mapDeliveryItemToLegacyMarketingBody.ts`

## Hvorfor dette er riktig grunnmur

1. **Én felles feltstruktur** (`pageTitle` / `routeSlug` / `bodyBlocks` / `mainContent` + SEO) for alle offentlige sider — redaktører kan velge dokumenttype etter **hensikt**, ikke etter teknisk skille.
2. **Blokkbasert** modell som allerede mappes til Next `CmsBlockRenderer` via Delivery.
3. **Tydelig lagdeling:** ingen ordre, avtale, ansatt eller kjøkken i Umbraco; ukeplan forblir i Sanity; drift i Supabase.
