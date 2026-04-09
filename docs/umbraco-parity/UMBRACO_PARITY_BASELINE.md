# Umbraco parity — baseline (Lunchportalen)

**Stack-referanse:** Next.js App Router · Supabase (runtime) · Sanity (innhold/meny) · Postgres (CMS-sider) — **ikke** Umbraco/.NET.

**Dato:** 2026-03-29

## Hva som allerede er på Umbraco-*lignende* nivå

- **Én backoffice control plane** for superadmin: `BackofficeShell`, rolle-gate (`superadmin` only), `CmsRuntimeStatusStrip`, navigasjon under `/backoffice/*`.
- **Content tree + workspace:** `/backoffice/content` med tre, blokker, preview/publish mot Postgres (`cms`-sider) — enterprise-lignende redaksjonsflate.
- **Media library:** `/backoffice/media` med API-gate og metadata/variant-mønstre (jf. eksisterende implementasjon).
- **Domain action surfaces:** `CONTROL_PLANE_DOMAIN_ACTION_SURFACES` — eksplisitt kilde, posture, handlinger og «why it matters» (CP4–CP7).
- **Module posture:** `moduleLivePosture` / `controlPlaneRuntimeStatusData` — ærlige badges (LIVE / LIMITED / DRY_RUN / STUB).
- **Uke & meny:** `/backoffice/week-menu` med operativ kjede forklart; CP7 **native publish** for `menuContent` via server-broker (Sanity Actions), parallelt med Studio.
- **Sanity Studio** (`studio/`) som fagredaktørverktøy for schema-baserte dokumenter (Umbraco-paritet for *innholdsproduksjon*, ikke for kjerneteknologi).

## Hva som fortsatt er *under* klassisk Umbraco-paritet

- **Én sammenkoblet .NET Content Service** med alt-i-ett — finnes ikke; sannhet er **delt** (Postgres pages vs Sanity vs Supabase).
- **Innebygd scheduling / versions / rollback** på én plattform — delvis (content workspace + Sanity history), ikke fullt samlet UX.
- **Granulerte CMS-roller** (editor vs writer vs translator) i backoffice — i praksis **superadmin** for `/backoffice`; øvrige roller i egne apps.
- **Unified search** på tvers av alle entitetstyper i én «backoffice search» — begrenset vs Umbraco backoffice.

## Baseline-problemer løst siden eldre deep-dive (referanse: CP1–CP7)

- Tydelig **operativ vs redaksjonell** grense (`weekPlan` vs `GET /api/week`).
- **Publish-handoff** og deretter **server-broker** for `menuContent` uten ny DB-sannhet.
- **Action routing matrix** og kontrollplan-dokumentasjon under `docs/cms-control-plane/`.

## Åpne plattform-risikoer (gjeldende)

- Synkronisering **Sanity ↔** ev. **`menu_visibility_days`** (superadmin menyoversikt) — må operativt forstås (ikke «én knapp» i LP).
- **CDN-latens** etter Sanity publish.
- Growth-moduler kan være **LIMITED** — avhenger av deployment og faktisk jobb-backend.

## Hva som må samles under CMS control plane for helhet

- **Samme språk og IA:** alle kritiske domener har allerede *surface href* + posture; gjenstår løpende **UI-konsistens** og færre «sidestilt» inntrykk (navigasjon, dashboards).
- **Én rød tråd i docs + UI:** runtime forblir i Supabase; CMS eier **styring, publish, review, routing** — ikke transaksjonsmotor.
