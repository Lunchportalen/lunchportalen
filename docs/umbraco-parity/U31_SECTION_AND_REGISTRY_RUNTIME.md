# U31 — Section & registry runtime

- **Manifest:** `lib/cms/backofficeExtensionRegistry.ts` — `BACKOFFICE_EXTENSION_REGISTRY`, groups `control | runtime | domain | content | system`.
- **TopBar:** section `<select>` + per-group module links; **U31** adds `BACKOFFICE_TOPBAR_MODULE_OVERFLOW` (5) and **«Flere»** `<details>` for overflow — reduces horizontal pill overload.
- **Context strip:** `BackofficeExtensionContextStrip` — posture/domain read-only.
- **Settings:** canonical `BACKOFFICE_SETTINGS_BASE_PATH`, entry `nav.settings` with `managementPlane: true`.
