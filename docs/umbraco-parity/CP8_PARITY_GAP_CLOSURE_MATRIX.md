# CP8 — Parity gap closure matrix

| Capability | Current state | Evidence | Gap | Planned CP8 action | Risk |
|------------|---------------|----------|-----|---------------------|------|
| sections | Sterk | `TopBar` TABS | Mange faner — kan oppleves tett | Dokumenter; ev. senere gruppering | Lav |
| dashboards | Delvis | `/backoffice/control`, `/backoffice/runtime` | Ikke én «start»-dashboard som Umbraco | Tydeligere inngang fra control | Lav |
| workspaces | Sterk | Content workspace, week-menu orkestrator | To «motorer» (Postgres vs Sanity) | Språk + seksjoner | Medium |
| content apps / context surfaces | Sterk | `CONTROL_PLANE_DOMAIN_ACTION_SURFACES` | Mer inline actions | Iterativ | Lav |
| document-type-liknende modellering | Delvis | Page kinds, Sanity `_type` | Splittet | `CP8_DOCUMENT_TYPES_AND_PROPERTY_EDITORS.md` | Medium |
| property-editor-liknende modellering | Delvis | Schema-drevet blokker | Labeling | Tydeligere feltroller i UI | Medium |
| media workflow | Sterk | `/backoffice/media` + API | DAM-paritet | Dokumentert | Lav |
| content tree | Sterk | `ContentTree` | Filter/søk | Senere | Lav |
| preview | Sterk | Preview routes | Ulike for page vs meny | Dokumentert | Lav |
| publish | Sterk | Workflow + CP7 | To publish-konsepter | Én fortelling i kjede-tekst | Medium |
| save/publish UX | Delvis | Autosave patterns | — | Editorial contract | Medium |
| versioning / history / rollback-fortelling | Delvis | Page recovery + Sanity history | Ikke unified | Ærlig «hvor ser du historikk» | Medium |
| week/menu publish from CMS | Sterk | Broker + Studio | Bulk publish | Ikke i CP8 | Lav |
| company/customer/agreement/location CMS experience | God | Customers, agreement-runtime | Full mutasjon i CMS | Routing only | Medium |
| control towers as modules | God | Domain surfaces + lenker | Visuell enhet | Én historie | Lav |
| social module | LIMITED ofte | `moduleLivePosture` | Overlov | Badge | Medium |
| SEO module | Sterk | seo-growth + content | — | Paritetsspråk | Lav |
| ESG module | Read | `/backoffice/esg` | Rapportmotor | Read-only ærlighet | Medium |
| permissions / role experience | Splittet | Superadmin backoffice | Ikke én RBAC | Dokumentert | Høy hvis blandes feil |
| module posture / honesty | Sterk | `CmsRuntimeStatusStrip` | Konsistent plassering | Iterativ | Lav |
| operational publish orchestration | Sterk | CP7 + kjede | Kjede sa «kun Studio» | **CP8: tekst oppdatert** | Lav |
