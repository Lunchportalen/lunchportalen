# CP10 — Global search and command decision

**Dato:** 2026-03-29

## Hva som finnes i dag

| Område | Mekanisme |
|--------|-----------|
| Content tree | Klient-side filter + auto-expand (CP9) |
| Media | Eksisterende liste/filtre på siden |
| Domener / kunder / moduler | Navigasjon via TopBar + kort/lenker |
| **Global** | **CP10:** `BackofficeCommandPalette` — filtrering av `BACKOFFICE_NAV_ITEMS` (label/href/sti), **kun navigasjon** |

## Merkbare gap

- Ingen **server-side** fulltext på tvers av tre, media, sider og domener uten ny API/indeks.
- Ingen **søk i innholdsblokker** fra én global boks.
- Kommandopaletten **åpner ikke** kontekstuelle handlinger (save/publish) — kun **ruter**.

## CP10-beslutning

| Spørsmål | Beslutning |
|----------|------------|
| **Trygg backoffice-søkeflate over eksisterende data?** | **Delvis:** tree-filter (CP9) + **modul-palett** over eksisterende `href` (CP10). Ikke ny indeks. |
| **Command palette over eksisterende routes/actions?** | **Ja for navigasjon:** Ctrl+K / ⌘K → `router.push` til eksisterende `/backoffice/*`. **Nei** for muterende actions uten eksisterende sikre API-kontrakter. |
| **Kontekstuelle handlinger i workspaces?** | Beholder i **content workspace** (eksisterende knapper/paneler). Paletten er **ikke** erstatning for workspace-actions. |

## Hva som kan bygges nå uten ny søkemotor

- Klientfiltrering av **nav-items** (implementert).
- Utvidelse av samme mønster: **flere statiske «quick links»** (f.eks. ofte brukte content-IDs) — kun hvis produkt eksplisitt ber om det og det er trygt.

## Hva som må vente

- **Global søkemotor** / felles indeks / fulltext API.
- **Palett som kjører** «publish» / «rollback» uten at hver handling er eksplisitt bundet til én sikker route.

## Replatforming (eksplisitt)

- **Elasticsearch/OpenSearch** eller liknende for enterprise-«søk alt» — ikke del av CP10.
