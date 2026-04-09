# U20 — Entity discovery baseline

## Hva som allerede er nær Umbraco 17-paritet

- **Én extension manifest** (`BACKOFFICE_EXTENSION_REGISTRY`) driver TopBar, palett og metadata — samme mønster som extension manifest / sections.
- **Command palette (Ctrl+K)** med filtrering, gruppering og **U19-indeksert rankering** over manifest-rader (`rankDiscoveryNavItems`).
- **Discovery aliases** på utvalgte ruter (U18) for bedre treff uten å bytte arkitektur.
- **Workspace-krom** (`BackofficeWorkspaceSurface`, header-mønstre) på sentrale flater.

## Hva som fortsatt var under paritet (før U20)

- Paletten søkte **bare** i statiske registry-rader — ikke i **faktiske** `content_pages` / `media_items`.
- Redaktør opplevde at «hurtigsøk» fant modulnavn, men ikke konkrete sider eller medier.

## Baseline-problemer løst siden eldre deep-dive

- U17–U19: manifest, indeksert rankering, historikk-strip (ærlig flerkilde), AI control center-side med posture-tabell.
- U20: **kontrollert entitets-indeksering** i paletten (samme palett, ikke ny søkemotor).

## Åpne plattform-risikoer (gjelder fortsatt)

- **Ingen** Elasticsearch/Typesense — tunge full-tekstbehov må fortsatt løses i eksisterende API-er eller fremtidig konsolidert søk.
- **Sanity-meny** og **operativ uke** har egne kilder; discovery skal ikke late som én sannhet.

## Hva som må samles under CMS control plane (helhetsfølelse)

- **Lesbar** og **rask** vei til: innhold, media, domener, uke/meny, SEO/social/ESG, tårn, AI — uten å flytte runtime-sannhet.
