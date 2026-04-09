# Media — data model (Phase 2B2)

## Canonical table: `media_items`

Source: `supabase/migrations/20260309000000_media_items.sql` (+ forward fixes if any).

| Column | Purpose |
|--------|---------|
| `id` | UUID primary key — **blocks store this** as `imageId` / `mediaItemId` for library use |
| `type` | `image` |
| `status` | `proposed` \| `ready` \| `failed` |
| `source` | `upload` \| `ai` — same table, no parallel AI table |
| `url` | **Primary** public or storage URL used when no variant is selected |
| `alt` | Accessibility text (DB default `''`) |
| `caption` | Optional |
| `width`, `height`, `mime_type`, `bytes` | Provenance / layout / library tech line |
| `tags` | `text[]` |
| `metadata` | JSONB — see below |
| `created_by`, `created_at` | Audit |

## `metadata` JSONB (canonical keys)

| Key | Type | Purpose |
|-----|------|---------|
| `displayName` | string (≤120) | Editorial **navn** for lists/picker cards — not `alt` |
| `variants` | `Record<string, string>` | Optional derivative URLs (https only), e.g. `w640`, `og` |
| `usageHint` | enum | Optional hint: `hero` \| `thumbnail` \| `og` \| `inline` \| `banner` |
| `storageBucket`, `path`, `originalName` | … | Set on upload route for traceability |

**Indexing:** `variants` is normalized on write (`normalizeVariantsMap`); invalid keys/URLs dropped. **Max 16 variant keys.**

## RLS

`media_items_superadmin_only`: **superadmin** full access via `profiles.role`. Opening to other roles requires explicit product/security work.

## Block linkage (logical, not FK)

Blocks store UUID and/or inline URL. `resolveBlockMediaDeep` fills display URLs from IDs. **Referential integrity is application-level** — DELETE in Mediearkiv does not cascade to pages.

## AI assets

Rows with `source = 'ai'` use the **same** columns and `metadata` contract as uploads.
