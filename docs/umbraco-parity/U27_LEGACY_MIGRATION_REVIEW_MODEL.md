# U27 — Legacy migration review model

## Hvordan legacy vs governed identifiseres i dag

1. **Parse:** `parseBodyEnvelope(body)` — hvis `documentType` mangler eller er tom etter trim → **legacy/flat** for denne varianten.
2. **Oppgradering enkeltvis:** workspace-flows og API som skriver kanonisk envelope (U25/U26) + «oppgrader til envelope» der implementert.
3. **Governance-validering:** `legacyEnvelopeGovernance.ts`, `blockAllowlistGovernance.ts` ved lagring — ikke batch.

## Eksisterende oppgraderingshandlinger

- Opprettelse av nye sider med default envelope (`POST /api/backoffice/content/pages`).
- Redigering og lagring i workspace med validering mot dokumenttype og allowlist.

## Review-flyt (U27)

| Behov | Løsning |
|-------|---------|
| Se hvilke sider som er legacy | `GET /api/backoffice/content/governance-usage` + `legacyPageIds` (sample cap) |
| Se dokumenttype- og blokkfordeling | Samme endepunkt: `byDocumentType`, `blockTypeCounts` |
| Reviewbar enkeltoppgradering | Lenke til `/backoffice/content/[id]` — menneske i loop |
| Batch-normalisering | **Ikke** automatisert i U27 uten egen sikkerhetsspec; unngår datatap |

## Bygges nå uten massemigrering

- Read-only aggregat + liste med lenker.
- Eksplisitt cap og `scanCapped`-flagg når datasett er stort.

## Må vente

- Bevist trygg **én** transform brukt på alle rader (lang testmatrise).
- Eventuell jobb-kø med audit — krever runtime/operativ eierskap utenfor ren CMS-UI.
