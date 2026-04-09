# U17 — Deep changed files

## Kode (U17 DEEP BUILD)

| Fil | Formål |
|-----|--------|
| `lib/cms/backofficeExtensionRegistry.ts` | `findBackofficeExtensionForPathname` — lengste href-match for nested workspaces (f.eks. papirkurv). |
| `components/backoffice/BackofficeExtensionContextStrip.tsx` | **NY** — workspace-kontekst-strip: seksjon, modulposture (`moduleLivePosture`), styring (`controlPlaneDomainActionSurfaces`), første handlingslenke. |
| `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx` | Monterer context-strip under TopBar. |
| `tests/cms/backofficeExtensionRegistry.test.ts` | Tester for path-resolution (nested vs parent). |

## Dokumentasjon

- `U17_DEEP_BASELINE.md`, `U17_DEEP_GAP_MAP.md`, `U17_BACKOFFICE_COMPOSITION_MODEL.md`, `U17_CONTENT_MODEL_AND_PROPERTY_EDITOR_MAP.md`, `U17_MANAGEMENT_VS_DELIVERY_MODEL.md`, `U17_AI_GOVERNANCE_AND_POSTURE.md`, `U17_DEEP_EXECUTION_LOG.md`, `U17_DEEP_CHANGED_FILES.md` (denne filen).
- Oppdatert `U17_REPLATFORMING_GAPS.md` (header).
- Workstream- og slutt-dokumenter under `docs/umbraco-parity/U17_*.md` (se individuelle filer).

## Risiko

**Lav:** strip er read-only; bruker eksisterende registre; ingen endring av runtime-API eller auth.
