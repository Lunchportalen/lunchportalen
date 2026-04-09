# CP10 — Decision

**Dato:** 2026-03-29

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- **GO:** Global redaktør-navigasjon (⌘K / Ctrl+K) over eksisterende backoffice-ruter, delt nav-kilde med TopBar, tester grønne, enterprise build grønn.
- **Betingelser:** Full Umbraco-nivå **global søk** og **én teknisk historikktidslinje** er **ikke** levert; dokumentert som fremtidig plattform / UX-arbeid. Moduler med LIMITED/DRY_RUN/STUB forblir underlagt backend-sannhet.

## 2. Hva som er oppnådd

- **CMS som synlig base:** Backoffice behandles som kontrollsenter; hurtigtilgang til alle primærmoduler uten ny rute-matrise duplisert i komponenter.
- **Domener som snakker med CMS-kontrollflaten:** Content, media, domener, kunder, avtale-runtime, uke & meny, SEO, social, ESG, control towers — **navigasjon og IA** er mer konsistent via `BACKOFFICE_NAV_ITEMS`.
- **Ukemeny/ukeplan:** Uendret teknisk kjede fra tidligere faser; **publisering** fortsatt via eksisterende Sanity/broker-mønstre; CP10 legger ikke ny sannhet, men **tydeligere vei** til `/backoffice/week-menu`.
- **Control towers:** Fortsatt under samme backoffice-skall; CP10 **grupperer ikke** faner visuelt (bevisst minimalt grep).

## 3. Hva som fortsatt er svakt

- **Global fulltext** og **fleksibel command palette** (mutasjoner) — ikke levert.
- **Samlet versjonshistorikk-UI** på tvers av Postgres + Sanity — fortsatt **simulert fortelling** der kilder er delt.
- **Document-type**-dybde — for det meste dokumentert; begrenset ny kode i workspace.

## 4. Hvor nær «Umbraco / verdensklasse»

Lunchportalen er **CMS-led og sterkere enterprise-koherent på navigasjon og redaktør-hastighet** enn før CP10, men **ikke** teknisk identisk med Umbraco. Avstanden er størst på **globale søk** og **enhetlig versjonering**.

## 5. Før ubetinget enterprise-live-ready (minimalt, prioritert)

1. Eksplisitt **produktbeslutning** om global søk (indeks vs. klient-only utvidelser).
2. **Historikk/rollback**-UI som **aldri** overstiger faktiske API-kontrakter.
3. Gjennomgå **modulpostering** (LIVE/LIMITED/…) per modul mot faktisk backend i staging.

## 6. Hva som kan vente

- Faner gruppert i visuelle «seksjoner» (IA).
- Avansert document-type arv og composition (eventuell replatforming-diskusjon).
