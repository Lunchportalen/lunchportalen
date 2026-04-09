# CP12 — Decision

**Dato:** 2026-03-29

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- **GO:** Utvidet discovery i palett + global historikk-/discovery-strip (UX) uten ny backend.
- **Betingelser:** Teknisk samlet historikkmotor og global fulltext krever plattform — ikke levert.

## 2. Hva som er oppnådd

- **CMS som base:** Backoffice viser eksplisitt **hvor historikk og versjoner lever** (Postgres vs Sanity vs to spor på uke/meny).
- **Domener:** Uendret kobling; **control tower** og **papirkurv** lettere å finne via palett.
- **Ukemeny/ukeplan:** Publiseringskjede uendret; strip forsterker **ærlig** historikk-fortelling sammen med CP11-notis på siden.
- **Control towers:** `control-tower`-rute i discovery; ikke ny tower-logikk.

## 3. Hva som fortsatt er svakt

- Ingen **global indeksert søk**.
- Ingen **én teknisk tidslinje** for alle endringer.

## 4. Nærhet til Umbraco / verdensklasse

Sterkere **discovery og historikk-forståelse** for redaktør; fortsatt **ikke** teknisk Umbraco History.

## 5. Før ubetinget enterprise-live-ready

1. Beslutning om **søkeplattform** (eller bevisst klient-only scope).
2. Eventuell **sporbarhets-API** for innhold — egen produktfase.

## 6. Kan vente

- Avansert document-type arv.
- Palett med muterende actions.
