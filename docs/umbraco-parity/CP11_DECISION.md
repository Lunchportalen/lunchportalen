# CP11 — Decision

**Dato:** 2026-03-29

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- **GO:** Felles workspace-krom, grupperte palett-treff, én H1 per growth-visning, ærlig publish/history-notis på uke/meny, enterprise build og tester grønne.
- **Betingelser:** Teknisk én global historikktidslinje og full Umbraco document-type-arv er fortsatt **ikke** levert (dokumentert som plattform/UX-grep).

## 2. Hva som er oppnådd

- **CMS som base:** Primær backoffice-flater deler nå samme **workspace-header-mønster** (`BackofficeWorkspaceSurface` / `BackofficeWorkspaceHeader`) der det er innført.
- **Domener som snakker med CMS:** Domener, kunder, avtale, uke/meny, SEO, Social, ESG, media — **navigasjon og krom** er mer konsistent; runtime-sannhet uendret.
- **Ukemeny/ukeplan:** Uendret publiseringskjede; **tydeligere** forklaring av to spor + historikk-ærlighet i workspace-notis.
- **Control towers:** Fortsatt under `BackofficeShell`; CP11 endrer ikke tower-logikk, kun **lesbarhet** på tilknyttede flater.

## 3. Hva som fortsatt er svakt

- Global **fulltext-søk** (indeks) — utenfor CP11.
- **Samlet versjonshistorikk-UI** — fortsatt ikke teknisk én motor.
- Dyp **property-editor-gruppering** i content workspace — delvis dokumentert, begrenset ny kode.

## 4. Nærhet til Umbraco / verdensklasse

Sterkere **følelse av ett CMS** på navigasjon og workspace-inngang; fortsatt **ikke** teknisk Umbraco. Største gap: **søk** og **enhetlig versjonering**.

## 5. Før ubetinget enterprise-live-ready (minimalt)

1. Produkt-/arkitekturvalg om **global søk** (indeks vs. utvidede klientfiltre).
2. **Historikk-UX** som aldri overskrider faktiske API-er.
3. Kontinuerlig avstemming av **modulpostering** mot backend.

## 6. Kan vente

- Visuell **seksjonsinndeling** i TopBar (IA).
- Dyp document-type-komposisjon (eventuell replatforming).
