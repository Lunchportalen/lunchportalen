# CP11 — Content apps and context panels

**Dato:** 2026-03-29

## Finnes i dag

| Flate | Type | Eksempel |
|-------|------|----------|
| Content | Workspace + sidepaneler | SEO, CRO, recovery, konflikt, AI |
| Media | Inline metadata, liste | Alt, tags, opplasting |
| Domener | Kort + tabell | `CmsModuleLivePostureTable`, action surfaces |
| Uke & meny | Orkestrator + paneler | `CmsWeekMenuPublishOrchestrator`, runtime status |
| SEO/Social/ESG | Modul-callout + klient | `CmsGrowthModuleCallout` |

## Mangler (relativt Umbraco)

- **Én visuell «app»-register** — delvis dekket av felles workspace-header i CP11.
- **Egne faner per document type** — fortsatt **UX**, ikke ny DB.

## CP11-retning

- **Konsistent innrykk:** `BackofficeWorkspaceSurface` før innhold.
- **Tydelig objekt:** H1 matcher nav-label der mulig.
- **Publish-kritiske felt:** fortsatt i content workspace / eksisterende API — ikke ny editor.

## Grenser

- Ingen parallelle **Editor v2**-komponenter.
- Ingen nye **content apps** som krever egen state machine uten backend.
