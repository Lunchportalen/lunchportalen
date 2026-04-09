# Umbraco-nivå CMS — Endelig beslutning (CMS Control Plane)

**Dato:** 2026-03-29  
**Scope:** Kartlegging + **CP1** runtime-integrasjon: synlig modulstatus (LIVE/LIMITED/DRY_RUN/STUB), bro-lenker til operative tårn — **ingen** ny runtime-sannhet i CMS.

---

## 1. Endelig beslutning

**GO WITH CONDITIONS**

**Begrunnelse:** Backoffice/CMS-laget er **reelt og dypt** (content tree, media, sider, variant publish, design/AI-integrasjon) og kan sammenlignes med **enterprise headless CMS**-mønstre på **innholdsaksen**. Samtidig er **plattformen samlet** ikke «ubetinget Umbraco-nivå» fordi operativ kjerne, growth-moduler og enterprise-governance fortsatt har **åpne hull** (jfr. `docs/enterprise-ready/UNCONDITIONAL_ENTERPRISE_LIVE_DECISION.md` **NO-GO** for *ubetinget* enterprise-live — uavhengig av denne CMS-rapporten).

---

## 2. Hva som er oppnådd

### 2.1 Hvordan CMS fungerer som hovedbase

- **CP1:** Superadmin-backoffice viser **runtime-modulstatus** (`CmsRuntimeStatusStrip`) og **bro** til superadmin fra `/backoffice/control` — kontrollplan uten å mutere ordre/avtaler.
- **Postgres-basert** backoffice (`app/(backoffice)/backoffice/content`) med **kanonisk** tree, pages API og publish — dokumentert i `docs/audit/CMS_BOUNDARY_AND_RUNTIME_BOUNDARY_REPORT.md`.
- **Sanity** for **meny / måltidstyper** og redaksjonell `weekPlan` — med **eksplisitt** skille: employee runtime bruker **`GET /api/week` + `menuContent`**, ikke `weekPlan` som operativ sannhet (`app/api/week/route.ts`, `lib/cms/weekPlan.ts`).

### 2.2 Hvilke domener som faktisk «snakker med» CMS

| Domene | Snakker med CMS |
|--------|-------------------|
| Public pages, marketing content | **Ja** — publish pipeline |
| Media | **Ja** |
| Meny (Sanity) | **Ja** — konsumert av runtime |
| Avtaler | **Via runtime** (Supabase) — CMS skal være **read/review**, ikke shadow DB |
| Ordre, billing | **Nei** (korrekt) — runtime only |

### 2.3 Ukeplan / ukemeny publisering

- **Operativ ukemeny for ansatt:** Menyinnhold fra Sanity + avtale i **`GET /api/week`**.
- **Redaksjonell weekPlan:** `POST /api/weekplan/publish` (superadmin) — **eget spor**; må ikke forveksles med employee runtime uten produktendring.

### 2.4 Control towers

- **Admin / superadmin / kitchen / driver** har **egne** operative flater; «alignment» under CMS er **narrativ + delt menykjede + hub-lenker** — ikke én shell for alle roller (se `CMS_CONTROL_TOWERS_ALIGNMENT.md`).

---

## 3. Hva som fortsatt er svakt

- **B1** To spor for «uke» (weekPlan vs meny) — må holdes dokumentert og UI-klar.
- **Growth:** Social/SEO/ESG — **TRANSITIONAL** flater; DRY_RUN/stub risiko.
- **A1/A2/A3** Middleware, APIflate, `strict: false` — jf. `OPEN_PLATFORM_RISKS.md`.
- **E1** Worker-stubs — enterprise NO-GO-funn.

### 3.1 Moduler som fortsatt er LIMITED / DRY_RUN / STUB

- **Social:** ekstern publish ofte **DRY_RUN** / policy-begrenset.
- **Worker:** `send_email`, `ai_generate`, … **STUB** (enterprise doc).
- **SEO:** batch + editor — **review-first**, ikke «magisk live» uten publish.

---

## 4. Nærhet til «Umbraco / verdensklasse»

| Dimensjon | Vurdering |
|-----------|-----------|
| **Content modeling & authoring** | **Høy** — blokker, workspace, preview, enterprise build-gates |
| **Multi-site / tenant CMS** | **Delvis** — ikke full Umbraco tenant-tree; firma ligger i Supabase |
| **Governance & safety** | **Middels** — gode gates, men åpne plattformrisikoer |
| **Operational commerce core** | **Sterk** — bevisst **ikke** flyttet inn i CMS (riktig) |

**Ærlig konklusjon:** På **innholds- og publiseringsdimensjonen** er systemet **i nærheten av** profesjonelle enterprise-CMS-forventninger. På **helhetlig enterprise-plattform** (auth-governance, worker, skala-bevis, ubetinget growth) er det **ikke** «verdensklasse ferdig» — se trafikklys og enterprise NO-GO.

---

## 5. Hva som må lukkes før ubetinget enterprise-live-ready

1. Lukk eller **deaktiver** worker-stub som **bruker** forventer som prod.
2. **Ærlig** social publish + env/policy.
3. **API-gate** konsistens eller dokumentert audit-program.
4. **`strict: true`** plan (lang kampanje).
5. **B1** produktavgjorelse eller signert risiko.
6. Lasttest eller **narrow-scale** beslutningsunderlag.

---

## 6. Hva som kan vente

- **Kosmetisk** CMS UX som ikke endrer sannhet.
- **Ytterligere** observability etter at blokker over er adressert.
- **Interne** superadmin-eksperimenter merket INTERNAL_ONLY.

---

**Kryssreferanse:** `UMBRACO_LEVEL_CMS_TRAFFIC_LIGHT_MATRIX.md`, `CMS_MAIN_BASE_OPEN_RISKS.md`.
