# Public site (Umbraco) vs app (Next.js)

**Single architectural truth in this repo:**

| Område | Eier | Typisk hosting (fra repo) |
|--------|------|---------------------------|
| Public marketing HTML, undersider, redaksjonelt innhold | **Umbraco (CMS)** | Azure Web App `lunchportalen-umbraco` (`.github/workflows/main_lunchportalen-umbraco.yml`) |
| Operativ app (innlogging, uke, ordrer, roller, API, cron) | **Next.js** | Vercel (`vercel.json` crons, `VERCEL_*` runtime) |

Next.js is **not** documented or configured as a parallel, production-grade “primary public marketing renderer” alongside Umbraco-hosted HTML. Delivery API reads in Next exist to support development and shared content mapping; browser-facing public pages in production are intended to be **full HTML from Umbraco** when `UMBRACO_PUBLIC_SITE_URL` points at the live public origin.

## 1. Delegation: marketing traffic → Umbraco public origin

When **`UMBRACO_PUBLIC_SITE_URL`** is set (scheme + host, no trailing slash; e.g. `https://www.lunchportalen.no`):

- Middleware issues **307** redirects on **GET/HEAD** for known marketing pathnames (same coverage as `marketing-registry.json` + `/faq`, `/registrering`, plus `LP_MARKETING_UMBRACO_EXTRA_SLUG`).
- **Loop guard:** if the redirect target host equals the request host, no redirect (avoids misconfiguration loops).

Typical split: Next on `app.lunchportalen.no` (Vercel), public site on `www.lunchportalen.no` (Azure/Umbraco).

When **`UMBRACO_PUBLIC_SITE_URL` is unset** (e.g. local dev without a separate public host), `app/(public)/` may still render using Umbraco **Delivery API** data inside Next. That path is a **development convenience**, not an alternate production model documented as equal to Umbraco-hosted public HTML.

## 2. `/umbraco` (Umbraco backoffice)

- **Ikke** Next `/backoffice` (redaksjonelt shell i appen).
- `next.config.ts` **rewrites** `/umbraco` og `/umbraco/*` til origin fra `UMBRACO_CMS_ORIGIN` eller, hvis den mangler, origin av `UMBRACO_DELIVERY_BASE_URL`.
- **Middleware** kjører ikke Supabase session refresh for `/umbraco` (unngår blanding med Umbraco-cookies og app-auth).
- Mangler begge URL-ene → ingen rewrite → `/umbraco` treffer ofte **404** fra Next.

## 3. Hva som må løses utenfor repoet

- **DNS:** Hvilken host som svarer for apex / `www` vs `app` avgjør om trafikk treffer Vercel eller Azure først. Repoet beskriver ikke DNS-poster.
- **Vercel:** Prosjektdomener og env (`UMBRACO_*`, `UMBRACO_PUBLIC_SITE_URL`) må samsvare med at public HTML leses fra Umbraco der det er forutsatt.
- **Azure:** Custom domain og TLS for Umbraco-appen må peke riktig der public skal leses direkte fra Umbraco.

## 4. App-ruter (Next eier, uendret prinsipp)

Eksempler: `/login`, `/week`, `/orders`, `/admin`, `/superadmin`, `/kitchen`, `/driver`, `/api/*` — beskyttet/konfigurert som før i `middleware.ts` og App Router.
