# U26 — Decision

## 1. Endelig beslutning

**GO WITH CONDITIONS** — Legacy er tydelig merket; trygg oppgradering til kanonisk dokumenttype i UI; AI preflight mot allowlist når dokumenttype er satt; read-only management-paritet via Settings + API. Ingen batch-migrering eller DB-typestore.

## 2. Hva som er oppnådd

- **CMS** som kontrollflate for innhold; runtime (ordre, avtaler, faktura) urørt.
- **Domener mot CMS:** public page body, backoffice editor, publish; uke/meny-kjede uendret i kode.
- **Settings / typer:** code registry + ny **Management read**-flate og **GET governance-registry**.
- **Legacy vs envelope:** banner + knapp «Oppgrader til kanonisk envelope»; lagring skriver fortsatt envelope via eksisterende save.
- **Sections/trees/workspaces:** ingen strukturell omlegging.

## 3. Hva som fortsatt er svakt

- Persisterte Umbraco-lignende typer i database (replatforming).
- Bulk/collection-paritet begrenset.
- Moduler med LIMITED/DRY_RUN/STUB avhenger av eksisterende posture-flagg.

## 4. Nærhet til Umbraco 17 / verdensklasse

- **Governance-tydelighet:** bedre; **teknisk identitet:** fortsatt Next.js-stack.

## 5. Før ubetinget enterprise-live-ready

1. Eventuell godkjent migreringsjobb for legacy-rader (utenfor U26).
2. Fortsett ærlig modulposture i runtime-flater.

## 6. Kan vente

- Full Management API, dynamiske content type filters i DB.
