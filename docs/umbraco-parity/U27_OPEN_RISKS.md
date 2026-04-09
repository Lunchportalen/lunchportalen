# U27 — Open risks

1. **Ytelse:** `governance-usage` leser opptil `MAX_SCAN` varianter synkront — kan være treg ved svært store tabeller uten indeks/optimalisering.
2. **Semantikk:** «Legacy» er definert via `parseBodyEnvelope`; kunder som lagrer uvanlige kroppsformer kan trenge manuell vurdering.
3. **Forventningsstyring:** Brukere kan tro bulk «Kopier lenker» er masse-redigering — copy er tydelig merket; likevel: opplæring.
4. **Superadmin-only:** Andre roller ser ikke usage — bevisst; misfornøyelse hos company_admin kan kreve read-only nedgradering senere (egen beslutning).
