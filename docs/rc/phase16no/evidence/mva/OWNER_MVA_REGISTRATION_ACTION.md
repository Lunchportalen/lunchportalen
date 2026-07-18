# OWNER ACTION REQUIRED — Merverdiavgiftsregisteret

**Status:** `LUNCHPORTALEN_MVA_REGISTERED = NO`  
**Evidence:** `docs/rc/phase16no/evidence/mva/LUNCHPORTALEN_MVA_REGISTRATION.json`  
**Source:** Brønnøysundregistrene Enhetsregisteret API (`registrertIMvaregisteret: false`)  
**Org:** LUNCHPORTALEN AS · 937155239  
**Checked:** see evidence timestamp/checksum

## Exact owner action

1. Confirm taxable turnover / registration obligation with Skatteetaten guidance.
2. Register Lunchportalen AS in Merverdiavgiftsregisteret (via Altinn / Skatteetaten).
3. Wait until Brønnøysund Enhetsregisteret shows `registrertIMvaregisteret: true`.
4. Re-run verification:
   `https://data.brreg.no/enhetsregisteret/api/enheter/937155239`
5. Store updated evidence under `docs/rc/phase16no/evidence/mva/`.
6. Only then set `PLATFORM_INVOICE_VAT_25_ENABLED=ELIGIBLE` / true and issue real MVA invoices.

## Hard rules while unregistered

- Do **not** issue a real invoice containing MVA.
- Do **not** falsely append `MVA` to the organisation number.
- Do **not** restore the accountant confirmation gate.
- Technical Norway ordering / commission calculation may continue.
