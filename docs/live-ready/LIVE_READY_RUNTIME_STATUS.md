# LIVE READY — Runtime status (feature / surface)

**Dato:** 2026-03-29  
**Runtime status:** `LIVE` | `LIMITED` | `DRY_RUN` | `STUB` | `INTERNAL_ONLY` | `DISABLE_FOR_LIVE`

| Feature / surface | Runtime status | Source of truth | Live state | Kommentar |
|-------------------|------------------|-----------------|------------|-----------|
| Employee `/week` | **LIVE** | `lib/week/*`, ordre API, DB | Prod-kjerne | E2E QA anbefalt før bred live |
| Onboarding | **LIVE** | `app/(auth)/onboarding`, API | Prod | Frosset flyt |
| Order / window | **LIVE** | `app/api/order/*`, `orders/*` | Prod | Guards + tester |
| Billing / Stripe webhook | **LIMITED** | Stripe + DB | Prod | Hybrid — økonomi må verifiseres |
| Company admin | **LIVE** | `profiles.company_id` scope | Prod | |
| Kitchen | **LIVE** | Kitchen API + scope | Prod | Read-only policy |
| Driver | **LIVE** | Driver API + scope | Prod | |
| Superadmin system | **LIVE** | Superadmin API | Prod | Begrens antall brukere |
| Social calendar (DB) | **LIVE** | `social_posts` | Prod | |
| Social ekstern publish | **DRY_RUN** | Meta executor / stub | Avhenger av nøkler | API returnerer `PUBLISH_DRY_RUN` mulig |
| SEO growth UI | **LIMITED** | CMS variant + lagring | Prod UI | Review-first; ikke auto live site uten publish |
| ESG visning | **LIVE** (lesing) | Snapshots i DB | Prod | Tom data håndteres i copy |
| ESG narrativ / estimater | **LIMITED** | `buildEsgNarrativeYear` etc. | Prod | Merket som estimater i UI |
| Cron (Vercel 9 paths) | **LIVE** | `vercel.json` | Scheduled | |
| Øvrige cron paths | **INTERNAL_ONLY** | `app/api/cron/*` | Manuell/legacy | Krever secret |
| Worker `retry_outbox` | **LIVE** | Redis + HTTP | Prod hvis kjører | |
| Worker `send_email` etc. | **STUB** | N/A | **DISABLE_FOR_LIVE** som avhengighet | Ikke bruk som SLA |
| CMS content publish | **LIVE** | `app/api/backoffice/content/*` | Prod | Superadmin/rolle |
| Media library | **LIVE** | Backoffice media API | Prod | |
| Content tree | **LIVE** | Tree API | Prod | |
| Dev test order status | **DISABLE_FOR_LIVE** | — | 404 i Vercel prod | H2 |

---

**Sprik docs vs kode:** Hvis en doc sier «full SoMe», **vinner kode**: publish-rute kan returnere dry-run — **LIVE_READY_GROWTH_POSTURE.md**.
