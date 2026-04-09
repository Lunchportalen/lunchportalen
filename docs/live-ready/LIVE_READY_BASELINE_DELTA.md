# LIVE READY — Baseline delta (deep-dive → nå)

**Dato:** 2026-03-29  
**Before snapshot:** `REPO_DEEP_DIVE_REPORT.md` / tidligere baseline — **historikk**, ikke automatisk nåstatus.  
**After / sannhet:** Kode + `docs/hardening/**`, `docs/audit/**`, `docs/decision/**`, fase 2a–2d dokumenter.

---

## 1. Baseline-problemer som faktisk er løst (kode som kilde)

| Tema | Før (baseline) | Nå |
|------|----------------|-----|
| Fredag ukesynlighet 14:00 vs 15:00 | Motstrid | **`lib/week/availability.ts`**: fredag **15:00** (`isAfterFriday1500`); alias 14:00 deprecert — jf. `RESOLVED_BASELINE_ITEMS.md` |
| Employee `next` for bred liste | `/orders`, `/min-side` nevnt | **`allowNextForRole`** ( `lib/auth/role.ts` ): employee → kun `nextPath.startsWith("/week")` |
| Enterprise release-gate | Delvis | **`npm run build:enterprise`**: plattform-guards, SEO-skript, audit — **obligatorisk** i pipeline |
| Dev order-mutasjon i prod | Åpent hull | **H2:** `POST /api/dev/test-order-status` → **404** når `VERCEL_ENV=production` |
| Outbox SLI-tekst vs `cron_runs` | Misvisende | **H2:** `lib/observability/sli.ts` oppdatert — outbox persisterer ved suksess/feil når DB OK |

---

## 2. Baseline-risikoer som fortsatt gjelder

| ID / tema | Kilde | Status |
|-----------|-------|--------|
| A1 Middleware uten rolle | `OPEN_PLATFORM_RISKS`, `middleware.ts` | **STILL OPEN** |
| A2 Stor API-flate | `FULL_REPO_AUDIT_V2` | **STILL OPEN** |
| A3 `strict: false` | `tsconfig.json` | **STILL OPEN** |
| B1 To spor uke (Sanity weekPlan vs meny) | `DELTA_AUDIT`, `OPEN_PLATFORM_RISKS` B1 | **STILL OPEN** |
| C1–C2 Billing hybrid / cron-faktura | `OPEN_PLATFORM_RISKS` C | **STILL OPEN** |
| E1 Worker stubs | `workers/worker.ts` | **STILL OPEN** |
| F1 Ingen dokumentert lasttest | `OPEN_PLATFORM_RISKS` F | **STILL OPEN** |
| D1–D4 Growth flater | `OPEN_PLATFORM_RISKS` D | Delvis mitigert med **UI-ærlighet** + API fail-closed; **forventningsstyring** fortsatt kritisk |

---

## 3. Nye risikoer introdusert gjennom fasearbeid (2D / CMS)

- Flere **backoffice**-ruter og klientflater (social, SEO, ESG) → større **overflate** for rolle/tenant-review (`OPEN_PLATFORM_RISKS` G / D4).
- **Trippel ESG API** (admin/backoffice/superadmin) — vedlikehold og forvirring (`GO_LIVE_RISK_REGISTER_V2` R7).
- **Komponent-alias** (`src/components` før `components`) — skyggelegging (`FULL_REPO_AUDIT_V2`).

---

## 4. Hva som er feature-complete (produktmessig)

- **Kjerneflyt** lunch: ordre, uke, kjøkken, driver, company admin, superadmin system — **implementert** med omfattende tester (Vitest).
- **CMS** innhold, tre, media, preview/publish — **implementert**; kompleksitet høy.
- **Growth-flater** (social/SEO/ESG) — **implementert som runtime** i app; deler er **LIMITED/DRY_RUN** mot ekstern verden.

---

## 5. Hva som fortsatt bare er pilot-ready (vs bred live)

| Område | Vurdering |
|--------|-----------|
| **Pilot** (G0) | **GO WITH CONDITIONS** med eksplisitt scope — se `docs/decision/GO_NO_GO_PILOT_DECISION.md` |
| **Bred live** | Krever **strengere** forventningsstyring, flere manuelle signoffs, ev. kapasitetsantakelser — **ikke** automatisk lik pilot |
| **Worker** | Stub-jobs **ikke** bred-live-kritiske |
| **Social ekstern publish** | **DRY_RUN** / kanal deaktivert uten nøkler |
| **Skala** | Ingen bevist «bred» last |

**Konklusjon i dette dokumentet:** Repo er **sterkt på CI og kjernekode**, men **bred live** krever egen **GO WITH CONDITIONS** (se `BROAD_LIVE_GO_DECISION.md`) — ikke «automatisk grønt».
