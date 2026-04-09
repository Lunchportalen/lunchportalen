# U20 — Entity discovery index model

## Mekanismer i dag

| Mekanisme | Kilde | Registry-only? |
|-----------|--------|----------------|
| Command palette | `BACKOFFICE_PALETTE_ITEMS` (manifest) | Ja (før U20) |
| `rankDiscoveryNavItems` | Precomputert blob per `href` + score | Ja |
| `filterBackofficeNavItems` | Label, href, alias-blob | Ja |
| API `GET /api/backoffice/content/pages` | `content_pages` | Nei — faktiske rader |
| API `GET /api/backoffice/media/items` | `media_items` | Nei |

## Entiteter som inngår i U20 discovery index

| Entitet | Kilde | Palett-integrasjon |
|---------|--------|-------------------|
| Content pages | Postgres `content_pages` | Når bruker **skriver søk** — treff til `/backoffice/content/[id]` |
| Media items | Postgres `media_items` | Ved treff — lenke til `/backoffice/media` (bibliotek) |
| Domener / uke / tårn / growth | Fortsatt manifest + eksisterende API-flater | Ingen ny søkemotor; ruter fra registry |

## Trygg liten indeks uten ny søkemotorplattform

- **Én** bundle-endepunkt `GET /api/backoffice/control-plane/discovery-entity-bundle` (superadmin) som returnerer **begrensede** lister (typisk ≤40 per type) via `supabaseAdmin`.
- Klienten **cacher** bundle når paletten åpnes; **fusjon** med manifest-treff kun når **query ikke er tom** (unngår støy).

## Ranking og gruppering

- **Manifest-rader**: eksisterende `rankDiscoveryNavItems`.
- **Entiteter**: enkel delstreng/word-score på `title` + `slug` + visningsnavn for media.
- **Grupper**: entiteter får `groupId: "content"` (samme visuelle gruppe som innhold/vekst).

## Hva som må vente

- Full indeks over domener, agreements, kunder — krever egne **avleste** API-kontrakter og risikokartlegging; ikke del av minimal U20-bundle.
