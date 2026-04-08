# U107B — Week route align (git-sannhet)

**Dato:** 2026-04-08  
**Formål:** Aligne git med U104: **`app/(app)/week/**` er kanonisk employee week-entry; **`app/(portal)/week/**` er gammel struktur.** Ingen funksjonsrefaktor, ingen API/lib-endringer i denne pakken.

**Dette er ikke baseline freeze.**  
**Dette er ikke proof.**  
**Dette er ikke CI/e2e.**

---

## A) Før — gammel tracked struktur vs kanon på disk

| Observasjon | Faktum |
|-------------|--------|
| **Gammel struktur (tracked)** | `app/(portal)/week/WeekClient.tsx`, `app/(portal)/week/page.tsx` fantes i index; slettet i working tree (`D`) uten at slettingen var committet. |
| **Kanonisk struktur (på disk, ikke sporet)** | `app/(app)/week/page.tsx`, `app/(app)/week/EmployeeWeekClient.tsx` som **`??` (untracked)**. |
| **Øvrige week-relaterte lag** | `components/week/**`, `lib/week/**`, `app/api/**/week*`, studio, m.m. — **ikke berørt** i U107B (ikke nødvendig for ren rute-align i git). |

---

## B) Etter — hva som ble committet

**Commit:** `4f1920f77e04d60472e8324c42da1d198ea31408`  
**Melding:** `app/week: align canonical employee week route`

**Staget sett (nøyaktig fire filer):**

- **Slettet fra repo:** `app/(portal)/week/WeekClient.tsx`, `app/(portal)/week/page.tsx`
- **Lagt til som tracked:** `app/(app)/week/page.tsx`, `app/(app)/week/EmployeeWeekClient.tsx`

**Verifikasjon før commit:** `npm run typecheck` PASS, `npm run test:run` PASS.

---

## C) Eksplisitt ikke inkludert

- Endringer i `components/week/**`, `lib/week/**`, `app/api/**`, `studio/**`, e2e, CI
- Audit full-system logger (U107A) — **ikke rørt**
- Påstand om ren baseline for hele repoet

---

## D) Neste minste pakke (én)

| Felt | Verdi |
|------|--------|
| **Navn** | **baseline-freeze-retry** |
| **Hvorfor** | Uke-rute-konflikten i git er lukket; resten av working tree er fortsatt typisk **ikke** «én baseline» etter `docs/audit/policies/audit-baseline-policy.md` (dirty tree). Neste ærlige steg er **ny måling** av om freeze kan påstås eller må avvises — ikke å blande inn nye features. |
| **Hva den lukker** | Oppdatert **go/no-go** på baseline-freeze ut fra faktisk git-tilstand etter week-align — ikke en freeze i seg selv. |

---

## E) Sluttdom (én setning)

Per nå matcher **tracked routes** **U104** for employee week, og derfor er neste ærlige steg **baseline-freeze-retry** (måle på nytt om repoet fortsatt diskvalifiserer baseline, uten å kalle det proof).
