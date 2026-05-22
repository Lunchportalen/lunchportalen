# lib/ai — beslutningsgrunnlag

**Dato:** 2026-05-22  
**Scope:** Diagnose-only mini-audit av `lib/ai/`  
**Formål:** Avgjøre behold / arkivér / slett før neste kapittel  
**Metode:** Struktur-crawl, import-graf, git-historikk, tester, env — ingen kodeendringer

> **Sikkerhet:** Ingen hardkodede API-nøkler funnet i `lib/ai/`. Env leses via `process.env.AI_API_KEY` / `OPENAI_API_KEY` (fail-closed).

---

## Executive summary

| Metrikk | Verdi |
|---------|-------|
| Filer | **703** (702 `.ts` + 1 `.gitkeep`) |
| LOC (TypeScript) | **~81 434** |
| Andel av `lib/` | ~halvparten (per repo-audit) |
| Sist endret | **2026-05-12** — `fix: complete missing modifications and deletions from 2374bf4e` |
| Commits siste 6 mnd | **8** |
| Commits siste 3 mnd | **8** (samme sett) |
| App-filer som importerer | **~148** |
| `lib/` (utenom `lib/ai`) som importerer | **~95** |
| Testfiler som importerer | **47** |
| AI-cron i `vercel.json` | **0** (33 cron-ruter finnes, ingen er schedulert) |

**Konklusjon:** `lib/ai` er en **parallell AI/growth-plattform** innebygd i samme repo — ikke én homogen modul. En liten del er **kjerne-lunsj-relevant** (deterministisk etterspørselsprognose), en middels del er **CMS/backoffice AI** (OpenAI via `runner.ts`), og **~52 % av LOC** (`engines/`) er **capability-registry stubs** med metaforiske «singularity/omniscient/god-mode»-motorer som stort sett ikke når prod-cron.

---

## FASE 1 — Hva er det?

### 1.1 Topp-nivå struktur

`lib/ai/` har **~90 undermapper** og **~200 løse `.ts`-filer** på rot. Typiske mapper:

| Mappe | Rolle (kort) |
|-------|----------------|
| `engines/capabilities/` | 198 capability-filer — registry + deterministisk stub-logikk |
| `tools/` | CMS AI-verktøy (SEO, landing, bilde, A/B) |
| `intelligence/` | Signal/læring/scale for «system intelligence» |
| `memory/` | Persistens av AI-sykluser til Supabase |
| `control/`, `controlTower/`, `governance/` | Kill switch, policy, risiko |
| `capital/`, `revenue/`, `attribution/` | Growth/finance-automation |
| `reality/`, `monopoly/`, `boardroom/`, `org/` | Metaforiske «CEO/autonomy»-motorer |
| `design/`, `content/`, `layout/`, `ui/` | CMS side/blokk-generering |
| `kitchen/`, `menu/`, `delivery/`, `forecast/` | Lunsj-domene (delvis overlapp med kjernen) |
| `logging/` | `ai_activity_log`-radbyggere (brukt bredt) |

**README / package.json:** Ingen `README*` eller sub-`package.json` i `lib/ai/`.

### 1.2 Største subfolders (LOC)

| # | Mappe | LOC (ca.) |
|---|-------|-----------|
| 1 | `engines/` | **42 094** |
| 2 | `tools/` | 1 902 |
| 3 | `intelligence/` | 1 827 |
| 4 | `design/` | 969 |
| 5 | `memory/` | 835 |

`engines/capabilities/` alene = **198 filer**, ~**190+** med `registerCapability()`.

### 1.3 Største enkeltfiler (LOC)

| # | Fil | LOC |
|---|-----|-----|
| 1 | `recommendationActions.ts` | 967 |
| 2 | `businessObjective.ts` | 898 |
| 3 | `adaptiveLearning.ts` | 839 |
| 4 | `autoExecutor.ts` | 700 |
| 5 | `automationEngine.ts` | 634 |
| 6 | `runner.ts` | 519 |
| 7 | `_internalProvider.ts` | 460 |
| 8 | `engines/capabilities/generateUIComponents.ts` | 385 |
| 9 | `blockSchema.ts` | 380 |
| 10 | `engines/capabilities/lunchExperienceDesigner.ts` | 376 |

### 1.4 Filtyper

```
   702 ts
     1 gitkeep
```

Ren TypeScript — ingen generert binær, ingen vendored SDK-mapper.

### 1.5 Eksterne avhengigheter (npm)

Direkte tredjeparts-import i `lib/ai/` er **minimal**:

| Pakke | Bruk |
|-------|------|
| `openai` | Kun `lib/ai/getClient.ts` (legacy); kanonisk path er `_internalProvider.ts` → `runner.ts` |
| `server-only` | Guard på server-moduler |

Alt annet er `@/lib/*` (Supabase, HTTP, date, observability). ESLint + `scripts/check-ai-internal-provider.mjs` **låser** `_internalProvider` til kun `runner.ts`.

### 1.6 LLM-kall?

| Spørsmål | Svar |
|----------|------|
| OpenAI/GPT/LLM-referanser | **Ja** — ~150+ filer nevner openai/gpt/llm (ofte i kommentarer, capability-beskrivelser eller via `runAi`/`runAI`) |
| Faktisk HTTP til provider | **`runner.ts` → `_internalProvider.ts`** — eneste tillatte provider-inngang |
| Embeddings/vektor-DB | **Nei** — kun 2 filer (`predictor.ts`, `generateIllustration.ts`) nevner vector/embedding; ingen Pinecone/Chroma/Qdrant |
| Auto-generert? | **Nei** — 1 fil (`autoGenerateLinks.ts`) har «generated» i kommentar; ingen mass `_generated` / DO NOT EDIT |

### 1.7 Arkitektur (kort)

```
app/api/backoffice/ai/*  ──┐
app/api/ai/*             ──┼──► runner.ts ──► _internalProvider.ts ──► OpenAI API
lib/ai/suggestMotor.ts   ──┘         │
                                       ├── policyEngine, profitability, governance
                                       └── tools/registry (CMS-verktøy)

app/api/kitchen/demand-forecast ──► demandEngine.ts (deterministisk, ingen LLM)

app/api/cron/* (33 ruter) ──► automationEngine, singularity, org, … 
                              (killSwitch; IKKE i vercel.json)
```

**Capability-mønster:** Hver fil i `engines/capabilities/` registrerer metadata i `capabilityRegistry.ts` og implementerer ofte **deterministisk** logikk merket «no LLM». Mange er **ikke koblet til noen rute** — de eksisterer som registrerte evner for fremtidig orchestration.

---

## FASE 2 — Er det importert fra app-kode?

### 2.1 Import-telling

| Kilde | Filer med `@/lib/ai`-import |
|-------|------------------------------|
| `app/` | **~148** |
| `lib/` (ekskl. `lib/ai/`) | **~95** |
| `tests/` | **47** |
| `lib/ai/` (intern) | ~500+ (selvreferanse) |

### 2.2 Live vs isolert — kategorisering

#### A) Kjerne lunsj (RC-produkt) — **LIVE, lite footprint**

| Importer | Modul | Live? |
|----------|-------|-------|
| `app/api/kitchen/demand-forecast/route.ts` | `demandData`, `demandEngine` | **Ja** — kjøkken-prognose, deterministisk |
| `app/api/order/week-demand-hints/route.ts` | `demandEngine` / relatert | **Ja** |
| `app/api/admin/demand-insights/route.ts` | `demandInsights` | **Ja** |
| `app/kitchen/KitchenView.tsx` | (indirekte via API) | **Ja** |

`demandEngine.ts` er eksplisitt **V1 deterministisk, uten ML** — stabil kontrakt for senere utskifting.

#### B) CMS / Backoffice AI — **LIVE ruter, BETA produkt**

| Importer | Modul | Live? |
|----------|-------|-------|
| `app/api/backoffice/ai/suggest/route.ts` | `suggestMotor`, `runner` | **Ja** |
| `app/api/backoffice/ai/text-improve/route.ts` | `runner`, `editorTextSuggest` | **Ja** |
| `app/api/backoffice/ai/page-builder/route.ts` | `pageBuilder`, `blockSchema` | **Ja** |
| `app/api/backoffice/ai/block-builder/route.ts` | tools/blockBuilder | **Ja** |
| `app/api/backoffice/ai/capability/route.ts` | provider config | **Ja** |
| `app/api/ai/copilot/route.ts` | `copilot`, `context` | **Ja** |
| `app/api/ai/*` (~25 ruter) | diverse `lib/ai/*` | **Ja** (deployet, env-gated) |
| `app/(backoffice)/backoffice/content/**` | `cmsAiEngine`, `pageBuilder`, … | **Ja** (UI) |

Krever `AI_API_KEY` / `OPENAI_API_KEY` — returnerer 503 når disabled.

#### C) Growth / sales / social — **LIVE kode, sekundær flate**

| Importer | Modul | Live? |
|----------|-------|-------|
| `lib/sales/messageGenerator.ts` | `run`, `runner` | **Ja** (lib → API) |
| `lib/social/unifiedGenerator.ts` | `conversionGenerator`, `ctaOptimizer` | **Ja** |
| `lib/autonomy/*`, `lib/pos/*`, `lib/growth/*` | logging, decision, experiments | **Ja** (parallelt spor) |
| `app/api/crm/lead/route.ts`, `app/api/sales/send/route.ts` | AI-assistert salg | **Ja** |

#### D) Cron-automation — **KODE FINNES, IKKE PROD-SCHEDULE**

33 filer under `app/api/cron/*` importerer `lib/ai` (singularity, omniscient, god-mode, monopoly, boardroom, org, autonomous, …).

**`vercel.json` har 16 cron-jobber — ingen er AI.** Disse rutene er kun callable manuelt / fremtidig schedule / preview. Alle sjekker typisk `isSystemEnabled()` (`AI_GLOBAL_KILL_SWITCH`).

#### E) Isolert sandbox — **kun lib/ai + tests/ai**

| Område | Estimat | Importert utenfra? |
|--------|---------|-------------------|
| `engines/capabilities/*` (bulk) | ~42k LOC | **Stort sett nei** — kun via wrapper-engines |
| `reality/*`, `monopoly/*`, `omniscient*` | ~3–5k LOC | Kun cron-ruter (D) + tester |
| `brain/lunchEcosystemBrain.ts` | 26 interne imports | Kun meta-orchestrators |

### 2.3 Oppsummert import-tabell (utvalg)

| lib/ai-modul | Importert fra | Live deploy? |
|--------------|---------------|--------------|
| `runner.ts` | 20+ API-ruter, `suggestMotor`, sales | **Ja** |
| `demandEngine.ts` | kitchen, admin, order | **Ja** (kjerne) |
| `logging/aiActivityLogRow.ts` | sales, social, autonomy, experiments | **Ja** |
| `control/killSwitch.ts` | alle AI-crons | **Ja** (gate) |
| `automationEngine.ts` | cron/*, autonomy | **Kode ja, cron nei** |
| `engines/capabilities/*` | wrapper-engines | **For det meste nei** |
| `reality/*`, `singularity*` | cron/reality, cron/singularity | **Kode ja, cron nei** |

---

## FASE 3 — Aktivitets-historikk

| Periode | Commits som rørte `lib/ai/` |
|---------|----------------------------|
| Siste 6 mnd | **8** |
| Siste 3 mnd | **8** |
| Siste 1 mnd | **1** |

**Siste commit:** 2026-05-12 — `fix: complete missing modifications and deletions from 2374bf4e`

**Nylige commits (6 mnd):**
```
47827124 fix: complete missing modifications and deletions from 2374bf4e
532dc713 chore: deploy current public cms runtime state
0ab2cf35 app/lib: commit scoped keep-candidates from U112
a809362e ai elite Level 190326v9
839fd6a6 Fix: hover contrast (no white-on-white) + failsafe
37068417 Rescue restore AI/CMS work from stash
26768366 Editor AI: wire layout-suggestions, block-builder, screenshot-builder...
0e9f6728 Fix backoffice CMS: slug routing, stale outbox cleanup...
```

**Tolkning:** Aktiviteten er **burst/repair** (CMS rescue, deploy chore) — ikke kontinuerlig produktutvikling. Ingen dedikert AI-team-rytme synlig i git.

---

## FASE 4 — Tester

### 4.1 Teststruktur

| Metrikk | Verdi |
|---------|-------|
| `tests/ai/` filer | **39** |
| Alle tester med «ai» i path | **~77** |
| Inkludert i Vitest? | **Ja** — `include: tests/**/*.test.ts(x)` |
| Eksplisitt skip av ai? | **Nei** |
| Egen npm-script for ai? | **Nei** |

### 4.2 Testkategorier

| Kategori | Eksempler |
|----------|-----------|
| CMS / editor | `CmsAiHappyPath`, `pageBuilderDraft`, `seoToolPolicy` |
| «Engine»-metaforer | `singularityEngines`, `godModeEngines`, `omniscientEngines`, `realityEngines`, `monopolyEngines`, `boardroomEngines` |
| Kjerne-adjacent | `providerFallback`, `designSettingsOptimizer`, `profit`, `resourceAllocation` |
| API-ruter | `backofficeAiSuggest`, `backofficeAiImageRoutes` |

**Tolkning:** Testene **validerer sandbox-motorer og CMS AI** — de beviser ikke prod-verdi for lunsj-kjerne. De kjører i full `npm run test:run` og øker CI-tid/kompleksitet.

---

## FASE 5 — Env-vars og config

### 5.1 Env lest i `lib/ai/`

| Variabel | Formål | `.env.example`? |
|----------|--------|-----------------|
| `AI_API_KEY` | Kanonisk provider-nøkkel | **Nei** (ingen `.env.example` i repo) |
| `OPENAI_API_KEY` | Backward-compat fallback | **Nei** |
| `AI_PROVIDER` | f.eks. `openai` | **Nei** |
| `AI_MODEL` | Modelloverride (default `bootstrap` → `gpt-4o-mini`) | **Nei** |
| `AI_GLOBAL_KILL_SWITCH` | `"true"` → stopper automation | **Nei** |
| `AI_PROFITABILITY_ENABLED` | Margin/budget gate i runner | Satt `false` i vitest |

Ingen `ANTHROPIC_*`, `HUGGINGFACE_*`, `REPLICATE_*`, `COHERE_*` i `lib/ai/`.

### 5.2 Vercel / prod

- Provider aktiveres **kun når nøkkel + provider er satt** — ellers fail-closed (`isAIEnabled()` → false, routes → 503).
- **Kan ikke verifisere** Vercel env fra denne auditen uten dashboard-tilgang; kode forutsetter at nøkler **kan** være satt for backoffice AI i staging/preview.
- **`vercel.json` scheduler ingen AI-cron** → growth-automation kjører ikke automatisk i prod uansett env.

### 5.3 Governance i repo

- `scripts/check-ai-internal-provider.mjs` — provider import-lås
- `lib/ai/aiEntrypointContext.ts` — entrypoint-sporing for beslutninger
- `lib/http/withApiAiEntrypoint.ts` — wrapper for AI API-ruter

---

## FASE 6 — Klassifikasjon og anbefaling

### KLASSIFIKASJON: **D — DELVIS BRUKT**

### BEGRUNNELSE

`lib/ai` er **ikke** en homogen ALPHA-stub: ~148 app-filer og `runner.ts` er **live deployet kode** (CMS AI + noen lunsj-prognoser), med **47 testfiler** og nylig (lav) commit-aktivitet. Men **~52 % av LOC** (`engines/capabilities/`) er **capability-registry scaffolding** som stort sett kun refereres internt, og **33 AI-cron-ruter er absent fra `vercel.json`** — de utgjør en **frossen growth-automation skala** inne i samme mappe. Dette er en **parallell plattform** bundet til backoffice/growth, ikke kjerne-lunsj RC.

### ANBEFALT HANDLING

**Fase D1 — Kartlegg «keep-set» (0 risiko, ½ dag)**  
Bygg import-graf fra `app/` + kjerne-`lib/` (ekskl. growth). Forventet keep-set (~25–40 filer):

- **Kjerne lunsj:** `demandEngine.ts`, `demandData.ts`, `demandInsights.ts`
- **CMS AI (hvis backoffice beholdes):** `runner.ts`, `_internalProvider.ts`, `suggestMotor.ts`, `pageBuilder*.ts`, `cmsAiEngine.ts`, `tools/*`, `blockSchema.ts`, `designTokens.ts`
- **Querschnitt:** `logging/*`, `rateLimit.ts`, `control/killSwitch.ts`, `types.ts`

**Fase D2 — Arkivér bulk (1–2 dager)**  
Opprett branch `archive/lib-ai-frozen-2026-05` med full `lib/ai` + tilhørende `tests/ai/*engine*` + ubrukte cron-ruter. På `main`: fjern eller flytt til arkiv:

- `lib/ai/engines/capabilities/` (198 filer)
- Metafor-motorer: `reality/`, `monopoly/`, `boardroom/`, `org/` (cron-only), `brain/lunchEcosystemBrain.ts`
- Cron-ruter uten `vercel.json`-entry (33 stk) — eller behold ruter som 410/stub med tydelig «not scheduled»

**Fase D3 — Dokumentér og env (½ dag)**  
Legg til `.env.example`-seksjon for `AI_API_KEY`, `AI_PROVIDER`, `AI_GLOBAL_KILL_SWITCH`. Oppdater `docs/audit/repo-state-*.md` med «lib/ai-core» vs «archived».

**Fase D4 — CI-gevinst (valgfritt, ½ dag)**  
Splitt tunge `tests/ai/*Engines*` til egen `test:ai-sandbox` — ikke blokker enterprise gates for lunsj RC.

**Ikke anbefalt nå:** Full sletting fra git (historikk bevares uansett). **Ikke** klassifiser som ren C (frossen eksperiment) — CMS AI er wired og testet.

### ESTIMAT

| Fase | Tid |
|------|-----|
| D1 keep-set kartlegging | **4 timer** |
| D2 arkiv-branch + main cleanup | **1–2 dager** (avhengig av import-fikser) |
| D3 dokumentasjon + env | **4 timer** |
| D4 test-split (valgfritt) | **4 timer** |
| **Totalt** | **~2–3 arbeidsdager** for trygg delvis uttrekk |

### Risiko ved ingen handling

- **Cognitive overhead:** nye utviklere tror 81k LOC er prod-kritisk
- **CI-tid:** 39+ ai-tester kjører alltid
- **Sikkerhetsflate:** 25+ `app/api/ai/*` + 30+ backoffice AI-ruter uten tydelig RC-scope
- **Feilaktig deploy:** noen kan schedule AI-cron i Vercel uten forståelse av modenhet

---

## Vedlegg A — Rot-filer (utvalg)

Over 200 løse filer på rot, inkl.: `runner.ts`, `automationEngine.ts`, `autoExecutor.ts`, `businessObjective.ts`, `singularity*` (via undermapper), `saas*Engine.ts`, `copilot.ts`, `pageBuilder.ts`, `demandEngine.ts`, `killSwitch` (i `control/`).

## Vedlegg B — Beslutningsmatrise

| Kriterium | A Aktiv | B Vendored | C Frossen | D Delvis | E Annet |
|-----------|---------|------------|-----------|----------|---------|
| Importert app | ✅ mange | — | delvis | ✅ | — |
| Nylige commits | ⚠️ lite | — | ⚠️ | ⚠️ | — |
| Tester | ✅ 47 | — | — | ✅ | — |
| Prod cron | ❌ | — | — | ❌ | — |
| Bulk stub LOC | — | — | ✅ | ✅ ~52% | — |
| **Match** | delvis | nei | delvis | **beste** | — |

## Vedlegg C — Referanser

- `docs/audit/repo-state-2026-05-22.md` — flagget lib/ai som STUB/ALPHA
- `lib/ai/runner.ts` — kanonisk AI-inngang
- `lib/ai/demandEngine.ts` — deterministisk lunsj-prognose
- `vercel.json` — 16 cron, 0 AI
- `scripts/check-ai-internal-provider.mjs` — provider-lås

---

*Audit utført uten kodeendringer. Ingen filer slettet.*

---

# FASE A — Presis cut-list (2026-05-22)

**Metode:** `scripts/audit/lib-ai-cut-list-v2.mjs`, `scripts/audit/lib-ai-keep-closure.mjs` — ingen sletting.

## A1) Keep-set (transitiv closure fra live importers)

Keep-set er **ikke** manuelt begrenset til ~10 filer — transitiv closure fra alle `app/` + `lib/` (ekskl. cron) + `tests/` som importerer ikke-arkiv moduler gir:

| Metrikk | Verdi |
|---------|-------|
| Filer | **297** |
| LOC | **29 890** |
| Artifacts | `scripts/audit/lib-ai-keep-closure.json` |

### Kjerne-seed (eksplisitt prod-lunsj)

| Path | Rolle |
|------|-------|
| `lib/ai/demandEngine.ts` | Deterministisk etterspørselsprognose V1 |
| `lib/ai/demandData.ts` | Aggregering ordre → daglig historikk |
| `lib/ai/demandInsights.ts` | Valg-signaler fra day_choices |
| `lib/ai/wasteTracker.ts` | Svinn-metrics (admin demand-insights) |
| `lib/ai/portionAllocation.ts` | Proporsjonal porsjonsmix |
| `lib/ai/menuToIngredients.ts` | Statisk meny→ingrediens katalog |
| `lib/ai/operationsFeedback.ts` | Hindcast siste leveringsdag |

### CMS AI + runner (seed)

| Path | Rolle |
|------|-------|
| `lib/ai/runner.ts` | Kanonisk OpenAI-inngang |
| `lib/ai/_internalProvider.ts` | Provider HTTP (låst til runner) |
| `lib/ai/suggestMotor.ts` | Backoffice suggest dispatch |
| `lib/ai/pageBuilder.ts` + `pageBuilder*.ts` | Side-generering |
| `lib/ai/cmsAiEngine.ts` + `cmsAi*.ts` | CMS AI motor |
| `lib/ai/tools/*` | Verktøy-registry (SEO, landing, bilde, A/B) |
| `lib/ai/design/*` | Design optimizer |
| `lib/ai/autoImprove.ts`, `editorTextSuggest.ts` | Editor AI |
| `lib/ai/blockSchema.ts`, `designTokens.ts`, `types.ts` | Kontrakter |

### Querschnitt (seed)

| Path | Rolle |
|------|-------|
| `lib/ai/logging/*` | ai_activity_log-rader |
| `lib/ai/control/killSwitch.ts` | `AI_GLOBAL_KILL_SWITCH` gate |
| `lib/ai/rateLimit.ts`, `responseSafety.ts` | API-beskyttelse |
| `lib/ai/policyEngine.ts`, `runnerGovernance.ts`, `profitability.ts`, `usage.ts` | Runner-governance |

Closure legger til **~250 transitive avhengigheter** (intelligence, experiments, memory, company, ceo, autonomy, osv.) som backoffice-ruter faktisk kaller.

## A2) Archive-set (narrow — per refactor-brief)

| Kategori | Filer | LOC |
|----------|-------|-----|
| `engines/` (inkl. capabilities/) | 198 | ~42 094 |
| `reality/`, `monopoly/`, `boardroom/`, `org/`, `brain/` | 64 | ~8 500 |
| Root meta-motorer (automationEngine, omniscient*, swarm, …) | 35 | ~2 100 |
| **Narrow archive sum** | **262** | **~50 196** |

## A3) Orphan-set (verken keep eller narrow archive)

**136 filer / ~10 585 LOC** — ikke nådd fra live importers etter cron-exclusion. Eksempler: `autoExecutor.ts`, `ceoSimulate.ts`, `architecture/siteArchitect.ts`, `agents/runner.ts`. **Slettes sammen med archive-set i FASE D.**

## A4) LOC før cleanup

| Sett | Filer | LOC |
|------|-------|-----|
| **Keep** | 297 | 29 890 |
| **Archive (narrow)** | 262 | 50 196 |
| **Orphan** | 136 | 10 585 |
| **Total lib/ai** | 702 | 91 007 |

*Merk: LOC-telling inkluderer blanke linjer; tidligere audit (~81k) telte kun `.ts` body uten full fil-telling.*

## A5) App-import-analyse

| Metrikk | Verdi |
|---------|-------|
| Unike app-filer med `@/lib/ai`-import | **134** |
| Import-statements totalt | **408** |
| Import-statements til archive-set | **79** |
| **Impact-filer (archive-import)** | **21** |
| — daværende cron-ruter (slettes) | **16** |
| — non-cron (refaktoreres) | **5** |

### Impact-filer som krever refaktor (FASE C)

| Source | Archive-imports | Forslag |
|--------|-----------------|---------|
| `app/api/admin/operations-tower/route.ts` | procurementEngine, purchasePlanner, supplierPlanner, productionPlanner, routePlanner, costOptimizationEngine, composeOperationsAutonomy, composeGlobalOs | **Forenkle:** behold demand/portion/feedback; fjern procurement/production/route/cost/autonomy fra respons |
| `app/api/ai/automation/route.ts` | automationEngine | **Slett rute** (ikke i vercel.json, growth-only) |
| `app/api/ai/swarm/route.ts` | swarm, consensus, governor | **Slett rute** |
| `app/api/system/ai/diagnostics/route.ts` | capabilityRegistry | **Fjern** `listCapabilities()` — behold runner health |
| `app/api/system/ai/health/route.ts` | capabilityRegistry | **Fjern** `listCapabilities()` |

### Cron-ruter som slettes (33 stk, 0 i vercel.json)

Alle under `app/api/cron/*` som importerer `@/lib/ai`:

`ai`, `ai-ceo`, `ai-governance-auto`, `ai-optimize`, `attribution`, `autonomous`, `autonomy`, `blackbox`, `boardroom`, `budget-execution`, `capital-allocation`, `ceo`, `credit-check`, `god-mode`, `invoice-companies`, `market`, `monitor`, `monopoly`, `omniscient`, `org`, `profit`, `realtime-monitor`, `reality`, `resolve-experiments`, `retrain`, `retrain-sequence`, `revenue-mode`, `scaling`, `singularity`, `strategy`, `train-model`, `train-sequence`

### Lib impact (non-cron)

| Source | Archive-import | Forslag |
|--------|----------------|---------|
| `lib/pos/executionRouter.ts` | automationEngine | **Fjern** `runAutomation`-preview; behold policy + design tokens |

## A6) Test-import-analyse

**47 testfiler** importerer `@/lib/ai`. **~30 tester** peker kun på archive-set (singularityEngines, monopolyEngines, boardroomEngines, realityEngines, omniscientEngines, godModeEngines, orgEngines, marketEngines, capitalAllocationEngines, budgetExecutionEngines, revenueModeEngines, scaling, profit, predictiveLayer, outcomeLearning, autonomousSaasEngines, strategicEngines, company/controlTower, attribution, resourceAllocation, controlLayer delvis). **Slettes i FASE D.**

**Beholdes:** providerFallback, seoToolPolicy, cmsAiTenant, cmsAiEngine.heuristic, autoImprove, pageBuilderDraft, designSettingsOptimizer, analyzeDesign, designPolicy, blockSchema, pageBuilder, aiSystemGuarantees, CmsAi*-tester, backofficeAi*-tester.

## A7) STOP-condition

| Kriterium | Resultat |
|-----------|----------|
| Impact-filer > 50 (narrow archive) | **NEI** — 21 totalt (16 cron + 5 refaktor) |
| Archive-modul kritisk for live lunsj | **NEI** — kjøkken bruker kun demandEngine/demandData |
| Broad archive (capital, memory, scaling, …) | **Ikke i scope** — forblir i keep-set inntil egen runde |

### GO/STOP: **GO** — fortsett til FASE B–E

## A8) Feature-områder som mister funksjonalitet ved archive-slett

| Område | Hva forsvinner | RC-impact |
|--------|----------------|-----------|
| AI-cron automation | singularity, god-mode, boardroom, org, monopoly, reality, … | **Ingen** — ikke schedulert i prod |
| `app/api/ai/automation`, `/swarm` | Growth API-endepunkter | **Lav** — ikke kjerne-lunsj |
| Operations-tower utvidet | Procurement, production, route, cost, globalOs | **Medium** — admin-only forslag; demand-delen beholdes |
| Capability registry diagnostics | Liste over 198 capabilities | **Lav** — dev/diag only |
| POS automation preview | runAutomation forhåndsvisning | **Lav** — policy/design beholdes |
| tests/ai/*Engines* | Sandbox engine-tester | **Ingen prod** — CI raskere |

---

# FASE A–E — Cleanup gjennomført (2026-05-22)

## Resultat

| Metrikk | Før | Etter |
|---------|-----|-------|
| lib/ai filer | 702 | **277** |
| lib/ai LOC | ~91 007 | **~26 258** |
| App-filer med archive-import | 21 | **0** |
| AI-cron i vercel.json | 0 | 0 |
| AI-cron-ruter i repo | 33 | **0** |
| Archive-engine-tester | ~20 | **0** |

## Commits (main)

| SHA | Fase | Beskrivelse |
|-----|------|-------------|
| `d04038e3` | A | Presis cut-list + analyse-scripts |
| `16b50e1d` | C1 | Slett 34 cron/growth API-ruter |
| `62aef71d` | C2 | Refaktor operations-tower, executionRouter, health/diagnostics |
| `b96e3b7e` | D | Slett 425 lib/ai-filer + 21 tester |

## Archive-branch

**`archive/lib-ai-frozen-2026-05`** — pushet til origin, immutable snapshot før cleanup (`d04038e3`).

## Verifisering

- `npm run test:run` — **2322 passed**, 0 failed
- `npm run typecheck` — PASS
- `npm run lint` — PASS (warnings only)
- `npm run build:enterprise` — PASS

## Modenhet etter cleanup

**IN-PROGRESS** — keep-set (~26k LOC) er reelt brukt: kjøkken-prognose, CMS/backoffice AI via `runner.ts`, logging, killSwitch. Archive-bulk (engines/capabilities, singularity-cron, metafor-motorer) fjernet fra main.

---

*Cleanup fullført 2026-05-22.*
