# CMS — Company / agreement / location actions

**CP4:** `CONTROL_PLANE_DOMAIN_ACTION_SURFACES` + `CmsDomainActionSurfaceCard` + `/backoffice/agreement-runtime`.

## Posture

| Type | Betydning |
|------|-----------|
| read_only | Kun innsyn |
| review | Menneskelig kontroll før handling i runtime |
| runtime_route | Mutasjon kun i eksisterende superadmin/admin |

## Avtale-runtime

- `CmsAgreementRuntimePreviewTable` bruker `normalizeAgreement` på `agreement_json` for å vise man–fre tier + binding der mulig.
- **Ikke** erstatning for full avtale-UI i admin.
