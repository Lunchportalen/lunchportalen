# CP5 — Decision

## 1. Endelig beslutning

**GO WITH CONDITIONS**

## 2. Hva som er oppnådd

- **Én eksplisitt operativ publish-kjede** for uke/meny i UI (`CmsOperationalPublishChain` + data i `operationalWeekMenuPublishChain.ts`).
- **Action-routing-modell** via `actionRouting` på alle domain surfaces — **leser, skriver, påvirker, publish-kontroll**.
- **Tårn** forklart i samme kort (ikke bare lenker).
- **Growth-moduler:** felles callout med ærlig badge + lenker til content/media/domener.
- **Ingen** ny menymotor eller agreement-sannhet; **GET /api/week** uendret.

## 3. Hva som fortsatt er svakt

- Worker **STUB**, social **DRY_RUN**, begrenset ekstern publish.
- Global sikkerhetsaudit utenfor CP5.

## 4. Umbraco-/verdensklasse

**Ærlig:** Sterk governance- og routing-fortelling i backoffice; ikke full multi-tenant workflow-plattform.

## 5. Før ubetinget enterprise-live-ready

1. Lukk worker/queue-risiko.
2. Fullfør audit/hardening for API/middleware.
3. Observability v1.

## 6. Kan vente

- Dypere automatisering av Studio-workflows.
