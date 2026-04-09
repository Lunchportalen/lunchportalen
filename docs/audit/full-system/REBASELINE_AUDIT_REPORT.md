# Rebaseline Audit Report

**Repository:** Lunchportalen (`c:\prosjekter\lunchportalen`)  
**Re-baseline utført:** 2026-03-27  
**Kontekst:** Etter refaktorfaser (FASE 1–15 m.fl., se `IMPLEMENTATION_LOG.md` / `POST_IMPLEMENTATION_REVIEW.md`).  
**Sannhetskilde:** Faktisk kode, `git`, kjøring av gates (se `REBASELINE_COMMANDS_AND_RESULTS.md`). Gamle audit-tall er **ikke** sannhet.

---

## 1. Executive summary

- **Brutalt:** Repoet er **ikke** en moden, konsolidert «enterprise CMS-plattform» på **Umbraco-nivå** for **redaksjonell modenhet og arkitekturgrenser**. Det **er** en **sterk** Next.js-monolitt med **dypt forankret forretningslogikk** (lunsj/tenant/operasjon), **solid automatisert gate** (typecheck, tester, plattformvakter, enterprise build), og **målrettede forbedringer** etter refaktor (persistens, dataflyt, post-login, render-pipeline, system graph uten reactflow på server).
- **Profesjonell plattformkvalitet?** **Delvis.** Drift/CI og kontraktsdisiplin på API er **profesjonelle**. **CMS-editor og vedlikeholdbarhet** er **fortsatt under** det nivået en Umbraco-lignende løsning forventer — primært pga. **fortsatt massiv editor-fil**, **stor HTTP/AIflate**, og **tester som ofte disabler TypeScript**.
- **Ny kritisk prosessobservasjon:** På denne arbeidsmaskinen **matcher ikke** filsystem og git for `app/api` og `lib/ai` (557 vs 314 ruter; 698 vs 295 AI-filer). **Det må ryddes** før man kan påstå «antall ruter i prod» — ellers er **re-baseline-tall** om flaten **misvisende**.

---

## 2. Scope og metode

| Fase | Innhold |
|------|---------|
| **A** | Repo-kart (`REBASELINE_FILE_INVENTORY.md`), kjerne/støtte/legacy, duplikat-sjekk. |
| **B** | Re-baseline av gamle funn (`REBASELINE_OLD_FINDINGS_STATUS.md`). |
| **C** | Teknisk gjennomgang: representative filer, `ContentWorkspace`, hooks, API-enforcers, `package.json`, risikoregister, `POST_IMPLEMENTATION_REVIEW`. |
| **D** | Kjøring: `typecheck`, `lint`, `test:run`, `build:enterprise` (heap 8192), `sanity:live`. |
| **E** | Sporingsnotat: editor → save/publish (fra dokumentert kjed + kodeplassering), auth (ikke dyp trace i denne filen), build/deploy (CI-workflows ikke endret i kjøring). |
| **F** | Root cause for gjenværende gap: se §5 og `REBASELINE_TOP_15.md`. |

**Ikke verifisert:** `npm run e2e`; full manuell mobilmatrise (AGENTS.md S1); `build` **uten** hevet heap; `sanity:live` mot kjørende app; penetrasjonstest av RLS; full linje-for-linje av alle **1470** TS/TSX-filer.

---

## 3. Hva som faktisk har blitt bedre (kodebevis / spor)

| Forbedring | Bevis |
|------------|--------|
| **Save/publish/dataflyt mer modellert** | `useContentWorkspacePersistence.ts`, `contentWorkspace.persistence.ts`, `contentWorkspace.intent.ts` — beskrevet i `IMPLEMENTATION_LOG.md` / `POST_IMPLEMENTATION_REVIEW.md`. |
| **Én data-sannhet for side lasting** | `useContentWorkspaceData.ts` eier list/detail/sync (per review-dokument). |
| **Post-login konsistent med roller** | `lib/auth/role.ts` + `allowNextForRole`; tester oppdatert (`postLoginRedirectSafety`). |
| **System graph server-sikker** | `buildSystemGraph.ts` uten `reactflow` import på server (IMPLEMENTATION_LOG). |
| **Kanonisk offentlig/preview parse** | `lib/cms/public/renderPipeline.ts`; `PreviewCanvas` / `normalizeBlockForRender` → `renderBlock`. |
| **API JSON-kontrakt håndhevet** | `scripts/ci/api-contract-enforcer.mjs` — **PASS** på kjøring (557 filer på disk i denne WS). |
| **Plattformvakter** | `ci:platform-guards` (api:contract, status:guard, mock:check, cms:check, ai:check, ui:clickable-check) — alle **OK** i `build:enterprise`. |
| **Duplikat repairs-route** | Kun `app/api/superadmin/system/repairs/*/route.ts` — tidligere duplikat utenfor `app/api` **ikke** funnet. |
| **`lint:ci` maskerer ikke lenger** | `package.json`: `"lint:ci": "next lint"` — ingen `|| exit 0`. |
| **Preview parity test uten `@ts-nocheck`** | `tests/cms/publicPreviewParity.test.ts` har ikke `@ts-nocheck` i toppen (verifisert lesing). |

---

## 4. Hva som fortsatt er svakt (kodebevis / spor)

| Problem | Bevis |
|---------|--------|
| **Editor-monolitt** | `ContentWorkspace.tsx` **~6401** linjer; massiv ESLint `exhaustive-deps` i samme fil (lint + build output). |
| **Stor HTTPflate** | **557** `route.ts` på disk (api-contract); **314** sporet i git — **avvik**. |
| **Stor AI-flat** | **698** `.ts` under `lib/ai` på disk; **295** sporet i git — **avvik**. |
| **Tester uten TS** | **79** filer med `@ts-nocheck` under `tests/**/*.ts`. |
| **Type-grenser** | `as unknown as` i produksjonskode (`grep` — `lib/ai`, `lib/revenue`, `componentRegistry`, m.fl.). |
| **Bilde/LCP** | `@next/next/no-img-element` warnings i CMS-komponenter. |
| **RLS på `global_content`** | Uendret risiko i policy (se `RISK_REGISTER.md` R7) — **krever** sikkerhetsmessig avklaring. |

---

## 5. Gjenværende root causes (strukturelt)

1. **Plattformvekst uten hard modulgrense** — kjerne lunsj + CMS + AI + growth lever i **samme** repo og bundler; kognitiv og operasjonell kostnad.
2. **Editor fortsatt «skall-sentrert»** — mye logikk er flyttet til hooks, men **én fil** binder preview, overlays, modal-stack og layout — review-barriere.
3. **Flate vs governance** — enterprise gates finnes, men **antall endepunkter og filer** overstiger hva et lite team kan holde i hodet uten **konsolidering** over tid.
4. **Testkultur vs TypeScript** — utstrakt `@ts-nocheck` undergraver **kontrakttillit**.
5. **Miljø/build** — Node heap og byggetid er **reelle** friksjoner (mitigert med flagg, ikke «borte»).

---

## 6. CMS/editor maturity now

| Spørsmål | Vurdering |
|----------|-----------|
| **Hvor moden er editoren?** | **Middels+ funksjonelt** (persistens, tre, preview-kjede dokumentert), **lav modenhet** for **vedlikehold** (monolitt-fil). |
| **Hva er monolittisk?** | `ContentWorkspace.tsx` + tett kobling av overlays/AI/modaler i samme skall; deler flyttet til hooks. |
| **Er preview tillitvekkende?** | **Mer** enn før: dokumentert pipeline + tester; **ikke** full manuell sign-off. |
| **Blokkarkitektur tydeligere?** | **Ja** (`registryManifest`, `renderPipeline`, felt-hints) — fortsatt **JSONB-fleksibilitet** som krever skjema-disiplin. |
| **Save/publish/dataflow modellert?** | **Ja** — persistence-lag og intent er eksplisitte (se review-logg). |
| **Hvor er shell fortsatt tung?** | `ContentWorkspace.tsx` (linjetall + memo/hooks-warnings). |
| **Mest «uprofesjonelt»?** | Git/disk-avvik; 79 nocheck-tester; RLS-review utestående; warnings som grønn gate. |
| **Hvor ble det bedre?** | Kontrakter, auth, server graph, CMS save-lag, parity-dokumentasjon. |
| **Under Umbraco-nivå?** | **Ja** på **redaksjonell modenhet og klar modellgrense** — ikke på «har mange features». |

---

## 7. Toppfunn — prioritert liste (minst 15)

Se `REBASELINE_TOP_15.md` for full tabell. Oppsummering: monolitt, git/disk-avvik, RLS, heap, flaten, nocheck, ESLint warnings, casts, studio-duplikat, manglende E2E, soft sanity, next lint migration, JSONB, AI-omfang.

---

## 8. Scoring now (0–10)

| Kategori | Score | Kommentar |
|----------|-------|-----------|
| Domain clarity | **5** | Kjerneordre klar; CMS/AI/growth overlapper. |
| Architectural coherence | **4** | Gates bra; struktur fortsatt «vokst inn». |
| CMS/editor maturity | **5** | Funksjon + refaktor; monolitt bremser. |
| Preview/publish reliability | **7** | Dokumentert kjede + tester; ikke full manuell. |
| Frontend robustness | **4** | Stor komponent; mange hook-warnings. |
| Backend/API quality | **6** | Kontraktsgate sterk; flaten enorm. |
| Data integrity | **6** | Migreringer; JSONB fortsatt risiko. |
| Security posture | **5** | Mønstre OK; `global_content` RLS må avklares. |
| Performance | **6** | Build OK med heap; img-warnings; lang build-tid. |
| UX consistency | **5** | Ikke systematisk verifisert på tvers. |
| Accessibility | **5** | Ikke full audit i denne runden. |
| Testability | **8** | Mange tester; nocheck svekker. |
| Maintainability | **4** | Monolitt + flaten. |
| Extensibility | **5** | Hooks/moduler hjelper; fortsatt tett kobling. |
| Operational maturity | **7** | CI gates grønne; heap-dokumentasjon trengs. |
| **Overall platform maturity** | **5** | Bedre enn «4» fra mars-audit, fortsatt under «sømløs plattform». |

### PASS/FAIL mot krav ≥8/10 i kritiske kategorier

**Kritiske (som i forrige audit):** Domain clarity, Architectural coherence, CMS/editor maturity, Security posture, Maintainability.

| Kategori | ≥8? |
|----------|-----|
| Domain clarity | **FAIL** |
| Architectural coherence | **FAIL** |
| CMS/editor maturity | **FAIL** |
| Security posture | **FAIL** |
| Maintainability | **FAIL** |

**Samlet:** **FAIL** mot 8/10-krav.

**Indikativ gjennomsnittsscore (15 kategorier):** ca. **5,5 / 10**.

---

## 9. What is still under professional standard

- **Redaksjonell og strukturell modenhet** (én håndterbar editor-modul, klar modellgrense) mot Umbraco-lignende forventning.
- **Full tillit til testene** pga. utstrakt `@ts-nocheck`.
- **Deterministisk lokal build** uten minne-tuning — **ikke** bevist.
- **Git-sannhet = kjørt kode** — **ikke** på denne arbeidskopien uten opprydding.

---

## 10. What is now genuinely improved

- **Save/publish-persistens** og **klarere dataflyt** for CMS.
- **Auth/post-login** og **system graph** (server) — færre footguns.
- **Preview/render** — dokumentert kanon + bedre testhygiene for parity-filen.
- **Enterprise CI-gates** — faktisk kjørt grønt inkl. `build:enterprise`.
- **API-kontrakt** — automatisk håndheving på alle `route.ts` som skanneren ser.

---

## 11. Next highest-value moves

1. **Rydd git vs disk** (API + `lib/ai`) — ellers er all flatemåling meningsløs.  
2. **Sikkerhetsreview `global_content` RLS** — bekreft eller stram inn.  
3. **Fortsett oppdeling av `ContentWorkspace.tsx`** — reduser monolitt.  
4. **Fjern `@ts-nocheck`** fra viktigste CMS-tester — øk kontrakttillit.  
5. **Dokumenter heap/CI** — operasjonell forutsigbarhet.

---

## 12. Final recommendation

**Valg: `continue re-architecture` (kontrollert, ikke big-bang).**

**Ikke** «repair only» — strukturelle årsaker (monolitt, flate, grenser) krever **fortsatt arkitekturarbeid**.  
**Ikke** «full migration» til ekstern CMS — ingen bevis i denne rebaseline for at det er nødvendig nå; **delvis migrering** (pakkegrenser, moduler) er **inneholdt** i «continue re-architecture».

---

## Obligatoriske spørsmål (svar)

1. **Hva er den egentlige kjernefeilen i repoet nå?** — **Manglende konsolidert plattformgrense**: én monolittisk editor + enorm HTTP/AIflate + test/TS-gap, **forsterket** hvis arbeidskopi ikke matcher git.

2. **Hvilke gamle funn er nå utdaterte?** — Duplikat `repairs`-route utenfor `app/api`; `lint:ci || exit 0`; `@ts-nocheck` **kun** i `publicPreviewParity` (fjernet); «314 ruter» som **eneste** tall uten git-kontekst.

3. **Hva er faktisk blitt bedre etter refaktor?** — Persistens/dataflyt, post-login, render-pipeline, server graph, kontraktsgates, parity-dokumentasjon (se §3).

4. **Hva er fortsatt klart under profesjonell standard?** — Editor-monolitt, test-TS-tillit, RLS-grep, flaten, ev. heap-behov.

5. **10 største risikoer neste 3–6 måneder?** — Feil merge pga. rotete WS; skjult regresjon i editor; authz-feil i stor APIflate; RLS misforståelse; build/CI-minne; JSONB-datakorrupt; AI-endepunkter uten review; ytelse (img/LCP); Next 16 lint-migrasjon; manglende E2E.

6. **Hva holder fortsatt systemet under Umbraco-nivå?** — Klar **innholdsmodell + redaktør-shell** som **én** moden plattform — dere har **funksjoner**, ikke **samme strukturelle ro**.

7. **Hvilke deler er nå gode nok til å bygges videre på?** — HTTP-responsmønster, CI-gates, CMS persistens-lag, blokker/registry/render-kjede, kjerneforretning (ordre/tenant) med tester.

8. **Hvilke deler må fortsatt re-arkitekteres?** — `ContentWorkspace.tsx`-skall, API-konsolidering over tid, `lib/ai` som tydelig modul, JSONB-schema ved skrivekant.

9. **Hva bør ikke videreføres?** — Ustrukturert vekst av **usporet** `route.ts`/`lib/ai`-filer; nye `@ts-nocheck` i tester; stille ignorering av ESLint der det skjuler logikkfeil.

10. **Nærmere godkjent eller fortsatt underkjent?** — **Nærmere** på **CI/teknisk disiplin**, fortsatt **underkjent** på **plattform-/CMS-modenhet** og **arbeidskopirens** — **ikke** «klar til endelig sign-off» som ren Umbraco-lignende plattform.

---

*Slutt på rapport — detaljerte kommandoer: `REBASELINE_COMMANDS_AND_RESULTS.md`. Tidligere funn-status: `REBASELINE_OLD_FINDINGS_STATUS.md`.*
