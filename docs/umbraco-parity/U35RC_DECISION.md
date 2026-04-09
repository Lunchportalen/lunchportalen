# U35RC Decision

- Title: U35RC Bellissima final structural closure decision
- Scope: section/entity workspace publication truth, inspector/view/action compatibility shutdown, settings management-object convergence, and tree/history status alignment.
- Repro:
  1. Open `/backoffice/content`.
  2. Open `/backoffice/content/[id]`.
  3. Open `/backoffice/settings`, `/backoffice/settings/system`, and `/backoffice/settings/governance-insights`.
  4. Open `/backoffice/settings/document-types` and `/backoffice/settings/data-types`.
- Expected: one Bellissima-like control-plane line where section and entity workspaces do not compete for one snapshot, inspector/history/action truth is shared, and settings/governance/system behave like coherent management workspaces.
- Actual: achieved by splitting publication scope in the Bellissima provider, removing live inspector compat vocabulary, moving governance/system onto the shared management frame/model, and tightening history/action language across settings/content.
- Root cause: U34 delivered the stronger Bellissima runtime line, but the last competing truths still lived in shared publish flow, inspector compatibility props, standalone settings surfaces, and duplicated action/history posture.
- Fix: converge those last gaps onto the canonical provider/model/action/status lines instead of leaving transitional wrappers in place.
- Verification:
  - `npm run typecheck`: PASS
  - `npm run lint`: PASS (existing non-blocking warnings remain elsewhere in the repo)
  - Enterprise pre-build gate chain: PASS (`agents:check`, `ci:platform-guards`, `audit:api`, `audit:repo`, `check:admin-copy`, `check:ai-internal-provider`, `verify-control-coverage`)
  - Direct RC `next build`: PASS
  - `npm run seo:proof`: PASS
  - `npm run seo:audit`: PASS
  - `npm run seo:content-lint`: PASS
  - `npm run test:run`: PASS
  - `npm run sanity:live`: soft PASS / skipped because no reachable local app URL was available on this host

## Decision

- Accept U35RC as the runtime closure phase for the remaining Bellissima structural/editor convergence gaps.
- Keep explicit `section` and `entity` publication scopes in `ContentBellissimaWorkspaceContext` as the canonical publication model.
- Keep inspector-section, workspace-view labels, history-status tone, and action naming on shared helpers instead of reviving compat props or duplicated page-local vocabularies.
- Keep settings overview, governance insights, system, document types, data types, create policy, schema, management read, and AI governance on one management-object posture.
- Do not reintroduce wrapper hosts, duplicate nav registries, or parallel audit/history status lines after this phase.
