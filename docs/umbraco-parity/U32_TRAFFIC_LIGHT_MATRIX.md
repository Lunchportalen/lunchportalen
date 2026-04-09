# U32 - Traffic light matrix

| Category | Status (GREEN/YELLOW/RED) | Evidence | Why | Required action |
| --- | --- | --- | --- | --- |
| Extension registry parity | YELLOW | `backofficeExtensionRegistry` now drives stronger content/settings workspace metadata | Stronger than before, but still a local custom registry rather than full Umbraco extension runtime | Keep extending the shared registry model without inventing a second manifest system |
| Sections / menus parity | YELLOW | Content and settings now read more like first-class sections | Improved in scope, but not yet uniformly Bellissima across all modules | Continue section/menu normalization module by module |
| Tree / workspace parity | GREEN | `/backoffice/content` is tree-first and `/backoffice/content/[id]` is the clear detail route | Section -> tree -> workspace is now explicit in content | Lock with browser smoke coverage |
| Workspace context parity | GREEN | `ContentBellissimaWorkspaceContext` now owns active view and model publishing | Shared workspace identity is now real, not cosmetic | Extend the same model where adjacent modules justify it |
| Workspace views parity | GREEN | Explicit `overview/growth/recycle-bin` and `content/preview/history/global/design` view ids now exist | View identity is model-driven instead of ad-hoc | Keep AI/runtime/SEO honest as apps unless promoted to real views later |
| Workspace actions parity | GREEN | Header/save/footer now read primary/secondary actions from the Bellissima model | Action intent is explicit and shared | Add browser coverage for state transitions |
| Footer app parity | GREEN | Footer apps now render from the shared model in section and entity scope | Status is calmer and more persistent | Expand only where the same model is truly needed |
| Entity actions parity | GREEN | Tree/workspace surfaces now share entity action language and menu pattern | Shared action intent is much clearer | Continue alignment in discovery/collection surfaces |
| Property editor parity | YELLOW | The editor shell is calmer, but property/block editing is still a custom mix of forms, rails, and legacy posture | Better UX does not equal full Umbraco property editor parity | Separate property-editor platform work from U32 follow-ups |
| Management / delivery clarity | YELLOW | Settings and control-plane posture are clearer; runtime-linked domains remain honest | Clearer than before, but management parity is still uneven outside content/settings | Continue management-surface consolidation carefully |
| Discovery / quick find parity | YELLOW | Tree-first navigation improved, but no full Bellissima-grade quick find was added | Discovery is better, not complete | Plan discovery as a separate scoped phase |
| Unified history parity | YELLOW | Content history/audit posture is improved and explicit | Still no shared history/governance platform across modules | Keep history platform work separate and explicit |
| Week/menu publishing from CMS | GREEN | `moduleLivePosture` still marks operational week/menu governance as `LIVE`, with publishing in Sanity Studio | U32 preserved the existing CMS publish chain and did not reintroduce duplicate truth | Keep week/menu truth on the existing published chain |
| Settings section parity | GREEN | Settings chrome now uses shared collection/workspace metadata and explicit tabs | Settings is now a real management section in scope | Continue only with honest code-governed posture unless approved otherwise |
| Document type parity | YELLOW | Document type surfaces are clearer, but still code-governed | Structural clarity improved without persisted type editing | Decide whether persisted CRUD is actually needed |
| Data type parity | YELLOW | Data type posture is clearer through settings metadata | Still not a full data-type management runtime | Same decision point as document types |
| Create policy parity | YELLOW | Create/settings flows are clearer in content and settings | Policy is explicit, but not a full Bellissima create-policy platform | Keep policy work minimal and explicit |
| AI governance / modularity | YELLOW | AI/editor surfaces remain available and contained | Still not a full governed workspace/app platform | Keep AI modular and human-reviewed |
| Access/security | GREEN | No auth, routing, or frozen security-sensitive flow was changed | U32 stayed inside control-plane scope | Maintain fail-closed server-side access rules |
| Cron/worker/job safety | YELLOW | U32 did not regress worker/cron posture; module registry still marks some areas as `STUB`/`INTERNAL_ONLY` | Safety posture is honest, but not broad-live everywhere | Keep jobs/worker hardening separate from workspace UX work |
| Support/ops | YELLOW | Tree/audit operator messages are materially stronger | Better support posture, but not a unified ops platform | Continue exposing honest degraded states where missing |
| Scale confidence | YELLOW | Host/context consolidation reduces local drift and improves maintainability | Still a large custom system with mixed legacy surfaces | Keep changes focused and avoid broad speculative refactors |
| Overall Umbraco 17 parity | YELLOW | Content workspace is near-Umbraco in structure; full platform parity is not there yet | Strong vertical parity, incomplete platform parity | Treat further parity work as deliberate phase-by-phase hardening |
