# Legacy write freeze and read-only enforcement

## 1. Purpose

Ensure **no double authority** for migrated CMS content: after cutover for a content family, **legacy Postgres-backed editors** must not remain a **peer write path**.

## 2. How write freeze is declared

| Element | Requirement |
|---------|---------------|
| **Decision record** | Dated **freeze notice**: which document types, which environment, effective UTC time |
| **Communication** | Editorial + engineering channels; link to Workflow in Umbraco as new authority |
| **Runbook** | “If emergency edit needed” = **only** via Umbraco + incident ticket (no silent Postgres patch) |

## 3. What counts as legacy writes (inventory — representative)

**API routes (Next/Supabase) under `app/api/backoffice/content/`** that mutate `content_pages` / `content_page_variants` or editorial workflow, including but not limited to:

- `pages/[id]/variant/publish`, `pages/[id]/workflow`
- `tree` (move/reorder when persisting `content_pages`)
- `publish-home`, `build-home`
- `batch-normalize-legacy`
- Any `upsert`/`insert`/`update` on variants or pages for **marketing** content

**UI:** Backoffice content workspace and related clients that call the above.

**Other:** SQL scripts, cron jobs, or imports writing the same tables for **editorial** purposes.

*Complete list = **engineering deliverable** during implementation; this doc defines **classification**, not claiming every file is enumerated.*

## 4. Read-only enforcement mechanisms (design options)

| Layer | Mechanism |
|-------|-----------|
| **Application** | Feature flag / config: `CMS_LEGACY_WRITE_MODE=off` for migrated roots |
| **API** | Guard middleware: reject mutating methods with **423** or **403** + `rid` |
| **Database** | **Optional** Postgres RLS/trigger deny on `content_pages` for service role **except** break-glass role |
| **Deploy** | Remove editor role permissions in app for content modules |

**Default recommendation:** **API + flag** minimum; DB hardening **preferred** for high assurance.

## 5. Violation observation

| Signal | Action |
|--------|--------|
| **Metrics** | Count of blocked writes post-freeze (should be **zero**; spikes = incident) |
| **Audit** | Application logs with `rid`, route, `profile_id` |
| **DB audit** | Optional trigger log table for attempted updates |

## 6. Exceptions

| Case | Process |
|------|---------|
| **Incident break-glass** | Security + CTO approval; **time-boxed** role; post-incident review |
| **Rollback** | See §7 |

## 7. Rollback interaction

- **Rollback** of *migration* (revert read path) is a **Phase 7+** program decision.
- **Freeze rollback** (re-enable legacy writes) **invalidates** “sole Umbraco authority” claim and must be **recorded** as controlled incident with re-freeze plan.

## 8. Evidence that freeze is real

Binary proof (staging first, then live):

1. Attempted `POST`/`PUT` to legacy publish route → **consistent denial** with logged `rid`.
2. **DB:** No successful editorial writes to migrated rows in **monitoring window** (e.g. 7 days) except approved jobs.
3. **Editorial:** Signed attestation that production edits occurred **only** via Umbraco for sample pages.

## 9. Relationship to cutover

**Program lock:** No production cutover while legacy **write** paths remain for migrated types. Phase 5 defines **how** freeze is enforced and proven; **cutover timing** is Phase 7+.
