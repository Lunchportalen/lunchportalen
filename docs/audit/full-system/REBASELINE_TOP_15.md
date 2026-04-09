# Rebaseline — topp 15 gjenværende problemer (nå)

**Kriterium:** Faktisk gjenstående mars 2026, ikke historikk. Alvorlighetsgrad: **Critical / High / Medium / Low**.

**OBS:** Hvis `git status` viser tusenvis av ucommittede filer, behandle punkter om «flate» som **må re-verifiseres på ren branch** — tallene under er fra denne kjøringen (disk + git).

---

1. **ContentWorkspace-monolitt (~6401 linjer)** — **Critical**  
   — *Evidence:* linjetelling; `ContentWorkspace.tsx` dominerer ESLint `exhaustive-deps` i build.  
   — *Konsekvens:* Umulig trygg PR-review, regressjonsrisiko, vanskelig redaksjonell iterasjon.

2. **Arbeidskopi vs git: 557 vs 314 API-ruter** — **High** (prosess)  
   — *Evidence:* `REBASELINE_COMMANDS_AND_RESULTS.md`, sammenligning disk vs `git ls-files`.  
   — *Konsekvens:* Audit/CI kan måle **annet** enn det som merges; **må** ryddes før release.

3. **Arbeidskopi vs git: 698 vs 295 filer i `lib/ai`** — **High** (prosess)  
   — *Evidence:* samme som over.  
   — *Konsekvens:* Uklart hva som er «produkt» vs lokalt eksperiment.

4. **`global_content` RLS: bred `authenticated`-policy** — **High** (sikkerhet, betinget)  
   — *Evidence:* `RISK_REGISTER.md` R7; migrering ikke endret i denne revisjonen.  
   — *Konsekvens:* Kritisk **hvis** klienter skriver direkte til Supabase — **ikke** full runtime-bevis i denne rebaseline.

5. **Build avhenger av hevet heap** — **High** (operasjonell)  
   — *Evidence:* `build:enterprise` OK med 8GB; standard heap **ikke** testet.  
   — *Konsekvens:* Ustabile lokale bygg / CI-varianter.

6. **557 HTTP-ruter — angrepsflate og inkonsistens** — **High** (arkitektur)  
   — *Evidence:* `api-contract-enforcer` på disk; `audit:api` OK.  
   — *Konsekvens:* Selv med kontraktsgate er **menneskelig** feilrate høy ved mange endepunkter.

7. **79 testfiler med `@ts-nocheck`** — **Medium**  
   — *Evidence:* `grep @ts-nocheck` under `tests/**/*.ts`.  
   — *Konsekvens:* Falsk trygghet; regresjoner kan skjules.

8. **ESLint warnings som «grønn gate»** — **Medium**  
   — *Evidence:* `next lint` exit 0 med mange `exhaustive-deps` og `no-img-element`.  
   — *Konsekvens:* Subtile React-feil og LCP-problemer i produksjon.

9. **`as unknown as` ved JSONB/grenser** — **Medium**  
   — *Evidence:* grep i `lib/ai`, `lib/revenue`, `componentRegistry`, m.fl.  
   — *Konsekvens:* Runtime-feil under dataendringer.

10. **To Sanity Studio-stier (én deprecated)** — **Medium**  
    — *Evidence:* `studio/lunchportalen-studio/DEPRECATED.md`.  
    — *Konsekvens:* Onboarding-feil, feil deploy.

11. **E2E ikke kjørt i rebaseline** — **Medium**  
    — *Evidence:* ingen `npm run e2e` i denne runden.  
    — *Konsekvens:* Ukritisk brukerreise (editor, checkout, uke) — huller.

12. **`sanity:live` soft-gate uten kjørende app** — **Low** (forventet)  
    — *Evidence:* WARNING unreachable localhost.  
    — *Konsekvens:* Kan ikke brukes som hard gate lokalt uten `dev` — dokumentasjonsrisiko.

13. **`next lint` deprecation** — **Low** (fremtid)  
    — *Evidence:* lint-output.  
    — *Konsekvens:* Brudd ved Next 16 uten migrasjon.

14. **JSONB som sannhet uten streng schema overalt** — **Medium**  
    — *Evidence:* `POST_IMPLEMENTATION_REVIEW` nevner `withDefaults`/`unknown`; RISK_REGISTER R6.  
    — *Konsekvens:* Data-drift i CMS.

15. **Parallell «AI-plattform» vs kjerne-CMS (kognitiv og bundler-last)** — **Medium**  
    — *Evidence:* `lib/ai` stor (git 295+); AI-governance passerer delsett.  
    — *Konsekvens:* Vedlikeholdskost, vanskelig å holde domenegrenser i PR.

---

**Merk:** Punkt 2–3 er **prosess/kopi**-avvik. Hvis din branch er ren og `git` = disk, faller disse **kraftig** i alvor — **re-kjør tall etter `git status` er ryddig**.
