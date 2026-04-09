# Preview contract — Umbraco ↔ Next (two-sided)

## 1. Definition

**Preview** means rendering **non-published** or **draft** editorial state (including scheduled, in-workflow, or culture-incomplete states per Workflow rules) **as editors intend**, **without** treating that state as **public published truth**.

Preview that depends on **manual database patches** or **legacy CMS write paths** for migrated content is **INVALID**.

## 2. Preview actors

| Actor | Responsibility |
|-------|------------------|
| **Editor** | Triggers preview from **Umbraco backoffice** after authenticating to Umbraco |
| **Umbraco Cloud / CMS** | Provides **preview URL** and/or **preview API mode** per product (culture, draft, segment) |
| **Next server** | Validates preview request, fetches **preview-capable** content from Umbraco, **bypasses published output cache** |
| **Next client** | May adjust UI chrome only (banners, disable indexing) — **does not** hold secrets |

## 3. Preview trigger point (backoffice)

| Requirement | Detail |
|-------------|--------|
| **Entry** | Standard Umbraco **Preview** / “Save and preview” (exact UX per Bellissima/backoffice version) |
| **No** separate “fake preview” that reads Postgres legacy | After cutover for a type, preview must hit **Umbraco preview/Delivery preview mode** only |

## 4. Server-side preview URL / provider responsibility

| Topic | Contract |
|-------|----------|
| **URL generation** | Umbraco generates a **preview link** pointing at **Next** (public hostname or dedicated preview hostname — **infrastructure decision**) |
| **Token / signature** | If product uses **signed preview tokens** or **API-key preview**, **validation occurs server-side in Next** only |
| **Culture** | Preview must respect selected culture in backoffice; **no silent `nb` override** without signed rule (ties to B2) |
| **Draft vs published** | Server must request **draft-inclusive** Umbraco endpoints/mode — **never** the same code path as anonymous published cache |

## 5. Client-side preview mode responsibility

| Topic | Contract |
|-------|----------|
| **Detection** | Client may read **non-secret** signals (e.g. query flag, response header set by server, `draftMode` where used) |
| **UI** | Optional banner: “Preview — not published” |
| **SEO** | `noindex` for preview responses — **mandatory** at metadata layer |
| **Secrets** | **No** preview signing secret, Delivery API key, or Management credentials in client JS |

## 6. Token / signing / auth assumptions

| Mechanism | Rule |
|-----------|------|
| **Signed URL** | Signature verified in **Next Route Handler** or middleware **server-side**; short TTL; **one-time** or rotation policy per Security |
| **Cookie-based preview** | If used by platform, cookie **HttpOnly**, **Secure**, scoped; **never** duplicated in `localStorage` with secrets |
| **Member-only preview** | Out of scope for wave 1 per `47-protected-content-decision.md`; if later in scope, **separate** auth contract |

## 7. Draft / published distinction

| Channel | Cache | Truth for visitors |
|---------|-------|-------------------|
| **Published** | May use ISR / `fetch` cache / CDN per `45` | Published Delivery |
| **Preview** | **No** shared output cache with published | Draft + in-flight editorial |

## 8. No-cache rule for preview

| Layer | Rule |
|-------|------|
| **Next `fetch` cache** | **No caching** of preview fetches (or `cache: 'no-store'`) |
| **Full Route Cache / static generation** | Preview routes **dynamic** — not statically optimized as published |
| **CDN / edge** | Preview URLs **must not** be cached as **public**; use `Cache-Control: private, no-store` or equivalent |
| **Tag revalidation** | **Published** tags only — preview **must not** be invalidated by published webhook alone in a way that **serves preview body from published cache** |

## 9. Failure modes

| Failure | Expected behavior |
|---------|-------------------|
| **Invalid / expired token** | 403 or 404 — **no** fallback to published body as “best effort” |
| **Umbraco preview unavailable** | Safe error page |
| **Culture not available** | Fail closed — no wrong-language draft |

## 10. Explicit statement

**Preview is not published truth.** Search engines, public aggregators, and **anonymous users** must not receive preview content. Published channel remains the **only** SEO-indexable source for marketing pages.

## 11. Later implementation (Phase 5+) vs locked now

| Locked in Phase 4 (contract) | Implemented later |
|------------------------------|---------------------|
| Two-sided split (Umbraco generates link; Next validates + renders) | Route Handler + `draftMode` / headers wiring |
| No cache sharing with published | Concrete Next.js cache directives |
| No browser secrets | Env wiring in host |
| Preview `noindex` | Metadata in layout/page |
| **Exact** token format | Product doc + Security review on staging |

**Invalid:** Implementing preview by reusing `?preview=true` against **Postgres** `environment=preview` after Umbraco cutover for that content.

## 12. Legacy note (current repo)

`app/(public)/[slug]/page.tsx` uses `searchParams.preview === "true"` with `loadLivePageContent` (Postgres). This is **legacy**. Target preview **must** align with this contract after migration.
