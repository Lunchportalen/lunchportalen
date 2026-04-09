# CP4 — Control plane module status

**Kilde:** `lib/cms/controlPlaneRuntimeStatusData.ts` — én liste brukt i strip, domener og dokumentasjon.

| id | badge | Betydning (CP4) |
|----|-------|------------------|
| content | LIVE | Postgres innhold — publisert innhold |
| media | LIVE | Media-bibliotek |
| week | LIVE | Operativ ansatt-uke (`/api/week`) |
| weekplan_editorial | LIMITED | Sanity weekPlan — **editorial** |
| seo | LIMITED | Review-first |
| social | DRY_RUN | Ekstern publish ikke fullt koblet |
| esg | LIMITED | Aggregater, tolkes forsiktig |
| worker | STUB | Bakgrunnsjobber ikke fullt ut |

**CP4 UI:** `CmsRuntimeStatusStrip` viser **«Published»** som menneskelesbar etikett når badge er **LIVE** (teknisk badge forblir LIVE i data).
