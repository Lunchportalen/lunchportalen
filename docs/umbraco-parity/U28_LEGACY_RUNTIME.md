# U28 — Legacy runtime

- **POST** `/api/backoffice/content/batch-normalize-legacy` — superadmin, `previewNormalizeLegacyBodyToEnvelope`, nb/prod default, maks 25 `pageId`, `dryRun` støttet.
- **Skriver** kun til eksakt `(locale, environment)`-variant eller oppretter ny rad — ingen «feil» locale-fallback.
- UI på `/backoffice/settings/governance-insights` med bekreftelsesdialog før lagring.
