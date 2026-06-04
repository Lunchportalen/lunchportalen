# GO #114-FIX — in-suite root-cause (read-only)

## Hypotese (bekreftet)

| Kontekst | Atferd |
|----------|--------|
| **Isolert** `week-icon-probe.e2e.ts` | Grønn — fersk side, ingen forutgående prober |
| **Full suite** (#104) | `slotClockProbe === null` etter at **andre prober** + **eyes-on** har kjørt, og/eller **Tir-panel** henger igjen |

**Mekanisme:** Etter `selectWeekDay(Tir 02)` + kalender-ikon-les (Mon/Ons markører i DOM, ingen panel-bytt) kjørte **Playwright `monPill.click({ noWaitAfter: true })`** og deretter **separat** `page.evaluate`. Da hadde React tid til CUTOFF-`useEffect` (`setSelectedDate(null)` → default Tir) **før** slot-lesing — panelet viste **Tir 02** (ingen `.is-locked` slot).

**Ikke** «walk på Tir/Ons» alene (kun `evaluate` på piller), men **panel-state arvet fra Tir** + **async gap** mellom tap og les.

## Fiks (kun probe)

1. **Precondition:** `selectWeekDay("2026-06-02")` umiddelbart før slot-klokke (V.W6 reset).
2. **Samme evaluate-vindu:** `mon.click()` + `querySelector(.is-locked slot)` i **ett** `page.evaluate` (synkron i browser — før useEffect).

Ingen flytting av sub-probe ut av suiten. Ingen ikon/CSS-endring.
