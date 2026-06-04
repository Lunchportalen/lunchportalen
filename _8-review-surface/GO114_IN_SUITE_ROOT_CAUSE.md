# GO #114-FIX — in-suite root-cause (read-only)

## Hypotese (bekreftet)

| Kontekst | Atferd |
|----------|--------|
| **Isolert** `week-icon-probe.e2e.ts` | Grønn — fersk side, ingen forutgående prober |
| **Full suite** (#104) | `slotClockProbe === null` etter at **andre prober** + **eyes-on** har kjørt, og/eller **Tir-panel** henger igjen |

**Mekanisme (bekreftet via error-context #109):** Etter Mon-tap er kalender-pill **Man 01 `[active]`**, men hovedpanel er **Fre 05.06.2026** (åpen dag) — ikke Mon locked slots. CUTOFF-`useEffect` nullstiller valg; `pickDefault` lander på annen dag. Ingen `.is-locked` slot i DOM → `slotClockProbe === null`.

Tidligere prober i samme Playwright-invokasjon (chip/collapse, alfabetisk før icon) + tregere CI gjør dette hyppigere enn isolert fil-kjøring.

**Ikke** ikon-regresjon — **panel-/state-race** på slot-klokke-sub-proben.

## Fiks (kun probe)

1. `navigateToWeek` + `selectWeekDay(Tir 02)` — reset shell.
2. **`expect.poll`**: Mon-tap + slot-ikon i DOM inntil 10s (fanger CUTOFF-transient mount).

Ingen flytting ut av suiten. Ingen ikon/CSS-endring.
