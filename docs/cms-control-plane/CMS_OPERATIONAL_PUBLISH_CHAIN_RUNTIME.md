# CMS — Operational publish chain (runtime)

**CP5:** Datastruktur `OPERATIONAL_WEEK_MENU_PUBLISH_CHAIN` (`lib/cms/operationalWeekMenuPublishChain.ts`) + UI `CmsOperationalPublishChain`.

**Rekkefølge:** Avtale (DB) → Studio publish (meny) → GET /api/week → ansatt-uke.

**Ikke inkludert:** Postgres content publish, editorial weekPlan (egen boundary).
