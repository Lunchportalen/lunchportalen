# U26 — Changed files

## Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/legacyEnvelopeGovernance.ts` | Ny — validering + preview normalize | Lav |
| `app/(backoffice)/.../ContentWorkspacePropertiesRail.tsx` | Legacy UI + oppgradering | Lav |
| `app/(backoffice)/.../useContentWorkspaceAi.ts` | AI preflight | Lav — blokkerer ugyldig apply |
| `app/(backoffice)/.../contentWorkspaceChromeProps.ts` | `blocks` inn i properties rail | Lav |
| `app/api/backoffice/content/governance-registry/route.ts` | Read-only JSON | Lav — superadmin |
| `app/(backoffice)/backoffice/settings/management-read/page.tsx` | Management read UI | Lav |
| `app/(backoffice)/backoffice/settings/page.tsx` | Lenke | Lav |
| `tests/cms/legacyEnvelopeGovernance.test.ts` | Enhetstester | Lav |

## Dokumentasjon

- `docs/umbraco-parity/U26_*.md` (baseline, runtime, closing).
