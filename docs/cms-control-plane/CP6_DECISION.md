# CP6 — Decision

## 1. Endelig beslutning

**GO WITH CONDITIONS**

## 2. Hva som er oppnådd

- **In-CMS publish orchestration** for uke/meny: én orkestrator-seksjon med kjede, readiness og **eksplisitt Sanity-handoff** (ikke bare lenker spredt på siden).
- **Strammere live posture:** `MODULE_LIVE_POSTURE_REGISTRY` + tabell på domener + growth-callout med **posture** og **advarsel** når ikke bred live.
- **Action routing:** `whyMatters` på alle domain surfaces; kunder-siden viser fullt domain-kort.
- **Runtime/API uendret** for ordre, uke, avtale-sannhet.

## 3. Hva som fortsatt er svakt

- Worker **STUB**, social **DRY_RUN** — ekte plattformjobber utenfor CP6.
- Ingen automatisk innbygget Studio (bevisst — iframe/handoff-avveining).

## 4. Umbraco-/verdensklasse

**Ærlig:** Sterk orkestreringsfortelling og posture-disiplin; ikke full multi-site editorial workflow.

## 5. Før ubetinget enterprise-live-ready

1. Worker/cron produksjonsklar.
2. Global sikkerhetsaudit.
3. Observability.

## 6. Kan vente

- Dypere Studio-integrasjon (SDK) — egen beslutning.
