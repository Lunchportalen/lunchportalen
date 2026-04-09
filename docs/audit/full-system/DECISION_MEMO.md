# Decision Memo — plattformretning (post-audit)

**Kontekst:** `WHOLE_REPO_AUDIT_REPORT.md`, `EVIDENCE_PACK.md`, `TOP_10_PATCH_PLAN.md`, `SOURCE_OF_TRUTH_MATRIX.md`.  
**Formål:** Én beslutning — ikke nye funn.

---

## Kategorisering av topp 15-funn

### 1. `agents:check` — `overflow-hidden` etter falsk «menu»-klassifisering (`select` i `select-none`)

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **1 — Tooling/test noise** |
| **Hvorfor** | Feilen er **ikke** at produktet må endre UI-prinsipp; `scripts/agents-ci.mjs` klassifiserer filer som meny-relaterte fordi regex treffer **`select-none`**, og gate feiler deretter på `overflow-hidden` i **ikke-meny**-kontekst (progress bar, rammer). |
| **Symptom vs årsak** | **Symptom:** rød `build:enterprise`. **Root cause:** **CI-regel** (regex), ikke produktfeil. |
| **Påvirkning** | Redaktør: ingen. Utvikler: tid/tvang. Drift/release: **blokkerer leveranse**. Tillit: **undergraver tillit til CI** («rødt uten produktmessig forklaring»). |
| **Når løses** | **Nå** — juster `MENU_FILE_HINT_RE` (f.eks. `\bSelect\b`) eller tilsvarende presisering (`EVIDENCE_PACK` #1, `TOP_10` #1). |

---

### 2. API contract gate — `route.ts` uten tekstlige `ok: true` / `ok: false` når kun `jsonOk` brukes

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **1 — Tooling/test noise** |
| **Hvorfor** | Runtime-svar fra `jsonOk` i `lib/http/respond.ts` **er** kontraktsmessige; gate er en **statisk tekstskanner** som ikke forstår helpers (`EVIDENCE_PACK` #2). |
| **Symptom vs årsak** | **Symptom:** rød `agents:check`. **Root cause:** **CI-heuristikk**, ikke feil API-semantikk i control-tower. |
| **Påvirkning** | Redaktør: ingen. Utvikler: blokkerende falsk signal. Drift/release: **blokkerer**. Tillit: **CI vs runtime mismatch**. |
| **Når løses** | **Nå** — oppdatere gate eller innføre eksplisitt godkjent mønster (`TOP_10` #2). |

---

### 3. `npm run test:run` — åtte feilede tester (samlet)

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **1 — Tooling/test noise** (meta) |
| **Hvorfor** | Tallet **8** er et **aggregat**; det forklarer ikke alene **produktkvalitet**, men **at pipeline lyver** til teamet. Underliggende er #4, #7, #8 (+ ev. overlapp). |
| **Symptom vs årsak** | **Symptom:** rød CI. **Root cause:** **testsuite + gates**, ikke nødvendigvis feil kjernelogikk i ordre/auth/render. |
| **Påvirkning** | Drift/release: **høy** (merge-risiko). Tillit: **kritisk** («grønt betyr ingenting»). Redaktør: indirekte. |
| **Når løses** | **Nå** — ved å løse de konkrete underpunktene, ikke ved å «skrive flere tester» generelt. |

---

### 4. Ordre-API-tester — 503 fordi mock mangler `.limit()` etter `.select()` i `getSystemSettingsSafe`

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **1 — Tooling/test noise** |
| **Hvorfor** | Produksjonskoden `lib/system/settings.ts:91` bruker gyldig Supabase-kjede; **testen** representerer ikke klienten (`EVIDENCE_PACK` #4). |
| **Symptom vs årsak** | **Symptom:** forventet 200/409, fikk 503. **Root cause:** **test-mock**, ikke bevist feil i ordreflyt i prod. |
| **Påvirkning** | Tillit til tester: **høy negativ**. Utvikler: vedlikeholdssmerte. Redaktør: lav. Drift: indirekte (hvis team ignorerer rødt). |
| **Når løses** | **Nå** — utvid mock-kjede (`TOP_10` #3). |

---

### 5. `ContentWorkspace.tsx` — ~9933 linjer én komponent

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **3 — Structural platform defect** (primært) / **4 — Migration-level** (hvordan fikse det) |
| **Hvorfor** | Dette er **hvorfor** redaksjonell utvikling føles tung og uforutsigbar: **all** CMS-UI-tilstand og -atferd konsentrert **uten** modulgrense som tåler Umbraco-lignende modenhet (`SOURCE_OF_TRUTH_MATRIX` + audit). |
| **Symptom vs årsak** | **Symptom:** stor fil, lint-hooks-advarsler. **Root cause:** **strukturell** — manglende oppdeling av domene vs presentasjon i editor-laget. |
| **Påvirkning** | Redaktør: **høy** (risiko for regresjon, treg evolusjon). Utvikler: **høy**. Tillit: **høy** («profesjonell plattform» føles ikke slik). Drift: middel. |
| **Når løses** | **Ikke** med kosmetisk patch. **Senere som kontrollert re-arkitektur**; første utbrytning etter grønn gate (`TOP_10` #10). **Full løsning = re-arkitektur**, ikke lapp. |

---

### 6. `LoosePublicTable` / `any` i `lib/types/database.ts`

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **3 — Structural platform defect** + **4 — Migration-level** (rettemedel) |
| **Hvorfor** | TypeScript **garantier ikke** kolonner på mange tabeller; **én sannhet** for data finnes i DB, men **ikke** i compile-time modell (`EVIDENCE_PACK` #6). |
| **Symptom vs årsak** | **Symptom:** `any` spredt via `Database`-typen. **Root cause:** **manglende codegen-pipeline** / bevisst midlertidig løsning som har blitt struktur. |
| **Påvirkning** | Utvikler: **høy** (skjulte feil). Tillit: **høy** (datafeil i prod mulig uten compile-varsel). Redaktør: indirekte. Drift: feilsøking vanskeligere. |
| **Når løses** | **Delvis nå** (stramme kritiske tabeller). **Full løsning** som **migrasjon** mot genererte typer / trinnvis stramming — ikke «én PR». |

---

### 7. `postLoginRedirectSafety` — superadmin forventer `/week` for `next=/week`

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **1 — Tooling/test noise** |
| **Hvorfor** | Implementasjon `lib/auth/role.ts` er **konsistent** med E5; testen er **feil** (`EVIDENCE_PACK` #7). |
| **Symptom vs årsak** | **Symptom:** rød test. **Root cause:** **feil forventning i test**, ikke auth-bug. |
| **Påvirkning** | Tillit: forvirring i team hvis man antar test = sannhet. Drift: lav. Redaktør: ingen. |
| **Når løses** | **Nå** — rett test (`TOP_10` #4). |

---

### 8. `motionSystemProof` — `className` på `renderBlock`-resultat for form-blokk

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **1 — Tooling/test noise** |
| **Hvorfor** | `renderBlock` returnerer `EnterpriseLockedBlockBridge`; test antar feil DOM-form (`EVIDENCE_PACK` #8). Parity kan fortsatt være **reell bekymring**, men **denne testen** beviser den ikke. |
| **Symptom vs årsak** | **Symptom:** assertion-feil. **Root cause:** **testdesign**, ikke bevist render-bug. |
| **Påvirkning** | Tillit til «parity-bevis»: **negativ** inntil fikset. Redaktør: lav. |
| **Når løses** | **Nå** — align med HTML-assert som andre tester i samme fil (`TOP_10` #5). |

---

### 9. To `sanity.config.ts` (env-basert vs hardkodet `projectId`)

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **4 — Migration-level** (med drag i **3 — Structural**) |
| **Hvorfor** | To studio-innganger skaper **to sannheter** for «hvor Sanity lever» og øker risiko for feil dataset/prosjekt (`EVIDENCE_PACK` #9). |
| **Symptom vs årsak** | **Symptom:** duplikat mapper. **Root cause:** **organisatorisk/ historisk** oppsplitting uten konsolidering. |
| **Påvirkning** | Drift/release: **medium** (feil konfig i deploy). Tillit: **medium**. Redaktør: forvirring om «riktig» studio. Utvikler: vedlikehold. |
| **Når løses** | **Senere** som eget spor — **etter** gate er grønn; ikke blokkerende for patch-stabilisering hvis ingen aktivt bruker begge feil. |

---

### 10. `archive/` lokalt — ikke i git

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **2 — Localized implementation defects** (prosess/rot) |
| **Hvorfor** | Påvirker **ikke** kjørende produkt direkte, men skaper **lokal forvirring** og risiko for at feil filer kopieres. |
| **Symptom vs årsak** | **Symptom:** duplikatkode synlig på disk. **Root cause:** **prosess** (ikke sporet / ikke ryddet). |
| **Påvirkning** | Utvikler: **lav–middel**. Resten: minimal. |
| **Når løses** | **Senere** — rydd eller spor (`TOP_10` #7). |

---

### 11. `sanity:live` — soft pass ved utilgjengelig base-URL

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **1 — Tooling/test noise** (observability-/gate-støy) |
| **Hvorfor** | Exit 0 uten faktisk helsebevis gir **falsk trygghet** (`EVIDENCE_PACK` #11). |
| **Symptom vs årsak** | **Symptom:** «grønt» script. **Root cause:** **designvalg** (soft gate), ikke nødvendigvis feil i app. |
| **Påvirkning** | Drift/tillit: **medium** («vi kjørte sanity:live» betyr lite). Redaktør: ingen. |
| **Når løses** | **Senere** — hard krav i CI med `SANITY_LIVE_URL` eller eksplitt fail i `CI=true` (`TOP_10` #8). |

---

### 12. `console.error` i `getSystemSettingsSafe` (`lib/system/settings.ts`)

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **2 — Localized implementation defects** |
| **Hvorfor** | Reell **inkonsistens** mot strukturert logging; forsterker støy i tester og drift — men **avgrenset** til én modul (`EVIDENCE_PACK` #12). |
| **Symptom vs årsak** | **Symptom:** `[SETTINGS_FATAL]` i logs. **Root cause:** direkte `console.error` i stedet for felles logger. |
| **Påvirkning** | Drift/observability: **middel**. Tillit: lav–middel. |
| **Når løses** | **Senere** (4–8 uker ok) eller **nå** hvis dere standardiserer logging i samme «stabiliserings»-sprint (`TOP_10` #9). |

---

### 13. `supa: any` i `src/lib/guards/assertCompanyActiveApi.ts`

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **2 — Localized implementation defects** |
| **Hvorfor** | **Én fil**, begrenset flate; svekker typesikkerhet men forklarer ikke alene plattformsvikten. |
| **Symptom vs årsak** | **Symptom:** `any`. **Root cause:** pragmatisk wrapper uten sterk typing. |
| **Påvirkning** | Utvikler: lav–middel. Sikkerhet: lav (guard finnes). |
| **Når løses** | **Senere** — stram til `SupabaseClient<Database>` når dere uansett toucher filen. |

---

### 14. Parallell `src/lib` og `lib/`

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **3 — Structural platform defect** (lav alvorlighetsgrad, men **strukturell**) |
| **Hvorfor** | To «lib»-røtter bryter **mental modell** om hvor kode lever (`EVIDENCE_PACK` #14); få filer (`git` viste 4), men **prinsippet** er dårlig for skala. |
| **Symptom vs årsak** | **Symptom:** import-forvirring. **Root cause:** delvis migrering / historikk. |
| **Påvirkning** | Utvikler: **middel** over tid. Tillit: lav. |
| **Når løses** | **Senere** eller **som del av re-arkitektur** — flytt til `lib/` eller dokumenter én gang (`TOP_10` rekkefølge 6–10). |

---

### 15. 314 `app/api/**/route.ts` — flat HTTP-flate

| Felt | Vurdering |
|------|-----------|
| **Kategori** | **3 — Structural platform defect** + **4 — Migration-level** (langsiktig inndeling) |
| **Hvorfor** | Ingen enkelt team kan holde **konsistent** auth/validering/kontrakt over **314** endepunkter uten **maskinell disiplin** og modulgrenser; det forklarer **hvorfor** svakheter dukker opp «tilfeldig» i nye flater (control-tower). |
| **Symptom vs årsak** | **Symptom:** nye ruter bryter gate / kontrakt. **Root cause:** **flate arkitektur** + menneskelig skaleringsgrense. |
| **Påvirkning** | Sikkerhet: **høy** (flate). Drift: **høy**. Utvikler: **høy**. Tillit: **høy**. Redaktør: lav direkte. |
| **Når løses** | **Full løsning** er **langsiktig re-arkitektur** (domene-pakker, genererte klienter, sterkere gate). **Nå:** sikre at **CI faktisk matcher intensjon** (#1–2) og at kritiske prefiks **reviewes** — ikke «fiks alle 314». |

---

## 1. Executive decision

**Hovedretning: *selective re-architecture* med obligatorisk forløper *patch and stabilize*.**

**Begrunnelse (én setning):**  
Røde gates og upålitelige tester **må** rettes nå (patch/stabilisere), ellers finnes ingen tillit til leveranser; **Umbraco-modenhet** oppnås ikke uten **selektiv re-arkitektur** av CMS-laget og datamodell-disiplin — **ikke** full core rebuild, fordi kjernen (Supabase, roller, ordre-spor) har reelle styrker som audit allerede peker på.

**Full core rebuild** er **avvist** som hovedvalg: for dyrt og unødvendig ut fra dokumentert tilstand.  
**Partial migration** er **del av** den selektive re-arkitekturen (typer, studio, moduler), ikke et eget «hovedspor» utenom.

---

## 2. What is noise vs what is fatal

**Noise (teamet skal ikke bruke disproporsjonal tid på å «filosofere» om disse som produktfeil):**

- **#1, #2** — CI-regler som gir falske positiver; **fiks regex/gate**, ikke redesign control-tower-UI for å tilfredsstille en buggy scanner.
- **#4, #7, #8** — tester som ikke matcher runtime eller riktig assert-strategi; **fiks tester/mocks**, ikke omskriv `getSystemSettingsSafe` eller `renderBlock` uten produktmessig trigger.
- **#3** — tallet «8 feil» alene; **adresser underliggende**, ikke «flere tester generelt».

**Fatal (det som faktisk forklarer plattformfølelsen og ikke kan ignoreres):**

- **#5** — CMS-monolitten (redaktør- og utvikleropplevelse).
- **#6** og **#15** — typesvikt + uoversiktlig APIflate (tillit og langsiktig kost).
- **#9** (på sikt) — to Sanity-sannheter for operasjonelt innhold.

---

## 3. The five real reasons the platform feels amateur

1. **CI sier sannhet som ikke stemmer** — gates matcher `select-none` som meny og krever `ok:`-tekst i filer der `jsonOk` allerede er korrekt (`#1–2`, `#3–4`). Teamet lærer å ignorere rødt.

2. **Én fil (~9933 linjer) eier redaksjonell UI-logikk** — det er ikke «dårlig React», det er **manglende plattformlag** for editor (`#5`).

3. **Databasen er sannhet, men TypeScript er ofte ikke** — `LoosePublicTable` / `any` (`#6`) gjør at «enterprise» ikke føles enterprise når man koder.

4. **For mange HTTP-endepunkter uten menneskelig oversikt** — `314` routes (`#15`): svakheter dukker opp der ingen kan se helheten.

5. **To spor for innholdsverktøy (Supabase-sider vs Sanity-studio)** uten at teamet alltid vet hvilket spor som gjelder (`#9`, `SOURCE_OF_TRUTH_MATRIX`) — føles som **to produkter**, ikke én plattform.

---

## 4. What can wait (4–8 uker uten å ødelegge veivalget)

- **#10** — rydd `archive/` / spor eller slett lokalt.
- **#11** — stram `sanity:live` i CI (krever stabil URL/strategi).
- **#12–13** — logging og `any` i enkeltfiler.
- **#14** — flytt `src/lib` → `lib/` eller dokumenter.
- **#9** — konsolider Sanity **etter** at patch-sporet er grønt og eier er utpekt.

**Alt over forutsetter** at teamet **ikke** legger tung ny funksjonalitet inn i `ContentWorkspace.tsx` uten utbrytningsplan.

---

## 5. What cannot wait (før ny feature-utvikling)

1. **Grønn `build:enterprise`** — fiks **#1** og **#2** (gate matcher intensjon).
2. **Grønn `npm run test:run`** — fiks **#4**, **#7**, **#8** (minst disse; se `TOP_10_PATCH_PLAN.md`).
3. **Beslutning om CMS-re-arkitektur** — aksept for at **#5** ikke løses med «litt refaktor i pausen»; tidsbokset spor for første modulutbrytning.

Uten punkt 1–2 **er tilliten til all annen kvalitetsarbeid null** — uansett hvor god feature-idéen er.

---

## 6. Final recommendation to leadership

**Beskjed:** Plattformen er **ikke** dårlig overalt — kjernen har bevisst sikkerhets- og domenelogikk — men **leveransemaskineriet lyver**: bygg og tester er røde av **verktøy- og testfeil**, mens den største strukturelle risikoen er **én enorm CMS-fil** og **flat APIflate uten compile-time disiplin**.

**Beslutning:** Godkjenn **to spor i rekkefølge**:  
**(A)** To til fire uker **patch and stabilize** — grønn gate og grønne tester, uten nye store features i editor.  
**(B)** Deretter **selective re-architecture** — først utbrytning av `ContentWorkspace`, parallelt med plan for **genererte DB-typer** og **én Sanity-inngang**.

**Hva vi ikke gjør:** Vi starter ikke «full rebuild» eller «total CMS-migrering» som panikktiltak. Vi **stopper** å behandle CI-feil som produktprioritet når de er **bevist tooling-støy** (#1–2, #4, #7–8).

**Suksesskriterium for ledelse:** Om åtte uker skal `build:enterprise` og `test:run` være **grønne på main**, og det skal finnes et **skriftlig mandat** for første CMS-modulutbrytning — ikke bare ønske.
