# U25 — Next steps (only if product approves)

1. Optional integration test: `POST /api/backoffice/content/pages` with/without `body`, assert stored envelope shape.
2. Approved migration script: flat `{ version, blocks }` → envelope for rows that should be governed (batch, dry-run first).
3. Extend Settings copy when new document types are added to `contentDocumentTypes.ts` (single PR discipline).

**Stop:** No new product phases from this list without explicit charter.
