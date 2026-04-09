# U37 Runtime Truth Corrections

## Close Now In Code
- Publish route vs audit contract
  - Route must write `publish`, not `content_publish`, to `content_audit_log`.
  - Add a shared constant/helper so the route and tests lock the same action value.

- `system_settings` baseline
  - Replace ad-hoc route normalization with one canonical baseline reader.
  - Read must stay honest when the table or row is missing: return fail-closed defaults plus explicit baseline status/operator guidance.
  - Settings management should read and write through the same backoffice-facing route surface.

- `esg_monthly` drift
  - Canonical runtime shape remains `delivered_count` / `cancelled_count`.
  - Loader must detect legacy column sets (`delivered_meals` / `canceled_meals`) and map them explicitly instead of hard-failing.
  - Response must expose whether it used canonical or degraded legacy fallback.

- Tree / audit degraded UX
  - Improve `operatorMessage`, `operatorAction`, `reason`, and schema hints where schema drift is recoverable.
  - Do not hide missing-table/missing-column/cache issues behind generic empty states.

## Mark Honest Stop, Do Not Fake
- Persisted CRUD for document/data types.
- A new settings engine, ESG engine, or history engine.
- Replatforming-only gaps that require a different storage model.
