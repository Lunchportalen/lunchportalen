# U37 Traffic Light Matrix

| Kategori | Status | Evidence | Why | Required action |
| --- | --- | --- | --- | --- |
| Extension registry parity | GREEN | `backofficeExtensionRegistry` er fortsatt kanonisk manifest | Ingen parallelle nav-/section-kilder | Behold én registry |
| Sections / menus parity | GREEN | Seksjoner og navgrupper er eksplisitte | Control-plane-hierarkiet er tydelig | Ingen |
| Tree / workspace parity | YELLOW | Tree-runtime er robust, men editorhost er fortsatt tung | Treet er bedre enn workspace-hosten | Splitt `ContentWorkspace.tsx` videre |
| Workspace context parity | YELLOW | Bellissima snapshot brukes, men hosten er fortsatt stor | Én modell finnes, men ikke alt er like rent | Fortsett host-opprydding |
| Workspace views parity | GREEN | Workspace views ligger i kanonisk modell | Oversikt/collection/workspace er eksplisitt | Ingen akutt |
| Workspace actions parity | YELLOW | Publish/audit er korrekt, men action-mønstre varierer fortsatt | Ikke full Bellissima-konsistens | Stram videre action-mapping |
| Footer app parity | YELLOW | Footer apps finnes i modellen | Ikke alle flater er like modne | Konsolider videre |
| Entity actions parity | YELLOW | Bedre create/publish-historie, men ikke full parity | Discovery/tree/header varierer fortsatt | Standardiser videre |
| Collection view parity | YELLOW | Settings collections finnes | Ikke full likhet på tvers av surfaces | Fortsett collection-opprydding |
| Document type parity | YELLOW | First-class management read | Fortsatt code-governed read model | Ikke kall det CRUD |
| Data type parity | YELLOW | Egne collections/workspaces | Fortsatt read-only modell | Samme som over |
| Property editor parity | YELLOW | Systemet er eksplisitt modellert | Ikke full persisted Bellissima-lifecycle | Viderefør hvis backend kommer |
| Property value preset parity | YELLOW | Defaults er tydeligere via katalogtruth | Ikke full preset-management | Løft senere |
| Create policy parity | YELLOW | Egen workspace og governance | Fortsatt mest policy/read | Kan styrkes senere |
| Settings section parity | GREEN | `system` er runtime-managed og baseline-aware | Settings er mer operasjonell | Ingen akutt |
| Management / delivery clarity | GREEN | Registry og posture skiller planene tydelig | Mindre lekkasje mellom kontroll og runtime | Behold |
| Discovery / quick find parity | YELLOW | Ingen ny regressjon, men ikke full parity | Ikke ferdig standardisert | Stram videre |
| Unified history parity | YELLOW | Audit route er robust og ærlig | Full history/workspace parity gjenstår | Viderefør senere |
| Week/menu publishing from CMS | YELLOW | CMS-governance, men Sanity-publish består | Samme sannhetskjede, men ikke full backoffice-publish | Eventuell senere replatforming |
| AI governance / modularity | YELLOW | AI governance er management-objekt | Ikke fullt integrert overalt | Fortsett modulært |
| Access/security | GREEN | Rolle-/route-guard endret ikke negativt | Ingen scope-relaxation introdusert | Behold |
| Cron/worker/job safety | YELLOW | Posture er ærlig `STUB/INTERNAL_ONLY` der nødvendig | Ikke full produksjonsgaranti | Ikke overlov |
| Support/ops | GREEN | Tree/audit/system/ESG gir bedre operator-signaler | Drift får tydeligere feilbilder | Behold |
| Scale confidence | YELLOW | Gates grønne, men build er tung | Korrekthet > fart nå | Senere performance-arbeid |
| Overall Umbraco 17 parity | YELLOW | CMS-led og enterprise-coherent | Ikke ærlig “near full parity” ennå | Ny editor/management-lukkerunde |
