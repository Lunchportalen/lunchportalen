# LIVE READY — Scope lock (bred live vs pilot)

**Dato:** 2026-03-29  
**Klassifisering:** `BROAD_LIVE_READY` | `PILOT_ONLY` | `DRY_RUN` | `STUB` | `DISABLE_FOR_LIVE` | `NEEDS_HARDENING_BEFORE_LIVE`

---

## Obligatoriske områder (minstekrav)

| Område | Klasse | Kommentar |
|--------|--------|-----------|
| **Employee week** | **BROAD_LIVE_READY** (med forbehold) | Kjerne; B1 to-spor fortsatt **NEEDS_HARDENING_BEFORE_LIVE** arkitektonisk |
| **Onboarding** | **BROAD_LIVE_READY** | Frosset i policy — **ikke** endret i live-ready doc-fase |
| **Order / window** | **BROAD_LIVE_READY** | Kjerne — **ikke** endret; API guards testet |
| **Billing** | **NEEDS_HARDENING_BEFORE_LIVE** + **PILOT_ONLY** kompleksitet | Hybrid Stripe/Tripletex — bred live krever **økonomi-QA** utover kode |
| **Company admin** | **BROAD_LIVE_READY** | Tenant-scope via `scopeOr401` mønster |
| **Kitchen** | **BROAD_LIVE_READY** | Read-only operasjon; scope guards |
| **Driver** | **BROAD_LIVE_READY** | Mobil; scope guards |
| **Superadmin** | **BROAD_LIVE_READY** + **NEEDS_HARDENING_BEFORE_LIVE** | Høy makt — begrens hvem som har rolle ved bred live |
| **Social calendar** | **BROAD_LIVE_READY** (intern) | Kalender/utkast i DB |
| **Social publish** | **DRY_RUN** / **LIMITED** | Ekstern Meta etc. uten full konfig → **ikke** lov å love «alltid publisert» |
| **SEO growth** | **LIMITED** | Review-first; ingen auto-publish til produksjons-SEO uten lagring |
| **ESG** | **BROAD_LIVE_READY** (lesing) + **LIMITED** (tolkning) | Tall fra DB/cron; tom data ≠ suksess |
| **Cron / jobs** | **BROAD_LIVE_READY** (Vercel-liste) + **INTERNAL_ONLY** (øvrige) | Se `lib/pilot/vercelScheduledCrons.ts` ≡ `vercel.json` |
| **Worker** | **STUB** (delvis) | `retry_outbox` **LIVE**; `send_email` / `ai_generate` / `experiment_run` **STUB** |
| **Admin/backoffice content publish** | **BROAD_LIVE_READY** (med rolle) | Superadmin/company flows som allerede gated |
| **Media** | **BROAD_LIVE_READY** | API + RLS-mønster; tester finnes |
| **Content tree** | **BROAD_LIVE_READY** | Move/publish med API; kompleksitet **NEEDS_HARDENING_BEFORE_LIVE** ved feil bruk — prosess |

---

## Synlige flater — hva «bred live» betyr

| Flate | For bred publikk / mange tenants |
|-------|-----------------------------------|
| Kjerne lunch + admin + kitchen + driver | **Ekte runtime** — forutsetter secrets og drift OK |
| Backoffice growth (SoMe/SEO/ESG) | **Ekte runtime** i app, men **ekstern effekt** ofte **DRY_RUN** eller **LIMITED** |
| Eksperimentelle cron-navn (`god-mode`, …) | **INTERNAL_ONLY** — ikke markedsfør som kundefunksjon |
| Worker e-post/AI | **STUB** — **DISABLE_FOR_LIVE** som forretningsavhengighet |

---

## Endringer vs pilot-scope (`docs/decision/PILOT_SCOPE_LOCK.md`)

- **Bred live** = pilot-scope **pluss** eksplisitt aksept av **flere** samtidige tenants, **høyere** forventning til drift/support, og **ingen** skjult dry-run som markedsføres som ferdig.
