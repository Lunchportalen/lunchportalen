# CP7 — Decision

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- **GO:** Native `menuContent` publish broker + dokumentasjon er i tråd med én operativ Sanity-kilde.
- **Betingelser:** `SANITY_WRITE_TOKEN` må være satt der broker skal brukes; Studio forblir redigeringsflate; `menu_visibility_days`/cron utenfor CP7.

## 2. Hva som er oppnådd

- CMS (`/backoffice/week-menu`) har **ekte publish-hendelse** (server-broker) i tillegg til Studio-handoff.
- Domener: **meny/uke** koblet tydelig til `GET /api/week` og Sanity **publisert** perspektiv.
- Control towers forblir under samme plan; **ingen** ny runtime-sannhet.

## 3. Hva som fortsatt er svakt

- Synk mellom DB-visibility og Sanity er ikke fullt kartlagt i kode i CP7.
- Growth-moduler kan fortsatt være LIMITED — avhenger av deployment konfigurasjon.

## 4. Nærhet til «verdensklasse»

- **Ærlig vurdering:** Bedre operativ klarhet og publish-kontroll enn ren handoff; fortsatt avhengig av Sanity Studio for innholdsredigering og av miljø for token.

## 5. Før ubetinget enterprise-live-ready

1. Bekreftet token-policy og rotasjon for `SANITY_WRITE_TOKEN`.
2. Runbook for meny-publish inkl. CDN-latens/validering.
3. Eventuell eksplisitt kobling dokumentert mellom `menu_visibility_days` og Sanity (hvis begge brukes samtidig i drift).

## 6. Kan vente

- Bulk-operasjoner, innebygd Studio, avansert release-styring.
