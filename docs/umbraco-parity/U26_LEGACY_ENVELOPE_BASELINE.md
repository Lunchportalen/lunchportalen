# U26 — Legacy envelope baseline

**Kode er sannhet.** Dette er et kart over tilstand ved U26.

## Kanonisk envelope

- `documentType` + `fields` + `blocksBody` (`lib/cms/bodyEnvelopeContract.ts`).
- Nye sider (U25): `POST /api/backoffice/content/pages` skriver standard `page` + tomme blokker i envelope.

## Legacy / flat

- Variant-body **uten** top-level `documentType` (typisk `{ version, blocks }`).
- Server allowlist (`validateBodyPayloadBlockAllowlist`) **hopper over** når `documentType` mangler.

## Create/save

| Flyt | documentType |
|------|----------------|
| Lagring med valgt type i editor | Ja (`serializeBodyEnvelope`) |
| Legacy lastet inn | Nei til `documentTypeAlias` er tom |
| U26 «Oppgrader til kanonisk envelope» | Setter type i state; **lagring** skriver envelope |

## U26 leveranser

- Eksplisitt **oppgraderingsknapp** i egenskaps-rail (Side → Innhold) med forhåndsjekk av blokktyper.
- **AI apply preflight** når dokumenttype er satt.
- **Management read** (Settings + GET JSON) uten ny persisted motor.
