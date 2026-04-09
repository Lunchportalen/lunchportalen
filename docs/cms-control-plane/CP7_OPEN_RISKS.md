# CP7 — Open risks

1. **CDN / cache:** Kort forsinkelse etter publish før ansatt ser endring — forventet; ikke løst med ekstra cache-bust i CP7.
2. **`menu_visibility_days`:** Superadmin menyoversikt bruker DB + Sanity; employee path bruker `menuContent` filter — full operativ runbook kan forbedres.
3. **Token-exponering:** Feil konfigurasjon av env i deployment — mitigeres med fail-closed og tilgangskontroll.
4. **Ingen draft:** Broker returnerer noop — bruker må forstå at Studio må ha utkast.
