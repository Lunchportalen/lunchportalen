# FULL RELEASE PACKAGE (RC)

Dette er operativ runbook for RC: freeze, tagging, observasjon og rollback.

## 1) FREEZE PROTOCOL (48h)
- Varighet: 48 timer.
- Ingen endringer i perioden.
- Unntak: produksjonsincident (regresjon eller sikkerhet).
- Ingen "små tweaks" eller "quick wins".

## 2) TAG + RELEASE NOTES
### Tag-eksempler
- v3.1.0-wow
- rc-wow-YYYY-MM-DD

### Kommandoer
```bash
git pull
git tag <tag>
git push origin <tag>
```

### Release note-mal (3 bullets)
- Omfang: <hva ble levert og hvorfor>
- Risiko: <største risiko eller "ingen">
- Observability: <hvordan verifisere i prod>

## 3) OBSERVE PROTOCOL (24–72h)
- Varighet: 24 til 72 timer etter release.
- Kjør `npm run postdeploy` to ganger daglig (morgen og ettermiddag).
- Logg minimum: tidspunkt + PASS/FAIL + én linje avvik.

### GO / NO-GO kriterier
- GO hvis alle postdeploy-kjøringer PASS og ingen kritiske avvik.
- NO-GO hvis noen postdeploy FAIL eller kritisk avvik oppdages.

## 4) ROLLBACK RULE
- Kun tillatt rollback: `git revert <sha>` og redeploy.
- Ingen improvisasjon eller manuelle endringer.
