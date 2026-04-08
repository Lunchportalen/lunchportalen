# U104 — Bindende eierbeslutninger (uke-rute + staged kjerne)

**Status:** Fasit for neste tekniske pakke. Ingen myk tekst.  
**Git HEAD:** `a809362e296b80459c1adc2ae5932aeb1cb9b82f` (ved kjøring av U104-kommandoer).  
**Lås:** Ingen teknisk split, commit eller produktendring i U104 — kun dokumentasjon.

---

## A. Fakta — uke-rute-konflikt (målt)

| Observasjon | Kilde |
|-------------|--------|
| `app/(portal)/week/WeekClient.tsx` og `page.tsx` er **fortsatt tracked** i `git ls-files` | `git ls-files "app/(portal)/week" "app/(app)/week"` |
| Samme to filer er **slettet i working tree**, sletting er **ikke staged** (` D`) | `git status --short -- "app/(portal)/week" "app/(app)/week"` |
| `app/(app)/week/**` finnes på disk og er **u-tracket** (`??`) | `git status --short` |
| `git diff --name-only` mot oppgitte uke-paths viser bl.a. endringer i `app/api/week`, `app/api/weekplan/**`, `app/api/orders/week`, `components/week`, `lib/week`, `lib/sanity/weekplan.ts`, `studio/schemas/weekPlan.ts` m.m. — **portal-week-filene inngår i diff-listen** | `git diff --name-only -- …` |

**Nærliggende paths (eksisterer i tre / relevante for samme flate):**

- `components/week/WeekMenuReadOnly.tsx`
- `lib/week/*` (f.eks. `employeeWeekMenuDays.ts`, `availability.ts`)
- `app/api/week/route.ts`, `app/api/weekplan/*`, `app/api/orders/week/route.ts`
- `lib/sanity/weekplan.ts`, `lib/sanity/weekPlanOps.ts`
- `studio/schemas/weekPlan.ts`

**Hva dette avhenger av:** URL `/week` (middleware matcher `pathname.startsWith("/week")`), hvilken `app/**/week/page.tsx` som er sann side-entry, sporbarhet i git (tracked vs untracked), og at dokumentasjon/tester som fortsatt refererer til `(portal)/week` ikke er sannhetskilde.

---

## B. Fakta — staged «8 filer» (målt)

**Staged sett (eksakt 8 filer):**

```
app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx
app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts
app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks.ts
app/(backoffice)/backoffice/content/_components/contentWorkspace.outbox.ts
app/(backoffice)/backoffice/content/_components/contentWorkspacePageEditorShellInput.ts
app/(backoffice)/backoffice/content/_components/forsideUtils.ts
docs/audit/full-system/IMPLEMENTATION_LOG.md
docs/audit/full-system/POST_IMPLEMENTATION_REVIEW.md
```

**`git diff --cached --stat` (trekk):** store innsettinger i audit-filer; `ContentWorkspace.tsx` viser massiv omfordeling (tall i stat: +4959 / -8296 linjer netto på settet — se `git diff --cached --stat` for nøyaktige fil-tall).

**Klassifisering:**

| Fil | Type |
|-----|------|
| `ContentWorkspace.tsx` og øvrige `contentWorkspace*` + `forsideUtils.ts` | **Produktkode** (backoffice CMS/content workspace) |
| `IMPLEMENTATION_LOG.md`, `POST_IMPLEMENTATION_REVIEW.md` | **Audit / logg** (dokumentasjon under `docs/audit/full-system/`) |

**Ærlig vurdering av samme commit:** Ingen teknisk nødvendighet å blande runtime/CMS-endringer med full-system audit-logger i én commit; revert-granularitet, review og historikk skilles naturlig ved split.

---

## C. Verifikasjon (kjørte kommandoer)

- `npm run typecheck` — **PASS** (exit 0).
- `npm run test:run` — **PASS** (359 testfiler pass, 4 skipped; 1599 tester pass, 13 skipped — se kjørelogg).

*Beviser:* at arbeidskopien **i denne kjøringen** typechecket og testene var grønne. Beviser **ikke** at uke-rute eller indeks er konsolidert eller klar for merge.

---

## D. Bindende beslutninger (utfall)

### Beslutning 1 — Kanonisk uke-rute

**Utfall:** **JA: `app/(app)/week/**` er kanonisk struktur.**

**Grunnlag (faktisk, ikke antatt mening):** Working tree har fjernet `(portal)/week`-filer; `(app)/week` ligger som aktiv mappe men er u-tracket; repoets eksisterende kanoniske kart (`docs/audit/CANONICAL_VS_TRANSITIONAL_MAP.md`) angir allerede `(app)/week` som sannhet. Ingen `app/**`-kode fantes med streng `(portal)/week` i søk ved denne kartleggingen.

**Konsekvens:** `app/(portal)/week/**` skal behandles som **gammel struktur** å fjerne fra sporbar sannhet; `app/(app)/week/**` skal inn i git som den kanoniske employee week-entry; tilhørende API/lib/studio-paths følger eksisterende kontrakter (ikke omdisponert i U104).

**Neste pakke får lov til:** Én teknisk pakke som **aligner git med denne sannheten** (f.eks. stage sletting av portal-week, legg til / track `(app)/week`, rydd referanser som fortsatt peker på portal der det finnes).

**Neste pakke får IKKE lov til:** Baseline freeze, proof-pakke, CI/e2e som «erstatter» denne beslutningen, eller refaktor utenfor uke-rute-alignering.

---

### Beslutning 2 — Staged kjerne (8 filer)

**Utfall:** **JA: staged settet skal splittes i produktkode og audit-logg.**

**Konsekvens:** To commits (eller to eksplisitte leveranser): (1) backoffice/CMS-filene, (2) `docs/audit/full-system/IMPLEMENTATION_LOG.md` og `POST_IMPLEMENTATION_REVIEW.md`.

**Neste pakke får lov til:** Omorganisere staging/indeks slik at audit-dokumenter og produktkode kan committes hver for seg; minimal diff per commit.

**Neste pakke får IKKE lov til:** Å blande audit-logger med feature narrative i én commit når målet er sporbar historikk; å utvide scope til annen refaktor.

---

## E. Én neste pakke (minste som følger av U104)

| Felt | Verdi |
|------|--------|
| **Navn** | **Split staged kjerne i to commits (CMS vs audit-logg)** |
| **Hvorfor** | Beslutning 2 er eksplisitt JA til split; indeksen inneholder allerede begge typer — dette er den minste operative lukkingen uten produktendring. |
| **Hva den lukker** | Blandet staging av produktkode og full-system audit-dokumentasjon. |

*Merk:* Uke-rute-alignering er egen pakke etterpå hvis eier ønsker streng sekvens «split først, deretter week-git»; U104 åpner begge, men **én** neste pakke er valgt som over.

---

## F. Sluttdom (én setning)

Per nå er de første bindende eiervalgene tatt på papir, og derfor er neste ærlige steg **å splitte den stagede indeksen i to commits (CMS-produktkode for seg, full-system audit-logg for seg)**.
