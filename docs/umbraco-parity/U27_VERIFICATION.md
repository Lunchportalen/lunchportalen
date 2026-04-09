# U27 — Verification

## Kommandoer (kjørt 2026-03-30)

Anbefalt for tunge maskiner: `NODE_OPTIONS=--max-old-space-size=8192` ved `tsc` (samsvar med `build`-script).

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | **PASS** (exit 0, ~3,5 min med NODE_OPTIONS) |
| `npm run lint` | **PASS** (exit 0; eksisterende warnings i andre filer, ingen nye feil fra U27-filer) |
| `npm run build:enterprise` | **PASS** (exit 0, ~8,5 min) |
| `npm run test:run` | **PASS** — 229 filer, 1254 tester (~2,5 min) |
| `npm run sanity:live` | **PASS** (exit 0; localhost utilgjengelig — soft skip av HTTP-sjekk, forventet uten kjørende dev-server) |

## Fokuserte testgrupper berørt av U27

| Gruppe | Tester |
|--------|--------|
| CMS / governance | `tests/cms/contentGovernanceUsage.test.ts` |
| Full suite | `npm run test:run` (alle 229 filer) |

## Notat

- E2E for superadmin governance-siden krever innlogget superadmin — ikke lagt til som obligatorisk i U27 hvis ikke i eksisterende suite.
- Kjør `sanity:live` mot kjørende app (`PUBLIC_APP_URL` / lokal base) for hard HTTP-validering i miljø med server.
