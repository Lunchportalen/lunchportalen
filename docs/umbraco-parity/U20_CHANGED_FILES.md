# U20 — Changed files

## Kode

| Fil | Hvorfor | Minimal risiko |
|-----|---------|----------------|
| `app/api/backoffice/control-plane/discovery-entity-bundle/route.ts` | Bundle av `content_pages` + `media_items` for palett | Superadmin + admin client; begrenset limit |
| `app/api/backoffice/content/audit-log/route.ts` | Les `content_audit_log` for tidslinje | Superadmin; metadata trimmet |
| `lib/cms/backofficeDiscoveryEntities.ts` | Filtrer/ranger entiteter; unike palett-nøkler | Ren klientlogikk |
| `components/backoffice/BackofficeCommandPalette.tsx` | Fetch bundle ved åpning; fusjon ved søk | Samme palett-komponent |
| `components/cms/control-plane/EditorialAuditTimelinePanel.tsx` | Audit-feed med kilde-badge | Client fetch |
| `components/cms/control-plane/CmsHistoryDiscoveryStrip.tsx` | Monter audit-feed | Presentasjon |
| `components/backoffice/AiGovernanceSettingsPanel.tsx` | AI status fra eksisterende API | Ingen secrets |
| `app/(backoffice)/backoffice/ai-control/page.tsx` | Innlemme settings-panel | Layout |
| `tests/cms/backofficeDiscoveryEntities.test.ts` | Enhetstester for entitetsfusjon | — |

## Dokumentasjon

| Fil |
|-----|
| `docs/umbraco-parity/U20_*.md` (baseline, runtime, beslutning, matrise, signoff, risiko, neste steg, verifikasjon) |
