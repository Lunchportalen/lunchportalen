# U32 - Open risks

## Open platform risks

- Settings is structurally stronger, but document types and data types are still code-governed management surfaces rather than persisted editors.
- Content now has strong Bellissima structure, but discovery/quick-find parity is still weaker than a full Umbraco 17 backoffice.
- Unified history/governance posture is still mostly a content story, not a platform-wide one.
- Some legacy naming still exists in the wider repo (`page` / `editor` semantics) even though the canonical content workspace id is now `content`.
- Existing repo-wide lint warnings remain outside U32 scope and can still hide future regressions.
- `sanity:live` passed on the script's soft path because no reachable local app was running; that still needs environment-level verification when preparing a live release.

## Modules that are intentionally not broad-live yet

- `weekplan_editorial` -> `LIMITED`
- `social_calendar` -> `LIMITED`
- `seo_growth` -> `LIMITED`
- `esg` -> `LIMITED`
- `social_publish` -> `DRY_RUN`
- `worker_jobs` -> `STUB`
- `cron_growth_esg` -> `INTERNAL_ONLY`

## Reduced risks after U32

- Route-vs-local workspace truth in content is materially reduced.
- Tree/audit degraded states are more honest to the operator.
- Header/footer/actions/views now share one canonical workspace model.
- Content landing and detail routing are much clearer.

## Non-risks in this phase

- No auth/redirect loop risk was introduced.
- No new tenant-scope/data leakage path was introduced by U32.
- No new parallel editor, tree, settings, or history engine was introduced.
