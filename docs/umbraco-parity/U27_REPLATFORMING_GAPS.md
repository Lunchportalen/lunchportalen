# U27 — Replatforming gaps (ærlige grenser)

## Krav som ikke blir 100 % teknisk lik Umbraco 17 uten replattformering

| Område | Gap | Forsvarlig simulering på dagens stack |
|--------|-----|--------------------------------------|
| Extension manifest / dynamisk lasting av UI-pakker | Krever egen host for extensions | Statisk registry i kode + dokumenterte moduler |
| Management API full CRUD på schema | Krever .NET Umbraco + DB-modell | Code registry + read-only insights |
| Distributed cache / Umbraco cache events | Annen runtime | Next.js cache/revalidate + eksplisitte `force-dynamic` der nødvendig |
| Native entity bulk pipeline | Server-plugginer + batch jobs | Trygge clipboard-bulk + superadmin read API |
| Workspace context som injectable DI | Annen arkitektur | Eksplisitte React hooks + server routes |

## Hva som løses med UX/flow-paritet

- Collections med søk, filter der det finnes, multi-select + trygge handlinger.
- Management «read model» via aggregerte API-er.
- Tydelig legacy vs envelope i dashboards.

## Eksplisitte REPLATFORMING_GAP-merknader

- **Full** Umbraco **Entity Bulk Actions** med server-plugins → ikke duplisert i Node uten ny orkestrator.
- **Umbraco AI** som in-process tjeneste → Lunchportalen bruker egne AI-ruter; governance er lagvis.
