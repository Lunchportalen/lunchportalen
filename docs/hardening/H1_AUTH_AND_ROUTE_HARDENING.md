# H1 — Auth og route hardening

**Dato:** 2026-03-28  
**Scope:** Sikkerhetsgrense, rolle-krav, backoffice/growth-flater — **uten** endring av order/window, onboarding, billing eller Week-forretningslogikk.

---

## 1. Middleware (`middleware.ts`)

| Funn | Status |
|------|--------|
| Sjekker **cookie** (`sb-access-token`), ikke rolle | **Uendret prinsipp** — bevisst; roller håndheves i layout/API. |
| Beskyttede prefiks inkl. `/backoffice`, `/superadmin`, `/week`, … | **Bekreftet** — uautentiserte brukere redirectes til `/login`. |

**Konklusjon:** Ingen endring i middleware i H1 (bred refaktor forbudt). Risiko **mitigeres** ved server-gates.

---

## 2. Route guards — mønster

- **`scopeOr401`** → **`requireRoleOr403`** brukes konsekvent på sensitive API-er (admin, superadmin, backoffice).  
- **Backoffice layout** (`app/(backoffice)/backoffice/layout.tsx`): kun **superadmin** — forsvar i dybden sammen med API.

---

## 3. Lukket i H1 (konkret)

| Element | Tiltak |
|---------|--------|
| **`POST /api/something`** | Tidligere **uten** autentisering (demo/contract-smoke). **H1:** Krever **superadmin-session** eller gyldig **CRON_SECRET** (`Authorization: Bearer` / `x-cron-secret`) når `CRON_SECRET` er satt; ellers superadmin etter `scopeOr401`. **Fail-closed** for anonyme kall. |

---

## 4. Delvis / fortsatt åpent

| Område | Merknad |
|--------|---------|
| **~560+ route handlers** | Full manuell audit er **ikke** gjennomført i H1; anbefalt stikkprøve før pilot (`admin`, `superadmin`, `backoffice`, `cron`). |
| **`strict: false`** | Ikke endret — teknisk gjeld (H0). |
| **Employee Week / order API** | **Ikke** endret per H1-regel. |

---

## 5. Backoffice Social / SEO / ESG

- Eksisterende ruter bruker **superadmin** + `scopeOr401` der implementert (f.eks. `backoffice/esg/*`, `seo-intelligence`, social posts API).  
- **Ingen** nye ruter i H1.

---

## 6. Pilot-sjekkliste (utdrag)

- [ ] Verifiser at interne demo-ruter (`/api/something`) **ikke** er i bruk fra produkt-frontend; evt. kall kun med superadmin eller cron-secret.  
- [ ] Stikkprøve: `POST`/`PATCH` på tilfeldige `admin`/`superadmin`-ruter uten cookie → **401/403**.  
- [ ] Bekreft at **backoffice** ikke er tilgjengelig for `company_admin` (layout + API).

---

## 7. Referanser

- `app/api/something/route.ts` — oppdatert i H1  
- `lib/http/cronAuth.ts` — `requireCronAuth`  
- `lib/http/routeGuard.ts` — `scopeOr401`, `requireRoleOr403`
