# U28 — Verification

Kjør:

```bash
npm run typecheck
npm run lint
npm run build:enterprise
npm run test:run
```

**Fokus:** `tests/cms/contentGovernanceUsage.test.ts`, `tests/cms/batchNormalizeLegacy.test.ts`, full suite.

## Resultat (lokal kjøring)

| Kommando | Status |
|----------|--------|
| `npm run typecheck` | PASS |
| `npm run test:run` | PASS (full suite) |
| `npm run build:enterprise` | PASS (inkl. `verify-control-coverage` — batch-rute innen `withCmsPageDocumentGate`) |

`npm run lint` — kjør i miljøet ditt (eksisterende warnings i andre filer kan forekomme).
