# Seed App Overlay CMS pages (verbatim from hard-coded UI)

One-time seed that fills overlay pages (`app-overlay-week`, `-dashboard`, `-company-admin`, `-superadmin`, `-kitchen`, `-driver`) with the same headings/help/empty-state/CTA text that is currently hard-coded in the app. Idempotent: safe to re-run (overwrites body, no duplicates).

## Prerequisites

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` set in environment
- `SUPABASE_SERVICE_ROLE_KEY` set in environment  
  (e.g. copy from `.env.local` or export before running)

## Run

From repo root:

```bash
npx tsx scripts/seedAppOverlaysFromHardcoded.ts
```

If `tsx` is not available, install once: `npm install -D tsx`, or run via your existing TS runner. The script uses no new runtime dependencies; it only needs Node and Supabase env.

## Result

- For each overlay slug: creates or updates `content_pages` (title, slug, status draft) and `content_page_variants` (locale `nb`, environment `prod`, body = BlockList with mirrored blocks).
- Prints per overlay: created/updated page, created/updated variant, block count.
- Does not publish; overlays remain draft.

## Verification

1. Open backoffice → Content → App overlays → e.g. Week. Confirm blocks match hard-coded UI text.
2. Visit `/week` (and other app routes); overlay content should match the previous hard-coded copy.
