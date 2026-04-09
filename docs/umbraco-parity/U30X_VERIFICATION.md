# U30X — Verification

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings, exit 0) |
| `npm run build:enterprise` | PASS |
| `npm run test:run` | PASS |

## Testgrupper (fokus)

- **Tree:** `tests/api/treeRouteDegradable.test.ts`, `tests/api/treeRoutePageKeyFallback.test.ts`, `tests/api/contentTree.test.ts`, `tests/backoffice/content-tree-guard.test.ts`
- **Audit:** `tests/api/contentAuditLogRoute.test.ts`
- **Parse:** `tests/cms/mapTreeApiRoots.test.ts`, `tests/cms/treeRouteSchema.test.ts`
