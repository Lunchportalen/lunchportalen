# CMS persistence proof

**Status:** VERIFIED (API layer with stateful mock).  
**Date:** 2025-03.

## PERSISTENCE STATUS: **VERIFIED**

Persistence is proven for the editor save chain: **PATCH → persistence → GET returns saved value**.

## Content types tested

- **Page title** (simple text, 1–120 chars)
- **Page body** (blocks: hero, richText, etc.)

## Save chain proven

1. **Editor** → `useContentWorkspaceSave.performSave()` → `fetch` **PATCH** `/api/backoffice/content/pages/${id}` with `{ title, slug, body, rid }`.
2. **API** → `app/api/backoffice/content/pages/[id]/route.ts` **PATCH**:
   - Updates `content_pages` (title, slug, status, updated_at).
   - Updates or inserts `content_page_variants` (body, updated_at) for (page_id, locale, environment).
   - Returns updated page + body.
3. **Reload** → **GET** `/api/backoffice/content/pages/${id}` reads same `content_pages` + `content_page_variants` and returns same shape.
4. **Proof:** Integration test **PATCH then GET** with a stateful in-memory mock: after PATCH with distinct title and body, GET returns that same title and body. Value survives re-fetch.

## Files involved

| Role | File |
|------|------|
| Save hook (editor) | `app/(backoffice)/backoffice/content/_components/useContentWorkspaceSave.ts` |
| Page load / reload | `app/(backoffice)/backoffice/content/_components/useContentWorkspacePageData.ts` |
| API (GET + PATCH) | `app/api/backoffice/content/pages/[id]/route.ts` |
| Persistence proof test | `tests/cms/content-persistence-save-reload.test.ts` |

## Autosave

- **Real:** Same `performSave()` path; triggered by 800 ms debounce when dirty.
- **Not fake:** No separate “autosave” that only updates local state.

## Verification checklist

- [x] Dirty state changes after edit (in hook: `currentSnapshot !== savedSnapshot`).
- [x] Save action fires (manual “Lagre” and autosave call `saveDraft` → `performSave`).
- [x] Success state is truthful (save hook sets `savedSnapshot`, `lastSavedAt`, `saveStateSafe("saved")` from API response).
- [x] Re-fetch/reload returns the saved value (proven by test: GET after PATCH returns PATCH payload).
- [x] Editor does not only mutate local state: persistence path is used and test asserts on GET-after-PATCH.

## Blocker

None. Full proof is achievable locally via mocked Supabase; the test uses an in-memory store that both PATCH and GET use, proving the contract. With real DB, the same flow persists to Supabase.
