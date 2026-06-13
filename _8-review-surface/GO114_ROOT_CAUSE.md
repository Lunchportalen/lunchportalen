# GO #114 — root-cause (pre-CI bevis)

## Flake = slot-klokke-sub-probe, ikke kalender-markører

| Del | Deterministisk? | Bevis |
|-----|-----------------|-------|
| Tre kalender-ikoner (locked/ordered/unavailable) | **Ja** | Leses før Mon-tap; grønn på alle flapp-runs når V.W8 feilet |
| `slotClockProbe` | **Nei (før fix)** | `null` når `waitFor(.week-category-card__state-icon)` timeout — panel ikke Mon locked |

**Mekanisme:** CUTOFF Mon-tap → `useEffect` revert. V.W8 ventet 10s på synlig slot-klokke mens panel fortsatt **Tor 04** (error-context #99). V.W6: `selectWeekDay(Tir 02)` først + **umiddelbar** `page.evaluate` etter tap (ingen `waitFor` på slot-ikon).

## Fix (probe only)

1. `selectWeekDay("2026-06-02")` — samme harness som V.W6.
2. Fjern `waitFor` på slot-klokke; les DOM i samme vindu som V.W6.
3. `labelText` matcher `/frist passert/i`.

**Ingen endring** i `EmployeeWeekClient.tsx` / `employee-week.css`.

## CI (etter push)

- `VW8_DETERMINISM.json` — 3× grønn
- `WEEK_ICON_PROBE.json` — full probe
- Fire `*-actual-crop.png` — `locator.screenshot()` i Docker
