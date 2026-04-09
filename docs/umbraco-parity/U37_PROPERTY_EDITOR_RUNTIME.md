# U37 Property Editor Runtime

## Landed Now
- Property editor-systemet forblir modellert i én kanonisk settings-lesemodell: schema, configured instance/data type, UI mapping og usage.
- Block create/defaults er nå koblet til den kanoniske backoffice-katalogen i stedet for lokale create-arrays og registry-duplikater.
- Settings-arbeidsflater og labels gjør skillet mellom runtime-managed og code-governed tydeligere i UI.

## Explicit Model
- Schema truth: `backofficeSchemaSettingsModel`.
- Configured instance truth: data type-samlingene og usage-summeringene.
- UI truth: property-editor/UI-mappingene som allerede vises i settings.
- Defaults/presets truth: blokkatalog + eksisterende schema/default-helpers, nå uten parallelt block-registry.

## Honest Gap
- U37 bygde ikke en ny property engine og bygde ikke persisted preset-CRUD.
- Pariteten er bedre i lesbarhet og sammenheng, men fortsatt ikke 1:1 Umbraco Bellissima-konfigurasjon med redigerbar persisted lifecycle.
