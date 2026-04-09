# U25 — Traffic light matrix

| Kategori | Status | Evidence | Why | Required action |
|----------|--------|----------|-----|-----------------|
| Extension registry parity | YELLOW | Static modules | No dynamic manifest runtime | UX honesty; future registry service optional |
| Sections / dashboards parity | YELLOW | Backoffice shell | Good IA; not identical to Umbraco | Incremental |
| Tree / workspace parity | YELLOW | Content tree + workspace | Functional | — |
| Workspace context parity | YELLOW | Context models in docs/code | Partial | Continue CP work |
| Content apps parity | YELLOW | Panels/tabs | Overlapping concepts | — |
| Workspace actions parity | YELLOW | Save/publish/AI | Not full Umbraco surface | — |
| Footer app parity | YELLOW | Various status rails | Partial | — |
| Entity actions parity | YELLOW | Node menus | Limited | — |
| Collection view parity | YELLOW | List views | Partial | — |
| Bulk action parity | RED/YELLOW | Limited bulk | Not Umbraco-level | Defer or phase |
| Property editor parity | YELLOW | Schema-driven forms | Code-bound | — |
| Property dataset parity | YELLOW | Block/meta | No separate engine | Documented |
| Document type parity | YELLOW | `contentDocumentTypes.ts` + UI | Code registry | DB types = replatforming |
| Data type parity | YELLOW | Field kinds + schemas | Same | — |
| Creation flow parity | YELLOW | U25 POST + wizard | Improved | DB blueprints deferred |
| Settings section parity | GREEN | `/backoffice/settings/*` | Hub + schema pages | — |
| Settings persistence parity | YELLOW | Code + system_settings for ops | No fake type CRUD | Honest |
| Type governance enforcement | YELLOW | PATCH + POST + client | Legacy exception | Migrate when ready |
| Block allowlist enforcement | YELLOW | Server when DT set; duplicate UI | Legacy without DT | — |
| Management / delivery clarity | YELLOW | Docs + API contracts | Split model | — |
| Discovery / quick find parity | YELLOW | Backoffice discovery | Partial | — |
| Unified history parity | YELLOW | Version history | Partial | — |
| Week/menu publishing from CMS | GREEN | Chain test exists | Unchanged | — |
| Company/agreement/location connectivity | GREEN | Runtime truth | CMS does not own | — |
| Company admin runtime | GREEN | Existing | Unchanged | — |
| Kitchen runtime | GREEN | Read-only ops | Unchanged | — |
| Driver runtime | GREEN | Existing | Unchanged | — |
| Superadmin runtime | GREEN | Existing | Unchanged | — |
| Social module | YELLOW | Posture-driven | Module flags | — |
| SEO module | YELLOW | CRO/SEO panels | — | — |
| ESG module | YELLOW | Admin/superadmin | — | — |
| AI governance / modularity | YELLOW | Governance routes | — | — |
| Access/security | GREEN | Role gates on APIs | Unchanged | — |
| Cron/worker/job safety | GREEN | No U25 change | — | — |
| Support/ops | YELLOW | Runbooks partial | — | — |
| Scale confidence | YELLOW | Supabase/Next | — | — |
| Overall Umbraco 17 parity | YELLOW | U25 closes governance gaps | Not .NET parity | Roadmap |
