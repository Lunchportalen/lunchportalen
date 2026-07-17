# PHASE 16NO.4 — MVA THRESHOLD PRODUCTION ACTIVATION

**Status:** stopped at Gate 1  
**Decision:** `OWNER_AUTHENTICATION_REQUIRED`

## Release (re-read)

| Field | Value |
|-------|--------|
| previous production SHA | `38b18c38742e1b50eb727f6bf807e1a1499f69fb` |
| verified release SHA | pending push tip (local was `b8debd06` after allowlist; confirm after push) |
| deployment ID | unchanged |
| migration head before | `20260902120000` |
| migration head after | not applied |
| applied migrations | none |
| production locks | ACTIVE |

## Fiscal (production)

| Field | Value |
|-------|--------|
| official MVA registration | NO |
| recognized taxable turnover | NOK 0.00 |
| invoiced commission turnover | NOK 0.00 |
| threshold | NOK 50,000 |
| remaining | NOK 50,000 |
| warning band | NONE |
| real invoicing without MVA | code ready; not live-activated |
| real invoicing with MVA | BLOCKED |
| crossing policy | HOLD_UNTIL_REGISTERED |

## Gate progress

| Gate | Result |
|------|--------|
| 1 Secure deploy auth | **BLOCKED** — no GH Vercel deploy workflow/secrets; local CLI credentials empty/revoked |
| 2 Freeze SHA | in progress (push + CI) |
| 3–9 | not started |

## Owner action required

```text
vercel login
```

Authenticate the Lunchportalen Vercel team in the browser, then confirm in chat.
Do not paste tokens. Do not recreate the revoked token value.
