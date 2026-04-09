# E0 — Enterprise-ready baseline delta

**Dato:** 2026-03-29  
**Referanse-baseline:** `REPO_DEEP_DIVE_REPORT.md` (historikk), `docs/hardening/RESOLVED_BASELINE_ITEMS.md`, `docs/hardening/DELTA_AUDIT_FROM_BASELINE.md`, `docs/live-ready/LIVE_READY_BASELINE_DELTA.md`.

---

## 1. Baseline-problemer som faktisk er lukket (kode + dokumentert drift)

| Tema | Status |
|------|--------|
| Fredag ukesynlighet (15:00) | Lukket i `lib/week/availability.ts` (jf. resolved baseline) |
| Enterprise release-gate | `npm run build:enterprise` obligatorisk |
| Dev order-mutasjon i Vercel prod | `POST /api/dev/test-order-status` → 404 i prod (H2) |
| Outbox SLI vs `cron_runs` | Tekst/kilde justert (H2) |
| Employee `next` allowlist | `allowNextForRole` (`lib/auth/role.ts`) |

---

## 2. Baseline-risikoer som fortsatt gjelder

Se `docs/hardening/OPEN_PLATFORM_RISKS.md` — **A1–A3, B1, C1–C2, D1–D4, E1–E2, F1–F2, G**.

Kort: middleware uten rolle, stor API-flate, `strict: false`, to spor «uke», billing-hybrid, growth-forventninger, **worker-stubs**, cron-drift, **ingen dokumentert mål-lasttest**.

---

## 3. Nye risikoer (fasearbeid / 2D)

Flere backoffice-flater (social, SEO, ESG), trippel ESG-overflate, komponent-alias — jf. `OPEN_PLATFORM_RISKS` G og audit-notater.

---

## 4. Hva som er ekte runtime (i dag)

- Kjerne: ordre, ukevisning, kjøkken (read-only sannhet), driver, company admin (scope), superadmin (med rolle), cron-endepunkter på Vercel-liste med `requireCronAuth` der dokumentert.
- CMS: lagring, tre, media, publish-flyt med API-guards (stikkprøver + tester).
- Worker: **`retry_outbox`** kaller faktisk `/api/cron/outbox` når origin+secret finnes.

---

## 5. Hva som fortsatt er pilot-only, dry-run eller stub

| Område | Klasse | Kilde |
|--------|--------|-------|
| `send_email`, `ai_generate`, `experiment_run` i worker | **STUB** | `workers/worker.ts` (`*_stub` logging) |
| Ekstern social publish | **DRY_RUN** / kanal avhengig | API/UI; `docs/live-ready/LIVE_READY_GROWTH_POSTURE.md` |
| SEO growth | **Review-first** — ikke «auto-live» uten lagring | Produkt/design |
| Skala mot enterprise-målark | **Ikke bevist** | `OPEN_PLATFORM_RISKS` F1 |

**Konklusjon:** Repo kan ikke hevdes som **ubetinget enterprise-live-ready** uten å late som over — se `UNCONDITIONAL_ENTERPRISE_LIVE_DECISION.md`.
