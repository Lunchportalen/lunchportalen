# U27 — Entity bulk actions model (Lunchportalen ↔ Umbraco-konsept)

## Umbraco-referanse (konseptuelt)

- **Collection action:** handling på hele collection-viewet (f.eks. eksporter liste).
- **Entity bulk action:** handling på **valgte** noder/entiteter etter multi-select.
- **Selected items:** samme semantikk — valgte rader i en collection/table.

Lunchportalen bruker **Next.js + egne API-ruter**, ikke Umbraco Management API — paritet er **arbeidsflyt og trygghet**, ikke identisk manifest.

## Trygge bulk-handlinger på dagens stack

| Handling | Område | Begrunnelse |
|----------|--------|-------------|
| Kopier offentlige/medie-URLer til utklippstavle | Media collection | Ingen DB-endring (`SAFE_BULK_COPY_MEDIA_URLS`). |
| Kopier editor-URLer for valgte sider | Vekst-dashboard | Ingen DB-endring; full URL med `origin`. |
| Eksporter/vis liste (read-only) | Governance insights | Kun aggregering. |

## Ikke bygget nå (UI-idéer eller usikker backend)

- Masse-slett, masse-flytt, masse-publish uten per-variant review.
- Masse «oppgrader til envelope» uten å ha én deterministisk transform som er testet på alle kroppsformer.
- Masse AI-apply til blokker uten menneskelig review per side.

## Bulk actions som kan bygges nå (implementert eller eksplisitt støttet)

- **Content pages:** multi-select + kopier editor-lenker (U27).
- **media_items:** eksisterende trygge mønstre beholdes.
- **Governance / legacy review:** API + settings-side — ingen mutasjon, kun innsikt + lenker.

## Hva som må vente

- Ekte **entity bulk** med server-side transaksjon og idempotens (krever design per operasjon).
- Full **Umbraco-paritet** for manifest-registrerte bulk actions — **REPLATFORMING_GAP** uten egen extension-host (se `U27_REPLATFORMING_GAPS.md`).
