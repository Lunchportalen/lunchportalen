# Umbraco-nivå CMS — Trafikklys-matrix

**Dato:** 2026-03-29

| Kategori | Status | Evidence | Why | Required action |
|----------|--------|----------|-----|-----------------|
| **CMS as main base** | **YELLOW** | CP1: `CmsRuntimeStatusStrip`, `control/page.tsx`, `controlPlaneRuntimeStatusData.ts` | Sterk innholdsbase + ærlig modulstatus; operativ kjerne egen | Fortsett IA; worker-stubs |
| **Company/customer/agreement connectivity** | **YELLOW** | Supabase truth; `getSuperadminCompaniesContent` | Ikke én CMS-tenant-tree | Read-only aggregater; ingen shadow DB |
| **Week/menu publishing from CMS** | **YELLOW** | `GET /api/week`, Sanity `menu`, `weekplan/publish` | To spor (weekPlan vs meny) dokumentert | UI/tekst skille; produktvalg for B1 |
| **Employee Week safety** | **GREEN** | `app/api/week/route.ts`, `lib/week/**` | Server-styrt, avtale + meny | Pilot-QA tidsvinduer |
| **Content/publish safety** | **GREEN** | `app/api/backoffice/content/**`, tests | Gates + enterprise build | Vedlikehold ved nye ruter |
| **Media and design scopes** | **GREEN** | `app/api/backoffice/media/**`, phase2a docs | Kanonisk | — |
| **Company admin runtime** | **GREEN** | `app/admin/**`, scope patterns | Isolert scope | Lenker til CMS der relevant |
| **Kitchen runtime** | **GREEN** | `app/kitchen/**` | Read-only sannhet | Menykjede konsistent |
| **Driver runtime** | **GREEN** | `app/driver/**` | Mobil-first | — |
| **Superadmin runtime** | **YELLOW** | Stor flate, growth | A2 risiko | Gate-review |
| **Social module** | **YELLOW** | `lib/social/**`, `OPEN_PLATFORM_RISKS` D1 | DRY_RUN/stub | Merk UI; policy |
| **SEO module** | **YELLOW** | Scripts + editor | Transitional | Én publish-fortelling |
| **ESG module** | **YELLOW** | `docs/phase2d/**`, multiple surfaces | Duplicate-yte | Konsolider narrativ |
| **Access/security** | **YELLOW** | `middleware.ts`, `OPEN_PLATFORM_RISKS` A1 | Cookie-only middleware | Layout/API truth; ev. audit |
| **Cron/worker/job safety** | **RED** | `workers/worker.ts` stubs, E0 doc | **STUB** jobber | Implementer eller disable |
| **Support/ops** | **YELLOW** | `H2_RUNBOOK`, `LIVE_READY_RUNBOOK` | Organisatorisk | Paging, on-call — utenfor ren CMS |
| **Scale confidence** | **YELLOW** | Ingen dokumentert mål-lasttest | F1 | Definer eller test |
| **Overall enterprise coherence** | **YELLOW** | Denne kartleggingen | CMS-led men fragmentert narrativ | Følg `CMS_CONTROL_PLANE_BUILD_SEQUENCE.md` |

**Legende:** GREEN = akseptabelt for RC med kjente rammer; YELLOW = gap/risiko; RED = blokkerende for ubetinget enterprise (matcher enterprise E0 på worker).
