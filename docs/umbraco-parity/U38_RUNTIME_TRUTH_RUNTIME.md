# U38 Runtime Truth Runtime

## Landed

- `PATCH /api/backoffice/content/pages/[id]` preserves existing variant envelope metadata during blocks-only updates.
- `POST /api/backoffice/content/pages/[id]/variant/publish` returns a flat and test-locked payload.
- `POST /api/content/global/settings` now requires authenticated `superadmin`.
- `globalPublicGetResponse()` now emits `x-rid`.
- `getSettings()` stays fail-closed for legacy callers.
- ESG monthly rollups degrade as `query_failed` when the source query genuinely fails.

## Operational Meaning

- CMS writes are less likely to silently lose content metadata.
- Settings writes now respect control-plane authority.
- Operators can distinguish legacy schema drift from runtime query failure in ESG.

## Still Needed

- Manual proof of the authenticated settings write path and degraded routes in the browser.
