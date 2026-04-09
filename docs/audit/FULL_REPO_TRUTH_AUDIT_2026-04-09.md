# Full repo truth audit — 2026-04-09

**Audit type:** Read-only measurement of repository state on disk + commanded gates.  
**Environment:** Windows / PowerShell, workspace `c:\prosjekter\lunchportalen`.  
**Constraint:** No product code changes as part of this audit.  
**HEAD:** `9c06d1cb3642ca52bd6520142811599299eacdd1`

---

## 1. Executive summary (max 20 lines)

- Git-tilstand er **ikke** en revisjonerbar baseline: **172** sporede endringer, **638** `??`-linjer i `git status --porcelain`, og **`git ls-files --others --exclude-standard` rapporterer 3169** ursporede filstier (kollapset mappevisning i status vs. full fil-liste).
- **Staged endringer:** ingen (`git diff --cached --name-only` tom).
- **`npm run typecheck`:** PASS (exit 0) på denne arbeidskopien.
- **`npm run lint`:** PASS (exit 0) med **mange advarsler** (hooks/img-element m.m.) — ikke «rent», bare ikke blokkerende under `next lint`.
- **`npm run test:run`:** PASS (exit 0): **359** testfiler kjørt, **4** hoppet over; **1599** tester PASS, **13** skipped; varsel om `act(...)` i flere auth/backoffice-tester.
- **`npm run build:enterprise`:** PASS (exit 0) inkl. `agents:check`, `ci:platform-guards`, `audit:api`, `audit:repo`, kontrollskript, `next build`, SEO-skript — **bevis for at denne arbeidskopien bygger her**, ikke for ren git-historikk eller produksjons-runtime.
- **`npm run sanity:live`:** **FAIL** (exit 1) — forsøk mot `http://localhost:3000` uten kjørende app / uten relevante URL-env; **ikke** motbevis mot deploy, men **motbevis for «grønn sanity uten kontekst»**.
- README i rot er **ikke** produktdokumentasjon (nærmest tom / støy); sannhet ligger i kode + scripts + `docs/audit/*` med **kjent volum ≠ korrekthet**.
- **Parallelle spor:** `archive/` + store `artifacts/**` + omfattende CMS/backoffice-kode — funksjonelt testet i bredde, men **én sammenhengende «CMS-sannhet» er ikke bevist utenfor test-/bygge-miljøet du faktisk kjørte**.
- **Konklusjon i én setning:** Repoet er **dypt funksjonelt validert på denne maskinen**, men **baseline, proof-kjede og revisjonssikkerhet er i praksis brutt** av arbeidskopi-rot og miljøavhengige runtime-sjekker.

---

## 2. Full repo audit-matrise

| Område | Status | Evidensgrad | Kort begrunnelse | Viktigste støtte |
|--------|--------|-------------|------------------|------------------|
| Git / baseline / sannhet | **MOTBEVIST / IKKE HOLDER** (som *én* auditérbar sannhet) | **E0** for ren baseline; **E1** for «det som ligger på disk nå» | Én commit-HEAD finnes, men arbeidskopi + tusenvis av ursporede filer gjør at «hva som er produktet» ikke er entydig uten eierbeslutning | `git status --porcelain` total 810; tracked 172; `??` 638; `git ls-files --others` 3169; `git diff --stat` 172 files, +4297/−3411 |
| Produktkode / arkitektur | **DELVIS FERDIG** | **E1** (+ **E2** der tester treffer) | Stor, sammenkoblet Next App Router-struktur; samtidig slettinger/erstattere og `archive/` gir overlapp og risiko for «hvilket tre er sant» | `app/` ~1194 filer, `lib/` ~2126, `components/` ~287; `middleware.ts` beskytter mange prefiks; `archive/` dupliserer eldre spor |
| API / backend | **FERDIG I KODE / TEST, MEN IKKE BEVIST I RUNTIME** (samlet) | **E2** (Vitest + statiske CI-scripts i build) | `build:enterprise` kjørte `api:contract` (574 `route.ts`), `audit:api` OK, `status-code-guard` OK — men **ikke** full ekstern integrasjonstest i denne økten | Build-logg: API AUDIT OK; api-contract-enforcer OK |
| CMS / backoffice | **DELVIS FERDIG** | **E1–E2** | Omfattende `ContentWorkspace`-komponenter og CMS-tester; ESLint-advarsler konsentrert her; **ingen** fersk manuell browser-proof i denne auditen | `app/(backoffice)/backoffice/content/_components/*`; `tests/cms/*`; lint-warnings i flere workspace-filer |
| Public rendering | **DELVIS FERDIG** | **E2** (`next build` route-liste) + **E1** | `next build` lister stor ruteflate (statisk/dynamisk); **ingen** systematisk visuell/browser-verifikasjon i denne auditen | Build-output: mange `○`/`ƒ`-ruter inkl. `/week`, `/`, CMS-relaterte paths |
| Data / schema / studio | **FOR UKLAR TIL Å GODKJENNES** (som helhet) | **E1** (filer) / **E0** (live DB) | `supabase/` ~164 filer; `studio/` ~49 sporfiler ekskl. `node_modules` (stor undermappe ellers); **ingen** migrasjons-/RLS-verifikasjon mot ekte instans i denne auditen | Mapptelling; `sanity:live` feilet p.g.a. manglende runtime |
| Tester | **FERDIG I KODE** for `vitest run`; **IKKE** full produktdekning | **E2** | Høy testtetthet; skipped tester/filer reduserer «full garanti»; noen stderr om test-omgivelse | 1599 passed, 13 skipped; 4 skipped files (bl.a. `superadmin.agreements-lifecycle`) |
| Proof / artifacts | **DELVIS FERDIG** (som *kjede*) | **E1** (filer); **E0–E1** (kobling til ren commit) | `artifacts/` ~319 filer (bl.a. PNG); **kobling til én git-sannhet** er ikke etablert gitt arbeidskopi-rot | Filantall; ingen manifest→commit-kjede verifisert i denne økten |
| Drift / build / toolchain | **FERDIG OG BEVIST** *for denne arbeidskopien på denne maskinen* | **E3** (lokal build-kjede) | `build:enterprise` fullførte inkl. SEO-steg; avhenger av lokale secrets (`vitest` lastet `.env.local` med 36 variabler) | Exit 0; SEO-PROOF / SEO-AUDIT / SEO-CONTENT-LINT OK i logg |
| Docs vs virkelighet | **MOTBEVIST SOM «SINGLE SOURCE OF TRUTH»** | **E0–E1** | Masse `docs/audit/**` og rapporter; rot-README er ikke sannhetsbærer; docs kan være utdatert ift. dirty tree | `docs/` ~1359 filer; `README.md` minimal |

---

## 3. Det som faktisk er ferdig (forsvarlig)

- **Typecheck** på nåværende arbeidskopi: **PASS** (E2/E3 avhengig av tolkning — her: kompilasjonsbevis).
- **Vitest `test:run`:** **PASS** med kjente hopp (E2).
- **`build:enterprise`:** **PASS** inkl. plattformvakter og SEO-skript på denne maskinen (E3 lokal).
- **APIflate statisk disiplin** i byggekjeden: **574** `route.ts` passerte kontraktsjekk i logg (E1/E2 — script-bevis).

---

## 4. Det som er delvis ferdig

- **CMS/backoffice:** stor implementasjon + tester, men tung klientkompleksitet og lint-støy; mangler uavhengig runtime/browser-proof i denne auditen.
- **Public/CMS pipeline:** `cms:check` i logg sier «public homepage CMS pipeline OK» — det er **script-begrenset** bevis, ikke full innholds- og edge-case verifikasjon.
- **Artifacts:** finnes, men ikke knyttet til reproduserbar commit/state i denne målingen.

---

## 5. Det som ikke er ferdig

- **Ren git-baseline** som kan granskes uten å blande inn 3000+ ursporede filer og 172 endrede sporingsfiler.
- **`sanity:live` uten** kjørende app eller eksplisitt base-URL — fikk ikke grønt i denne økten.
- **E2E (Playwright):** ikke kjørt i denne audit-pakken — **ingen** påstand om e2e-status.
- **Live database / RLS / produksjons-Supabase:** ikke verifisert her (Vitest kan bruke harness/mocks — se enkelt test-logg for detaljer).

---

## 6. Det som er motbevist / ikke holder

- **Påstand:** «Repoet har én auditérbar sannhet i git nå.» **Holder ikke:** massiv ursporetflate + stor tracked diff.
- **Påstand:** «Sanity er grønn uten server.» **Motbevist i denne kjøringen:** `sanity:live` feilet mot localhost.
- **Påstand:** «Dokumentasjonsvolum = korrekt systemforståelse.» **Holder ikke:** README er irrelevant; mange audit-filer kan være motstridende eller utdatert ift. dirty tree (ikke alle kryssjekket enkeltvis — **uklart** per fil).

---

## 7. Top 10 gjenværende gap (rangert)

1. **Ingen ren baseline** — revisjon og «hva er levert» er umulig uten eierstyrt commit/stash/ignore policy.
2. **3169 ursporede filstier** — inkluderer sannsynlig assets, duplikater, midlertidig — må klassifiseres (track, ignore, eller slett).
3. **`sanity:live` avhengig av runtime** — må defineres: CI mot deploy-preview, eller dokumentert lokal kjøring; nå: **rødt uten server**.
4. **E2E ikke målt** i denne pakken — hull mellom Vitest og faktisk nettleserflyt for kritiske stier.
5. **Skipped tester** (13 + 4 filer) — eksplisitt hull i «alt grønt»-narrativet.
6. **Lint-advarsler i produksjonskritiske CMS-filer** — teknisk gjeld / risiko for subtile regressions (ikke blokkerende, men **ikke** «enterprise rent»).
7. **Parallelle kode-spor** (`archive/`, generert/duplikat komponenter i status) — øker kognitiv og merge-risiko.
8. **Proof-kjede** — screenshots/artifacts uten garantert kobling til commit SHA + miljø + datasett.
9. **Miljøsannhet** — tester/build brukte `.env.local` (36 keys injisert ifølge Vitest-logg); reproduserbarhet for andre maskiner er **uklart**.
10. **Studio/npm-tre** — full `studio/`-søk uten å ekskludere `node_modules` gir misvisende filtall; faktisk sporingsflate må måles med eksplisitte exclude-regler (her: **49** filer uten `node_modules`).

---

## 8. Rå kommando-audit

| Kommando | Exit | Første relevante linjer | Siste relevante linjer | Beviser / beviser ikke |
|----------|------|-------------------------|-------------------------|-------------------------|
| `git rev-parse HEAD` | **0** | `9c06d1cb3642ca52bd6520142811599299eacdd1` | (samme) | Beviser **navngitt commit** som basis; **beviser ikke** ren arbeidskopi |
| `git status --short` | **0** | `M .env.example` … mange `M`/`D` | (lang liste) | Beviser **stor tracked diff + mange endringer** |
| `git diff --name-only` | **0** | (172 filer — samme sett som stat) | `workers/worker.ts` | Liste over endrede sporingsfiler |
| `git diff --stat` | **0** | `.env.example \| 41 +` … | `172 files changed, 4297 insertions(+), 3411 deletions(-)` | Omfang på tracked diff |
| `git diff --cached --name-only` | **0** | *(tom utdata)* | *(tom)* | **Ingen staged endringer** |
| `git ls-files --others --exclude-standard` | **0** | (3169 linjer med filstier) | (siste path i liste) | **Omfang ursporet**; **beviser ikke** at alt er «produkt» |
| `npm run typecheck` | **0** | `tsc --noEmit` | (ingen TS-feil i output) | Type-soundness **for denne kopien** |
| `npm run lint` | **0** | ``next lint` is deprecated…` | `info - Need to disable some ESLint rules?` | **Lint ikke blokkerende**; **mange warnings** → ikke «rent» |
| `npm run test:run` | **0** | `RUN v2.1.9` … første `✓` | `Test Files 359 passed \| 4 skipped` / `Tests 1599 passed \| 13 skipped` / `Duration 80.07s` | **Vitest-grønt**; **beviser ikke** prod-runtime eller all funksjonalitet |
| `npm run build:enterprise` | **0** | `AGENTS CI GATE PASSED` … `api-contract-enforcer: 574 route.ts` | `SEO-PROOF OK` … `SEO-CONTENT-LINT OK` | **Full enterprise build-kjede OK lokalt**; **beviser ikke** deploy eller data-lag |
| `npm run sanity:live` | **1** | `[sanity:live] base = http://localhost:3000` | `sanity_live_error` / `fetch failed` | **Runtime health ikke oppnådd** i dette miljøet |

**Merk:** `find` ble **ikke** brukt (Windows). Filantall: `Get-ChildItem -Recurse -File` per rotmappe, med egen kjøring for `studio` ekskl. `node_modules`.

---

## 9. Proof / baseline / audit-sannhet

- **Proof-kjede:** **Holder ikke** som revisjonskjede — artifacts finnes (E1), men **HEAD + arbeidskopi** matcher ikke ideen om «låst bevispakke».
- **Baseline:** **Holder ikke** — staged tom, men tracked+untracked rot er massivt.
- **Docs som sannhet:** **Holder ikke generelt** — høy dokumentasjonsentropi; rot-README er ikke autoritativ; enkeltfiler i `docs/audit/**` er **ikke** alle verifisert mot dagens dirty tree i denne økten (**uklart** per dokument).

---

## 10. Neste 5 arbeidspakker (mot ekte ferdigstillelse / bevis / drift)

1. **Baseline-gjenoppretting:** beslutning og gjennomføring: hva som skal inn i git, hva som skal i `.gitignore`, hva som skal slettes; mål: **≤0 ursporet «støy»** eller begrunnede unntak dokumentert.
2. **Definert `sanity:live`-kontrakt:** kjør mot faktisk URL (preview/prod) i CI eller dokumentert lokal prosess — **ikke** tolke FAIL uten server som «OK».
3. **E2E-minimum for RC-kritiske stier:** eksplisitt liste + grønn kjøring i CI (eller erkjent gap).
4. **CMS/backoffice lint-gjeld:** reduser warnings i `useContentWorkspaceShellModel` og relaterte filer — **lokal, sporbar** forbedring (krever egen changeset; ikke del av denne auditen).
5. **Proof manifest:** én fil som binder **commit SHA + miljø + datasett + kommando + artifact paths** — ellers forblir screenshots «pynt».

---

## 11. Endelig dom (én)

**NÆR FUNKSJONELT, MEN IKKE REVISJONSSIKKERT**

---

## 12. Sluttliste — «mangler før jeg personlig ville kalt repoet 100 %»

- Ren `main`/release-commit uten tusenvis av ursporede filer og uten stor ureviewet diff.
- Grønn `sanity:live` mot **avtalt** ikke-lokal-illusorisk mål (deploy/preview), eller erstatning som er like streng.
- E2E-grønt for avtalte kritiske flyter + kjente unntak dokumentert.
- Ingen «skipped» tester på kritiske compliance/tenant/API-kontrakter uten skriftlig risikoaksept.
- Lint uten systematisk støy i største klient-CMS-kjerne — eller eksplisitt policy for hva som tolereres.
- Én autoritativ arkitektur-/baseline-doc som matcher **faktisk** sporingsinnhold, ikke `archive/` og ikke random prompts.
- Data/RLS verifisert mot mål-miljø (ikke bare filer og enhets-/integrasjonstester).
- Proof-pakke med SHA-kobling og repro-kommandoer.

---

*Audit generert som del av intern sannhetsmåling; ingen produktkode endret i denne leveransen.*
