# Phase 2D — Beslutningslogg

**Dato:** 2026-03-28  
**Fase:** 2D0 (plan) + **2D1** (Social Calendar) + **2D2** (SEO / CMS Growth MVP) + **2D3** (ESG runtime MVP).

---

## D1 — Source of truth

| Domene | Source of truth | Merknad |
|--------|-----------------|--------|
| **Social calendar / innlegg** | Postgres-tabellen **`social_posts`** + `GET/POST /api/social/posts*`, `posts/save`, **`PATCH /api/social/posts/[id]`**, **`POST /api/social/posts/publish`**, `POST /api/social/ai/generate` | Status, `scheduled_at`, innhold JSON — **ikke** en parallell tabell. **Canonical CMS-IA:** `/backoffice/social`. |
| **SEO / CMS growth** | **`content_page_variants.body`** (`meta.seo` + blokker) + **`/backoffice/seo-growth`** (2D2) + content workspace | AI gir **forslag** — lagret sannhet = eksplisitt **lagring** (`PATCH`) og deretter eksisterende publish/workflow. |
| **ESG-data** | **`esg_monthly_snapshots`**, **`esg_yearly_snapshots`** fylt av **`esg_build_daily`** (og relaterte cron) | UI og eksport skal **vise** eller **avvise** — ikke oppfinne tall. |

---

## D2 — Deler som kan bygges trygt først

1. **Lesende** SoMe-kalender i CMS (henter eksisterende poster).
2. **Lesende** ESG-oppsummeringer der API allerede finnes (admin/superadmin).
3. SEO-forslag som krever **eksplisitt** brukerhandling før persist.
4. Konsoliderings-**navigasjon** i CMS (lenker til eksisterende paneler) uten ny motor.

---

## D3 — Deler som må vente

| Del | Årsak |
|-----|--------|
| **Automatisk ekstern publisering** i stor skala | Mangler full integrasjons- og audit-pakke; `publish` er policy-låst i executor. |
| **Ny orkestrator for AI** | Må unngås — bruk `growthEngine` + eksisterende ruter. |
| **ESG på forsiden som live KPI** | Krever cache/performance og juridisk avklaring. |
| **Ny faktura-/ordre-sannhet** | Utenfor growth-scope (C3). |

---

## D4 — Eksterne avhengigheter

| Finnes (i kode / mønster) | Mangler / ufullstendig |
|---------------------------|-------------------------|
| `CRON_SECRET` for cron-ruter | Produksjons-**rotasjon** og monitoring (drift) |
| Meta/IG/FB-moduler under `lib/social/*` | **Full** credential-lifecycle og review av `auto-post` |
| TikTok | **Stub** — ikke produksjon |
| Stripe/SaaS (annen del av app) | **Ikke** 2D-avhengighet for ESG/SoMe/SEO |
| LinkedIn (referanser) | Verifiser OAuth/post per miljø |

---

## D5 — AI-flater: behold, samle, eller fase ut (strategi)

| Flate | Anbefaling |
|-------|------------|
| `lib/ai/growthEngine.ts` | **Behold** som read-only orkestrator. |
| `POST /api/ai/growth/seo|ads|funnel` | **Behold** — samkjør inngang fra én CMS «Growth»-seksjon senere. |
| `seo-intelligence` route | **Behold** — superadmin/backoffice guard. |
| Content workspace SEO-faner / `EditorGrowthAiPanel` | **Behold** — primær brukerflate; reduser duplikat-knapper senere. |
| `/superadmin/growth/social` (SocialEngineClient) | **Behold** som **operativ/avansert** flate; **samle** brukeropplevelse ved å speile status inn i CMS (read/sync), ikke erstatte DB. |
| Eksperimentelle / overlappende små paneler | **Fase ut av primær sti** (skjul bak lenke til `/backoffice/experiments`) når konsolidering kjøres — **ikke** slett kode i 2D0. |

---

## D6 — Rekkefølge (se `PHASE2D_IMPLEMENTATION_SEQUENCE.md`)

**Målrekkefølge:** Social Calendar → SEO/CMS Growth → ESG — med begrunnelse i sekvensdokumentet.

---

## D7 — Kanoniske prinsipper (gjentakelse)

- **CMS/backoffice** er hovedenhet (`PHASE2D_BOUNDARIES.md`).
- **Review-first** for alt som når publikum eller eksterne kanaler.
- **Ingen parallelle systemer** (ingen `v2`-filer, ingen ny SEO-motor utenfor CMS-mønsteret).

---

## Phase 2D1 — Social Calendar runtime MVP (2026-03-28)

| ID | Beslutning |
|----|------------|
| **D8** | **Source of truth uendret:** `social_posts` + API-ene over; **canonical CMS-IA:** `/backoffice/social`. |
| **D9** | **Sporet beholdt:** `GET/POST` posts + save; **superadmin motor** `/superadmin/growth/social` **ikke** deprecate — samme DB. |
| **D10** | **Kanaler:** Ekte ekstern publisering = **ikke** levert (FB stub `dry_run`; LI/IG = `CHANNEL_NOT_ENABLED`). Ingen falsk «published». |
| **D11** | **AI:** `POST /api/social/ai/generate` + `saveUnifiedSocialPost` — **ingen** ny orchestrator. |
| **D12** | **Aktive handlinger:** liste, rediger, statusflyt, planlegg tid, forsøk publish med tydelig avslag. |
| **D13** | **Utsatt:** bred autopublish, flere kanaler, audit av utsendelser — krever integrasjon + secrets. |
| **D14** | **`published` i DB** settes ikke av PATCH; kun publish-route når integrasjon returnerer faktisk post (stub gjør ikke dette i dag). |

---

## Phase 2D2 — SEO / CMS Growth runtime MVP (2026-03-28)

| ID | Beslutning |
|----|------------|
| **D15** | **SEO source of truth:** `content_page_variants.body.meta` (Page AI Contract) + `content_pages` for tittel/slug/status; offentlig metadata via `buildCmsPageMetadata`. |
| **D16** | **Canonical SEO surface:** `/backoffice/seo-growth` — samler sidevalg, analyse (`seo-intelligence`), redigering og lagring via eksisterende `PATCH` med `x-lp-cms-client: content-workspace`. |
| **D17** | **Beholdt:** `ContentSeoPanel`, properties rail, `POST /api/backoffice/ai/seo-intelligence`, `computeSeoIntelligence`; **ikke** ny parallell growth-SEO-app. |
| **D18** | **AI:** `seo-intelligence` brukt i 2D2; `POST /api/ai/growth/seo` forblir separat endepunkt uten ny UI i 2D2 (unngå duplikat). |
| **D19** | **Datakilder:** kun DB (`blocks`, `meta`, page title); ingen eksterne SEO-API-er aktivert her. |
| **D20** | **Aktive handlinger:** søk/liste sider, analyse, manuelt redigerte felt, lagre variant-body (meta.seo + valgfritt seoRecommendations). |
| **D21** | **Utsatt:** auto-publisering, eksterne GSC/Ahrefs, endring av sitemap-generator — krever egen leveranse. |
| **D22** | **Publisering:** fortsatt via innholdsredigerer / workflow — ikke fra SEO-flaten alene. |

---

## Phase 2D3 — ESG runtime MVP (2026-03-28)

| ID | Beslutning |
|----|------------|
| **D23** | **ESG source of truth uendret:** `esg_monthly_snapshots` / `esg_yearly_snapshots` for KPI-tabeller; `esg_monthly` for firmaliste/rullering. |
| **D24** | **Canonical CMS ESG surface:** `/backoffice/esg` — leser `GET /api/backoffice/esg/summary` og `GET /api/backoffice/esg/latest-monthly` (superadmin). |
| **D25** | **Beholdt:** `/api/admin/esg/summary`, `/api/superadmin/esg/summary`, cron/RPC, superadmin PDF/eksport — **samme** snapshot-spørring sentralisert i `fetchCompanyEsgSnapshotSummary`. |
| **D26** | **Deprecate:** ingenting fjernet — superadmin ESG-sider forblir operative. |
| **D27** | **Runtime vs plan:** Snapshot- og rollup-API-er er **ekte runtime**; bredere automatisering av rapporter (e-post, schedulerte utsendelser) er **utsatt**. |
| **D28** | **Datakilder:** kun Supabase-tabeller som over — ingen eksterne ESG-API-er i 2D3. |
| **D29** | **Aktive handlinger:** lesing, firmavalgoversikt, narrativ visning, lenke til superadmin. **Ingen** skrivinger fra CMS. |
| **D30** | **Tillit:** metode forklares i UI (kilde/estimat/mangler data); tom liste ≠ positivt klima-resultat. |
| **D31** | **Før bredere ESG-rapportering:** stabil cron, definisjonsdokument for stabilitet/svinn, eventuelt cache for offentlig copy — egen leveranse. |
