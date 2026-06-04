# GO #114-FIX — in-suite root-cause (read-only)

## Hypotese (bekreftet)

| Kontekst | Atferd |
|----------|--------|
| **Isolert** `week-icon-probe.e2e.ts` | Grønn — fersk side, ingen forutgående prober |
| **Full suite** (#104) | `slotClockProbe === null` etter at **andre prober** + **eyes-on** har kjørt, og/eller **Tir-panel** henger igjen |

**Mekanisme:** Etter `selectWeekDay(Tir 02)` + kalender-ikon-les (Mon/Ons markører i DOM, ingen panel-bytt) kjørte **Playwright `monPill.click({ noWaitAfter: true })`** og deretter **separat** `page.evaluate`. Da hadde React tid til CUTOFF-`useEffect` (`setSelectedDate(null)` → default Tir) **før** slot-lesing — panelet viste **Tir 02** (ingen `.is-locked` slot).

**Ikke** bare «walk på Tir/Ons» (kun `evaluate` på markører), men **Tir-panel aktiv** + **React onClick asynkron**: synkron `mon.click()` + separat evaluate kommer **etter** CUTOFF-revert.

## Fiks (kun probe)

1. **Precondition:** `selectWeekDay("2026-06-02")` rett før slot-klokke.
2. **Ett async `page.evaluate`:** `mon.click()` + microtask/`rAF`-poll (≤48 frames) for `.is-locked` slot — fortsatt in-suite, ingen ekstra `waitFor(15s)`.

Ingen flytting av sub-probe ut av suiten. Ingen ikon/CSS-endring.
