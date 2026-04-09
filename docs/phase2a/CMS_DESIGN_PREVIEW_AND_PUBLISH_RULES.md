# CMS Design — preview og publisering

## Regler (uendret kjerne)

1. **Preview** skal lese samme **merge** som produksjon: `mergeFullDesign` + globale `designSettings` fra publisert innhold der det er relevant.
2. **Publisering** av globale designendringer går via `POST /api/content/global/settings` med `action: publish` — samme kontrakt som før.
3. **Blokk-`config`** serialiseres med sidens body ved lagring — ingen separat «design publish» for blokk utenom vanlig side-lagring.
4. **Ingen lekkasje:** globale tokens påvirker ikke andre tenants; tenant-grenser følger eksisterende API.

## Fail-closed

- Ugyldige enum-verdier i `config` skal ignoreres eller normaliseres i `designContract` (som i dag).

## QA-sjekkliste

- [ ] Endre global kort-variant → preview oppdateres etter henting av settings.
- [ ] Endre blokk `config.card` → live preview speiler endringen uten ny pipeline.
