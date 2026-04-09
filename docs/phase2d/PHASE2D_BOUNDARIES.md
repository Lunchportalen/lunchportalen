# Phase 2D — Boundaries (hva 2D ikke skal røre)

**Dato:** 2026-03-28  
**Formål:** Kartlegge sensitive filer/områder og **låse** planleggingsfasen mot feil grep.

---

## 1. Eksplisitt utenfor scope (alle 2D-faser inntil vedtak)

| Område | Filer / mønster | Grunn |
|--------|-----------------|-------|
| Auth & sesjon | `middleware.ts`, `app/api/auth/post-login/route.ts`, `lib/auth/getAuthContext.ts` | E5 / RC |
| Onboarding-motor | `app/api/onboarding/**` | Frosset flyt |
| Employee Week | `app/(app)/week/**`, `lib/week/**` (operativ sannhet) | S1 / produkt |
| Order / window | `app/api/order/**` | Kjerne |
| Billing-motor | `lib/billing/**`, faktura-cron | C3 |
| Supabase schema / RLS | `supabase/migrations/*` — **kun** etter egen DB-change-set | Risiko |
| Vercel / deploy | `vercel.json`, env | N14 |

---

## 2. Høy sensitivitet — leses ved implementering, ikke «forbedres» utenom mål

| Kategori | Eksempler |
|----------|-----------|
| Publisert innhold | `app/api/backoffice/content/**`, public page routes |
| Social DB | `social_posts`, ordre-kobling `social_post_id` |
| ESG RPC | `esg_build_daily`, snapshots |
| Cron | `app/api/cron/**` — alltid `CRON_SECRET` |
| AI routes | `app/api/ai/**`, `app/api/backoffice/ai/**` |
| Growth | `lib/growth/**`, `lib/social/**` publish-sti |

---

## 3. 2D-områder og påvirkning

| 2D-del | Typisk berøring | Indirekte risiko for kjerne |
|--------|-----------------|----------------------------|
| Social Calendar | `app/(backoffice)/**`, `app/api/social/**` | Lav hvis kun UI + read; **medium** ved publish |
| SEO / CMS | content workspace, SEO scripts | **Medium** for public SEO ved feil meta |
| ESG | superadmin/admin ESG, cron | **Lav** for lesing; **medium** hvis feil claims i CMS |
| AI consolidation | mange komponenter | **Medium** — regresjon i editor |

---

## 4. Public site

- Endringer som påvirker HTML for `/` og landingsider krever **build:enterprise** + SEO-skript grønne.
- Ingen skjult redirect eller A/B på checkout uten egen sikkerhetsreview.

---

## 5. Komponentrot

- **`src/components`** og **`components`** — følg eksisterende importstier (`@/components`); ikke introduser `v2`-mapper.

---

## 6. Grense mot 2C control towers

- Superadmin/kitchen/driver towers **endres ikke** for å «tette» growth — growth løftes inn i **CMS** og eksisterende superadmin-lenker der det trengs.
