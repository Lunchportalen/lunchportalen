# CP8 — Decision

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- **GO:** CP8 dokumenterer redaksjonell/kontrollplan-paritet og **lukker narrativt gap** mellom operativ publish-kjede og CP7 broker (samme Sanity-kilde).
- **Betingelser:** «Null merkbare gap» for alle brukere er **ikke** garantert uten brukertest; teknisk **100 % Umbraco** krever replatforming (jf. `UMBRACO_PARITY_REPLATFORMING_GAPS.md`).

## 2. Hva som er oppnådd

- **CMS** forblir hovedbase for kontroll, innhold, media, meny-publish (Sanity + broker der token finnes).
- **Domener** koblet via eksisterende surfaces + CP8 dokumentasjon.
- **Uke/meny:** Publiseres via Sanity; runtime uendret; kjede-tekst **sann** mht. broker.
- **Control towers:** Dokumentert som del av samme plan.

## 3. Hva som fortsatt er svakt

- To innholdsmotorer (Postgres + Sanity) — **IA** og **opplæring** er fortsatt nødvendig.
- Unified history på tvers av systemer — **ikke** levert.
- Growth kan være **LIMITED**.

## 4. Nærhet til Umbraco-/verdensklasse

- **Redaksjonell kontroll og governance-dokumentasjon:** høy.
- **En teknisk CMS-kjerne som Umbraco:** nei — bevisst.

## 5. Før ubetinget enterprise-live-ready

1. Brukertest på backoffice narrative (uke/meny vs content).
2. Runbook for token + visibility.
3. Eventuell faner-gruppering (produkt).

## 6. Kan vente

- Unified history UI, global søk, bulk meny-publish.
