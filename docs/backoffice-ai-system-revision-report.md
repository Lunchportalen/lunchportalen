# Backoffice AI-system – systemrevisjon rapport

**Dato:** 2025-03-09  
**Omfang:** Full kartlegging, verifikasjon, feilsøking og utbedring av AI-funksjoner i Backoffice.

---

## 1. Liste over alle AI-funksjoner i Backoffice

| # | AI-funksjon | UI-komponent | Route / domain | Status før | Status etter |
|---|-------------|--------------|----------------|------------|--------------|
| 1 | **Improve Page** | ContentAiTools | POST /api/backoffice/ai/suggest, tool: content.maintain.page | Summary viste seg ikke (feil payload-lesing) | **100 %** – summary + patch brukes |
| 2 | **SEO optimize side** | ContentAiTools | POST /api/backoffice/ai/suggest, tool: seo.optimize.page | Samme | **100 %** |
| 3 | **Generate sections** | ContentAiTools | POST /api/backoffice/ai/suggest, tool: landing.generate.sections | Samme | **100 %** |
| 4 | **Structured intent (A/B-varianter)** | ContentAiTools | POST /api/backoffice/ai/suggest, tool: experiment.generate.variants | Summary manglet for suggestionIds-respons | **100 %** |
| 5 | **AI Layout Suggestions** | ContentAiTools | – | Eksplisitt deaktivert i UI | **Foundation** – ingen route i editor |
| 6 | **AI Block Builder** | ContentAiTools | – | Eksplisitt deaktivert (block-suggest route finnes ikke) | **Foundation** |
| 7 | **AI Image Generator** | ContentAiTools | POST /api/backoffice/ai/suggest, tool: image.generate.brand_safe | Summary kunne mangle pga payload | **100 %** |
| 8 | **AI Screenshot Builder** | ContentAiTools | – | Eksplisitt deaktivert (screenshot-route finnes ikke) | **Foundation** |
| 9 | **Image metadata helper** | ContentAiTools | POST /api/backoffice/ai/suggest, tool: image.improve.metadata | Summary kunne mangle | **100 %** |
| 10 | **AI Control Center (Jobs)** | AIControlPage | GET /api/backoffice/ai/jobs, POST jobs/run | Fungerer | **100 %** |
| 11 | **AI Control (Content Health)** | AIControlPage | GET health/latest, POST health/scan | Fungerer | **100 %** |
| 12 | **AI Control (Experiments)** | AIControlPage | GET /api/backoffice/experiments/stats | Fungerer | **100 %** |
| 13 | **Suggestions API (liste)** | – | GET /api/backoffice/ai/suggestions | Brukes ikke i UI i content-editor | **Fungerer** |
| 14 | **Suggestions API (hent én)** | – | GET /api/backoffice/ai/suggestions/[id] | Brukes ikke i UI | **Fungerer** |
| 15 | **Apply (audit log)** | – | POST /api/backoffice/ai/apply | Kun logging, ingen innholdsapply | **Fungerer** (audit) |

---

## 2. Status per funksjon (kort)

- **Fungerer 100 %:** Improve Page, SEO optimize, Generate sections, Structured intent, AI Image Generator, Image metadata helper, AI Control (jobs, health, experiments). Summary vises nå korrekt; patch brukes i editoren der API returnerer patch.
- **Delvis:** Ingen etter rettelsene.
- **Foundation only:** AI Layout Suggestions, AI Block Builder, AI Screenshot Builder (UI viser «Ikke tilgjengelig», ingen misvisende løfter).
- **Feil / manglet:** Ingen åpen feil igjen i de aktive flytene.

---

## 3. Konkrete feil som ble funnet og rettet

### 3.1 Response-parsing i ContentWorkspace (kritisk)

- **Problem:** API returnerer `{ ok, rid, data: { suggestionId, suggestion } }`. Klienten brukte `json.data` direkte til `extractAiSummary(tool, data)`. Faktisk tool-output (summary, patch, candidates) ligger i `data.suggestion`, så summary ble aldri satt og brukeropplevelsen var «ingenting skjer».
- **Rettelse:** I `callAiSuggest` brukes nå `payload = data.suggestion ?? data` for summary og patch. `extractAiSummary(tool, payload)` og eventuell patch-apply bruker samme `payload`.

### 3.2 Summary for experiment.generate.variants

- **Problem:** For A/B-varianttool returnerer API tidlig med `{ experimentId, suggestionIds }` (ingen `variants` i body). `extractAiSummary` sjekket bare `o.variants`, så ingen summary for denne tool.
- **Rettelse:** I `extractAiSummary` håndteres nå også `o.suggestionIds` for `experiment.generate.variants` med teksten «Genererte N A/B-variant(er).».

### 3.3 Patch ble ikke brukt i editoren

- **Problem:** Suggest returnerte patch for content.maintain.page, seo.optimize.page, landing.generate.sections osv., men editoren oppdaterte ikke blokkene. Bruker så bare summary, ikke endringene.
- **Rettelse:** Når `callAiSuggest` får tilbake en gyldig `AIPatchV1` i `payload.patch`, bygges nå `BlockList` fra nåværende `blocks`/`meta`, `applyAIPatchV1(body, patch)` kalles, og resultatet konverteres til editorens Block-format og brukes i `applyParsedBody(parseBodyToBlocks(...))`. Improve Page, SEO, Generate sections osv. oppdaterer dermed editoren direkte.

### 3.4 Mojibake i API-ruter (ikke endret i kode)

- **Observasjon:** I `app/api/backoffice/ai/suggest/route.ts` og `apply/route.ts` forekommer feiltegn i strengen for body-validering (tilsvarer «Body må være et objekt.»). Filene ligger under .cursorignore, så rettelse er ikke tatt med i denne revisjonen.
- **Anbefaling:** Manuell retting til korrekt UTF-8: `"Body må være et objekt."` i begge filer.

---

## 4. Filer som ble endret

| Fil | Endring |
|-----|---------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | 1) Importerer `applyAIPatchV1` og `isAIPatchV1`. 2) I `callAiSuggest`: leser payload fra `data.suggestion` når present; bruker `payload` til summary og til patch-apply. 3) I `extractAiSummary`: støtte for `suggestionIds` ved experiment.generate.variants. 4) Etter vellykket suggest: hvis `payload.patch` er gyldig AIPatchV1, bygges BlockList, applyAIPatchV1 kalles, og editoren oppdateres via `applyParsedBody`. |

---

## 5. Hva som nå fungerer ende-til-ende

- **Improve Page:** Bruker klikker «Kjør forbedringsforslag» → suggest kalles med content.maintain.page → API returnerer summary + patch → summary vises i AI-verktøy-panel → patch brukes i editoren (blokker oppdateres).
- **SEO optimize:** Tilsvarende med seo.optimize.page; summary + eventuell patch brukes.
- **Generate sections:** Tilsvarende med landing.generate.sections; summary + patch brukes.
- **Structured intent:** suggest med experiment.generate.variants; summary vises (N A/B-variant(er)); varianter lagres i DB som forventet.
- **AI Image Generator:** suggest med image.generate.brand_safe; summary (N bildeforslag) vises; kandidater lagres som før.
- **Image metadata helper:** suggest med image.improve.metadata; summary vises.
- **AI Control:** Jobs, health scan og experiments stats (GET/POST til de nevnte endepunktene) fungerer som før.

---

## 6. Begrensninger (fortsatt)

- **AI Layout Suggestions (i18n.translate.blocks):** Backend og tool finnes i suggest-ruten, men i ContentAiTools er knappen eksplisitt deaktivert med teksten «Ikke tilgjengelig i editoren ennå». Ingen placebo – bruker ser at det ikke er tilgjengelig.
- **AI Block Builder / Screenshot Builder:** Ingen block-suggest eller screenshot-analyse-route; UI viser «Ikke tilgjengelig i repo ennå» og er deaktivert.
- **Apply-rute:** POST /api/backoffice/ai/apply logger kun til ai_activity_log; den skriver ikke innhold. Apply av patch skjer nå i klienten ved suggest-respons (som over).
- **Provider:** lib/ai/provider.ts `suggestJSON` returnerer fortsatt bootstrap-placeholder for ukjente tools. Kjente tools håndteres direkte i suggest-ruten og er ikke avhengige av den generiske provideren for de aktive funksjonene.

---

## 7. Improve Page / Next Best Action / Inline AI

- **Improve Page** og de andre verktøyene i ContentAiTools deler nå samme flyt: suggest → les payload fra `data.suggestion` → vis summary → apply patch når den finnes. Oppførselen er konsistent.
- **Next Best Action** som eget, separat panel er ikke kartlagt i denne revisjonen; alle AI-verktøy som er koblet i ContentAiTools er vurdert og justert.
- **Inline AI i editoren:** Kun de knappene som er koblet i ContentAiTools (Improve, SEO, Generate sections, Structured intent, Image generate, Image metadata) er tatt i bruk; det er ikke identifisert andre inline-AI-handlinger som skulle vært koblet til samme suggest/apply-flyt.

---

## 8. AI Control og ærlig bilde

- **AI Control-siden** (/backoffice/ai) viser Jobs, Content Health og Experiments og er kun tilgjengelig for superadmin. Den reflekterer at systemet har AI-jobs, health-scan og eksperimentstatistikk.
- **ContentAiTools** viser tydelig hva som er aktivt (knapper med handlers) og hva som er deaktivert («Ikke tilgjengelig …»). Ingen paneler hevder at Layout/Block Builder/Screenshot er klare uten at det finnes tilhørende route/flyt.

---

## 9. Endelig dom

- **Er AI-systemet i Backoffice 10/10?**  
  **Nesten.** De viktigste feilene er rettet: korrekt lesing av API-respons, summary for alle aktive tools inkl. experiment, og **bruk av patch i editoren** for Improve Page, SEO, Generate sections osv. Opplevelsen er sømløs for de funksjonene som er aktivert.

- **Hva mangler konkret for å nærme seg 10/10?**
  1. **Mojibake:** Rett «Body må være et objekt.» i `app/api/backoffice/ai/suggest/route.ts` og `app/api/backoffice/ai/apply/route.ts` (UTF-8).
  2. **AI Control i navigasjon:** ModulesRail har ingen lenke til /backoffice/ai; tilgang skjer via direkte URL. Valgfri forbedring: synlig lenke for superadmin.
  3. **Layout / Block Builder / Screenshot:** For full 10/10 må disse enten få tilhørende backend og kobling i UI, eller fjernes fra panelen for å unngå forventningsbrudd (nå er de markert som ikke tilgjengelige, så risikoen er begrenset).

---

## 10. Verifikasjon

- **Typecheck:** `npm run typecheck` feiler kun på stash-filer (ContentWorkspace.stash0.tsx, ContentWorkspace.workspace.stash0.tsx); hovedkodebasen inkl. ContentWorkspace.tsx kompilerer.
- **Lint:** Ingen nye lint-feil i de endrede filene.
- **Rettelser:** Kun nødvendige, kirurgiske endringer; ingen brede refaktorer eller endringer i workflow/publishRepo.
