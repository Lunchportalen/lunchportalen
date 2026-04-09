# U25 — Settings runtime

## Hub

- `/backoffice/settings` — links to schema, create-options, system.

## Schema page

- Read-only tables from `backofficeSchemaSettingsModel` + CMS libs.

## Persistence truth

- **Schema/types:** code, not DB CRUD.
- **System toggles:** `system_settings` where applicable (see system page) — unchanged in U25.

## U25 addition

- Create-options page copy references POST envelope + duplicate behaviour for operator clarity.
