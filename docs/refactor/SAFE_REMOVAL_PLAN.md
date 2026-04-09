# Trygg fjernings- og konsolideringsplan

**Dato:** 2026-03-28  
**Prinsipp:** Ingen sletting før: (1) denne planen er godkjent, (2) avhengighetsgraf er verifisert, (3) `typecheck` + `lint` + `build:enterprise` + relevante tester er grønne.

---

## Fase 0 — Kun dokumentasjon og målinger (fullført når rapporter ligger i `docs/refactor/`)

- [x] `BLOCKER_AUDIT.md`  
- [x] `DELETE_ARCHIVE_REFACTOR_MATRIX.md`  
- [x] `WEEK_SOURCE_OF_TRUTH_DECISION.md`  
- [ ] Eierskap: godkjenn `weekPlan`-skjebne og API-sammenslåing.

**Stopp her** inntil Fase 0 er eksplisitt godkjent.

---

## Fase 1 — Avhengighetskart (ingen sletting)

1. **Importer-graf** for `app/api/week/route.ts` og `app/api/weekplan/route.ts`  
   - Verktøy: `rg "api/week|api/weekplan"` i `app/`, `components/`, `lib/`.  
2. **Sanity GROQ**  
   - Kartlegg alle queries som treffer `_type=="weekPlan"` vs `menuContent`.  
3. **Cron**  
   - Dokumenter rekkefølge: `week-scheduler` → `week-visibility` / `lock-weekplans`.

**Leveranse:** Kort `DEPENDENCY_GRAPH.md` (valgfritt) eller utvid denne filen — **ikke** slett kode i Fase 1.

---

## Fase 2 — Lavrisiko: konsolidering uten atferdsendring

| Tiltak | Risiko |
|--------|--------|
| Ekstrahér **én** `normalizeRole` brukt av både `getAuthContext` og `lib/auth/role.ts` (eller importer fra én fil) | Lav hvis tester dekker roller |
| Legg til **kommentar** i `app/api/week/route.ts` som retter misvisende «GET /api/weekplan»-kommentar til faktisk rute | Null |
| Dokumenter i kode at `week-visibility` `isFri1400` er minutt-presis (evt. lenke til dette doc) | Null |

---

## Fase 3 — Harmoniser tidsregler (middels risiko)

1. Lag felles hjelpere for ukeporter (fra `WEEK_SOURCE_OF_TRUTH_DECISION.md`).  
2. Juster cron slik at den er **idempotent** og konsistent med `availability.ts` *eller* dokumenter avvik eksplisitt.  
3. Kjør manuell/CI-test for tidsgrenser (mock Oslo-klokke).

**Ikke** endre `middleware.ts` i samme PR som tidslogikk uten egen review.

---

## Fase 4 — API-sammenslåing (høy risiko)

1. Innfør intern delt builder som begge ruter kaller (eller deprecate én rute med 308 til den andre etter klientoppdatering).  
2. Mobilapper / PWA: verifiser ingen hardkodede URL-er.  
3. Behold **minst én** release med identisk JSON-skjema der det er mulig.

---

## Fase 5 — Studio og `weekPlan`

1. Hvis besluttet deprecated: **skjul** ikke slett — Week Planner-inngang i én `structure.ts`; merk schema `weekPlan` som deprecated i Studio-beskrivelse.  
2. Eksport av historiske dokumenter (backup) før arkivering.  
3. Fjern `lock-weekplans` cron bare når ingen dokumenter lenger patch-es.

---

## Fase 6 — Backoffice `content/_components` (struktur)

1. Grupper filer etter domene (workspace shell / editor / AI / preview) **uten** å endre public imports i én stor PR — bruk barrel-filer gradvis.  
2. Ingen nye parallelle `ContentWorkspaceV2`-mapper (forbudt av eier).

---

## Sjekkliste før enhver DELETE

- [ ] Ingen treff i `rg` / importer.  
- [ ] Ingen referanse i Sanity dataset (for CMS-typer).  
- [ ] Ingen cron / worker som forventer filen.  
- [ ] CI grønn.  
- [ ] Frozen flows i AGENTS.md er ikke berørt uten egen sign-off.

---

## Avhengigheter som **ikke** skal røres (fra oppdrag)

- `.env.local`, `.env.vercel.local`, Supabase-nøkler, Vercel-oppsett.  
- Login, registrering, pending onboarding, superadmin-aktivering, live Week/order-flyt uten egen testplan.

---

*Planen oppdateres ved hver utført fase.*
