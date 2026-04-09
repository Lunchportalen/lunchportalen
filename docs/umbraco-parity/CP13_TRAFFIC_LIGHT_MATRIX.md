# CP13 — Traffic light matrix

| Kategori | Status | Evidence | Why | Required action |
|----------|--------|----------|-----|-----------------|
| Extension registry parity | **GREEN** | `backofficeExtensionRegistry.ts` | Én manifest-liste | Ved nye ruter: kun registry |
| Sections / dashboards parity | **YELLOW** | `sectionId` + grupper | Dashboard KPI ikke sentralisert | Valgfritt senere |
| Tree / workspace parity | **YELLOW** | `collectionKey` | Ikke server tree API | Akseptert |
| Workspace context parity | **YELLOW** | `backofficeWorkspaceContextModel.ts` | Ikke brukt overalt | Gradvis innføring |
| Property editor parity | **YELLOW** | Uendret schema | CP11 basis | Egen UX-fase |
| Management / delivery clarity | **GREEN** | `domainSurfaceId` / posture ids | Koblet til CP4/CP6 | — |
| Week/menu publishing from CMS | **GREEN** | `week_menu` surface | Uendret kjede | — |
| Company/customer/agreement/location connectivity | **YELLOW** | Runtime sannhet | — | — |
| Company admin runtime | **GREEN** | — | — | — |
| Kitchen runtime | **GREEN** | — | — | — |
| Driver runtime | **GREEN** | — | — | — |
| Superadmin runtime | **GREEN** | Frosset | — | — |
| Social module | **YELLOW** | posture | LIMITED | Ærlig UI |
| SEO module | **YELLOW** | — | LIMITED | — |
| ESG module | **YELLOW** | — | LIMITED | — |
| AI governance / modularity | **YELLOW** | manifest + API | Ingen settings UI | Fremtidig |
| Access/security | **GREEN** | Ikke rørt | — | — |
| Cron/worker/job safety | **GREEN** | — | — | — |
| Support/ops | **YELLOW** | — | — | — |
| Scale confidence | **YELLOW** | Next app | — | — |
| Overall Umbraco 17 parity | **YELLOW** | CP13 struktur | Teknisk ikke Umbraco | UX/compose parity |
