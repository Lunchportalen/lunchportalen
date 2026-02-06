# POST-DEPLOY (0–24t) — Lunchportalen

## Mål
Bekrefte stabil drift etter deploy, uten stille feil og uten rolle-/tenant-lekkasje.

## 0–10 min smoke (automatisert)
- Kjør `npm run postdeploy` mot PROD
- Loggfør: tidspunkt, commit, ansvarlig
- PASS = grønne sjekker, FAIL = stopp og eskaler

## 0–2 timer (real flow)
- Én ansatt: bestill og avbestill innenfor regler
- Kjøkkenvisning: totals og grupperinger stemmer
- Ingen 500-feil trend i overvåking/logg

## 08:00 cutoff (verifisering)
- Handling før 08:00: skal gå gjennom
- Handling etter 08:00: skal avvises korrekt

## 24t GO / NO-GO
GO hvis:
- 0 blockers
- ingen 500-trend
- cutoff OK
- kjøkken matcher ordre
- ingen rolle-/tenant-lekkasje

NO-GO hvis:
- feil i smoke eller real flow
- avvik i cutoff
- 500-trend oppstår
- rolle-/tenant-avvik oppdages

## Rollback (kun NO-GO)
- `git revert <sha>` → push → redeploy
