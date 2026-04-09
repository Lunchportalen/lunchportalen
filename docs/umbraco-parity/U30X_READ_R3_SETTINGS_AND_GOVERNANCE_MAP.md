# U30X-READ-R3 — Settings and governance map

## Flater (kode-knagger)

| Område | Filer / ruter | «First-class»? | Parity class |
|--------|----------------|----------------|--------------|
| Settings base path | `BACKOFFICE_SETTINGS_BASE_PATH` i `backofficeExtensionRegistry.ts` | Ja (én sti) | **CODE_GOVERNED** |
| Settings chrome | `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx` | UI | **UX_PARITY_ONLY** |
| Governance registry | `app/api/backoffice/content/governance-registry/route.ts` | Les API | **PARTIAL** |
| Governance usage | `app/api/backoffice/content/governance-usage/route.ts` | `content_page_variants` | **RUNTIME_TRUTH** |
| Block allowlist | `lib/cms/blockAllowlistGovernance.ts` | Kode + policy | **CODE_GOVERNED** |
| Document types | `lib/cms/contentDocumentTypes.ts` | Minimal `page` type | **PARTIAL** — ikke admin UI for flere typer |
| Schema settings model | `lib/cms/backofficeSchemaSettingsModel.ts` | Modell | Les fil for detaljer — **PARTIAL** |
| Legacy envelope | `lib/cms/legacyEnvelopeGovernance.ts` | Governance | **CODE_GOVERNED** |
| Control plane snapshot | `lib/cms/backoffice/loadControlPlaneRuntimeSnapshot.ts` | Runtime | **PARTIAL** |

## Hva som er reelt vs read-only forklaring

- **Reelt:** HTTP routes som leser Postgres + TS governance for blokker.  
- **Read-only forklaring:** Context strip (`BackofficeExtensionContextStrip`) — **ingen mutasjon**.  
- **Ser first-class ut:** Mange nav-items i `BACKOFFICE_EXTENSION_REGISTRY` peker til **flater** som kan være **LIMITED/STUB** per `MODULE_LIVE_POSTURE_REGISTRY` — **MISLEADING** hvis bruker ikke ser strip.

## Sluttdom

**PARTIAL** samlet: sterk **CODE_GOVERNED** governance for tekniske kontrakter; **STRUCTURAL_GAP** vs Umbraco **Settings** med **data types** og **document types** som redigerbare server-entiteter.
