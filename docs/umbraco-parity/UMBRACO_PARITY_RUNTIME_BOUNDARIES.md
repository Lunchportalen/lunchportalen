# Umbraco parity — runtime boundaries

## CMS control plane skal eie

- **Content tree** og **side/blokk**-redigering (Postgres-lag).
- **Design scopes**, **media** (CMS-lag), **preview/publish** for nettsideinnhold.
- **Sanity-basert** meny/innhold der det er definert (`menu`, `menuContent`, `weekPlan` redaksjonelt).
- **Publiseringskontroll:** inkl. CP7 **server-broker** for `menuContent` der token finnes.
- **Review/godkjenning** der implementert (content workflow).
- **Control tower–fortelling:** hvem som leser/skriver hva, med **routing** til runtime.
- **AI-assistert redigering** innenfor eksisterende API-er og governance.
- **SEO/social/ESG presentasjon** som *lesing*, *review* og *ærlig status* — ikke ny transaksjonssannhet.

## Operational runtime skal eie

- **Auth/session** og rolle-sannhet (server).
- **Ordre, leveranse, bestillingsvindu** — immutable hendelser der definert.
- **Fakturagrunnlag / billing engine**.
- **Audit events** og **cron/aggregater** i Supabase/ workers.
- **Avtale-sannhet** (`company_current_agreement`, agreements) — endring via **godkjente** admin/superadmin-ruter, ikke «skjult» fra CMS uten routing.

## Flows som må synkroniseres (konseptuelt)

- **Publisert meny (Sanity)** ↔ **ansatt visning** (`GET /api/week`) — samme publiserte perspektiv.
- **Aktiv avtale** ↔ **hva ansatte ser** (leveringsdager, tier).
- **Offentlig innhold** ↔ **Postgres publish** — ikke bland med meny-Sanity.

## Read-only i CMS (typisk)

- Direkte mutasjon av **ordre**, **faktura**, **immutable log** — **nei**; kun innsikt/routing.

## Publish / review fra CMS (typisk)

- **Nettsider** (Postgres) — ja, via content workspace.
- **menuContent** — publish via Studio eller **broker** (CP7); ikke duplikat DB.
- **weekPlan** — redaksjonelt; **ikke** erstatning for operativ uke.

## Flows som aldri skal flyttes ut av runtime uten eget arkitekturvedtak

- Ordre-/betalings-/faktura-pipeline.
- Tenant-isolasjon og `profiles.company_id`-sannhet.
- Kritiske cron-låser (ukeplan visibility etc.) uten ny risikoanalyse.
