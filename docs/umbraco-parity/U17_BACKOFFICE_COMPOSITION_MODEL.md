# U17 — Backoffice composition model

## Umbraco 17 (referanse)

- **Extension manifest** registrerer utvidelser; **sections** grupperer arbeidsområder; **trees** og **workspaces** gir navigasjon og redigeringsflate; **workspace context** bærer valgt node/entitet; **workspace views** (tidligere content apps) er kontekstpaneler.

## Lunchportalen i dag

| Konsept | Implementasjon |
|---------|------------------|
| Manifest | `BACKOFFICE_EXTENSION_REGISTRY` (`backofficeExtensionRegistry.ts`) |
| Section | `sectionId` + `BACKOFFICE_NAV_GROUP_LABEL` |
| Tree/collection | `collectionKey` på manifest-rader |
| Workspace entry | `href` + `kind` (`workspace` \| `surface` \| `tool`) |
| Workspace context (UI) | `BackofficeExtensionContextStrip` + `findBackofficeExtensionForPathname` |
| Content apps | Content workspace paneler, SEO/CRO, etc. |

## Hva som var spredt (før CP13)

- Nav-array + merge av discovery uten felles `id` eller posture-pekere.

## Standardisering: section → collection → workspace

1. Finn rad i **`BACKOFFICE_EXTENSION_REGISTRY`** via `href` eller lengste path-prefix.
2. Les **`sectionId`** for IA.
3. Bruk **`collectionKey`** for dokumentasjon og fremtidig telemetri.
4. Kobling til **styring** og **posture** via `domainSurfaceId` / `modulePostureId` — **ingen** duplikat tabeller.

## Konsolidering uten parallelle systemer

- **Én** registry-fil; `backofficeNavItems.ts` forblir barrel.
- Ingen `registry.v2` eller duplikat navigasjonsliste.
