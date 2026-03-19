# E2E — Playwright

Browser E2E and visual regression. Phase 1 foundation.

## Folder structure

- `e2e/*.e2e.ts` — spec files
- `e2e/ai-cms.e2e.ts` — CMS AI flows (apply→save→persist, metrics, failure fallback); requires superadmin creds
- `e2e/helpers/` — shared helpers (auth, ready)
- Snapshots live next to specs (e.g. `e2e/visual.e2e.ts-snapshots/`)

## Output paths (stable)

- **Test artifacts**: `test-results/` (screenshots, traces, videos on failure)
- **HTML report**: `playwright-report/`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run e2e` | Run all E2E tests |
| `npm run e2e:ui` | Playwright UI mode |
| `npm run e2e:headed` | Run in headed browser |
| `npm run e2e:update-snapshots` | Update visual snapshots |
| `npm run e2e:install` | Install browser binaries |
| `npm run e2e:debug` | Debug mode |

## baseURL

- **Local**: `http://localhost:3000` (or set `PLAYWRIGHT_BASE_URL`)
- **CI**: Set `PLAYWRIGHT_BASE_URL` in the workflow; config does not start webServer when `CI` is set.

## AI CMS E2E (ai-cms.e2e.ts)

Proof that critical AI paths work in the editor:

- **Apply → save → reload → persisted**: SEO suggestion applied, save, reload; assert `body.meta.seo.title` persisted via GET.
- **Page builder append**: Structured intent (e.g. Sidetype “Kontakt”) → Generer side → Legg til under → Lagre; GET same API as editor → assert 3 blocks (hero, richText, cta); reload editor → GET again → assert same structure (proves durable through normal save chain).
- **Page builder replace**: Structured intent (e.g. Sidetype “Priser”) → Generer side → Erstatt innhold (dialog accepted) → Lagre; GET → assert 3 blocks and types hero/richText/cta (replace path persisted through normal save).
- **Metrics**: Running analysis triggers `POST /api/editor-ai/metrics` with expected event type/feature.
- **Failure fallback**: When SEO API returns 500, editor remains usable (main + AI section visible).
- **Unsafe output (script tag)**: Intercept page-builder with `<script>window.__E2E_UNSAFE_MARKER=true</script>` in block body → Generer side → Legg til under; assert (1) script does not execute and no script tag in DOM contains marker, (2) editor remains usable (main, AI section, Lagre), (3) after save, GET page and assert no block body contains `<script` or marker (unsafe not persisted; client sanitizes on apply).
- **Unsafe output (safe-fail)**: Intercept page-builder to return 400 AI_SAFETY_REJECTED → Generer side; assert apply buttons not shown and editor stays usable.
- **Unsafe output (event handler / javascript: URL)**: Intercept with `onerror=` and `javascript:` URL in block body → apply; assert marker never executes and editor usable.

Requires superadmin credentials: `E2E_SUPERADMIN_EMAIL` / `E2E_SUPERADMIN_PASSWORD` or `E2E_TEST_USER_EMAIL` / `E2E_TEST_USER_PASSWORD`. Tests create pages via API and use the same session; no DB seeding beyond that. Page builder tests use the real deterministic API (structured intent); no mocking.

**Persisted logging (server → DB):** The full chain “AI action → request → server → DB write” is proven by the Vitest integration test `tests/api/editorAiMetricsPersistence.test.ts`: it sends a real POST to the editor-ai metrics route (with mocked auth) and then queries `ai_activity_log` for the new row. Run with Supabase env set; skipped when DB is unavailable. E2E in this folder proves the **client** sends the request (metrics interception); the persistence test proves the **server** writes to the DB.
