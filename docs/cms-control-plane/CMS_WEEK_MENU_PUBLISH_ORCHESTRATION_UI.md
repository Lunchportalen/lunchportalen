# CMS — Week / menu publish orchestration UI (CP6)

| Komponent | Rolle |
|-----------|--------|
| `CmsWeekMenuPublishOrchestrator` | Toppseksjon: tittel + kjede + readiness + handoff |
| `CmsMenuPublishReadinessSummary` | Teller funnede nøkler vs. forventede |
| `CmsSanityPublishHandoffCard` | Primær CTA til Studio — eksplisitt publish-handoff |
| `CmsWeekMenuPublishControlsPanel` | Operativ vs editorial (bevart under orkestratoren) |

**Prinsipp:** Publisering av operativ meny = **Sanity**; Lunchportalen **orkestrerer og måler**, muterer ikke meny i egen DB.
