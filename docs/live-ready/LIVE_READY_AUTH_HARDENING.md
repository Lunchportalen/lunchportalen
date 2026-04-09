# LIVE READY — Auth & route hardening (arbeidsstrøm 1)

**Dato:** 2026-03-29  
**Metode:** Stikkprøve + eksisterende tester — **ikke** full enumerering av alle ruter.

## Mønster (kilde: kode)

- **`scopeOr401`** → **`requireRoleOr403`** / **`requireCompanyScopeOr403`** på beskyttede API-er.
- **Middleware** (`middleware.ts`): cookie for beskyttede **sider** — **ikke** rolle; API må enforce (`OPEN_PLATFORM_RISKS` A1).

## Stikkprøve — allerede gated (ingen endring i denne fasen)

| Område | Eksempel | Observasjon |
|--------|----------|---------------|
| Social | `POST /api/social/posts/publish`, `POST /api/social/posts/save` | `scopeOr401` + `superadmin` |
| ESG backoffice | `GET /api/backoffice/esg/summary` | `superadmin` (kontrakt i tester) |
| ESG admin | `GET /api/admin/esg/summary` | `company_admin` + company scope |
| Dev order | `POST /api/dev/test-order-status` | **404** i Vercel prod (H2) |

## Hull lukket i denne leveransen

- **Ingen** nye rute-endringer utover tidligere H2 (dev prod-block). Social **UI** presiserer dry-run (se `LIVE_READY_CHANGED_FILES.md`).

## Åpent (bred live)

- Full revisjon av alle **POST/PATCH/DELETE** under `app/api` — **krever eget arbeid** eller automatisk audit-script — **ikke** gjort her.
