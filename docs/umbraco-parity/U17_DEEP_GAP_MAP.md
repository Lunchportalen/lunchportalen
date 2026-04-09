# U17 — Deep gap map

| Capability | Current state | Repo evidence | Gap to Umbraco 17 parity | Planned action | Risk |
|------------|---------------|---------------|---------------------------|----------------|------|
| Extension registry | **Sterk** | `backofficeExtensionRegistry.ts` | Ingen JSON-fil på disk | Valgfri export | Lav |
| Sections | **Sterk** | `sectionId`, gruppe-labels | Dashboard KPI ikke sentralisert | Dokumentert | Lav |
| Trees / collections | **God** | `collectionKey` | Ikke server-tree API | UX/IA | Medium |
| Workspaces | **God** | `BackofficeWorkspaceSurface`, routes | — | Context strip (U17) | Lav |
| Workspace context | **Forbedret** | `BackofficeExtensionContextStrip`, `backofficeWorkspaceContextModel.ts` | Ikke global React Context | Gradvis | Medium |
| Workspace views / content apps | **God** | Content panels, CP11 docs | Ikke alle workspaces har like mange paneler | Iterativ | Medium |
| Global context-lignende state | **Delvis** | Strip + hooks per domene | Ingen én Bellissima GlobalContext | Type-modell | Medium |
| Document-type-liknende modell | **God** | Page kinds, `editorBlockTypes` | Ikke DB-backed document types | UX | Medium |
| Data-type-liknende modell | **God** | `blockFieldSchemas` | Ikke Umbraco Data Type entitet | TS-schema | Lav |
| Property-editor-liknende modell | **God** | `SchemaDrivenBlockForm`, editors | Publish-kritisk merking ujevn | Merkefelt | Medium |
| Content tree | **Sterk** | `ContentTree`, API | — | — | Lav |
| Media workflow | **God** | `backoffice/media` | Ingen global media FTS | Valgfritt | Medium |
| Preview | **God** | Preview routes | — | Copy | Lav |
| Publish | **God** | Content API, workflow | Flerkilder | Ærlig UI | Medium |
| History/versioning | **UX** | Strip, Postgres vs Sanity | Én motor | Produkt | Høy |
| Rollback story | **Delvis** | Per domene | Full rollback ikke overalt | Ærlig UI | Medium |
| Management vs delivery clarity | **Forbedret** | Domain surfaces + strip | — | Dokumentasjon | Lav |
| Company/agreement/location | **Runtime sannhet** | Supabase, admin | CMS speiler/review | Uendret | Lav |
| Week/menu publish | **Ærlig** | `week-menu`, Sanity-kjede | Studio handoff | UX | Medium |
| Company admin tower | **Egen** | `/admin` | Lenket fra manifest/metadata | — | Lav |
| Kitchen / driver / superadmin | **Egen** | egne ruter | Ikke «inne i» backoffice UI | Discovery | Lav |
| Social / SEO / ESG | **Posture** | `moduleLivePosture`, surfaces | LIMITED/DRY_RUN | Ærlig UI | Medium |
| Runtime-status / posture | **Sterk** | Module registry + strip | — | — | Lav |
| Permissions / roles | **Server** | Layouts, auth | Ikke Umbraco-node-ACL | RBAC-fase | Medium |
| Ops/runbook | **Spredt** | `docs/hardening` | Én runbook | Senere | Medium |
| AI governance | **Sterk** | CI + API | Settings UI | Senere | Medium |
| AI modularity | **Sterk** | Mange ruter | — | — | Lav |
| AI approval | **Delvis** | Content workflow | Eksplisitt overalt | UX | Medium |
| Provider flexibility | **God** | env, checks | — | — | Lav |
| AI cost posture | **Delvis** | Usage der implementert | Dashboard | Senere | Medium |
