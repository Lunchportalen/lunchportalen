# U30 — Preview & inspector IA model

## Preview

- **Split:** Editor-kolonne `fr` mindre enn preview-kolonne (`minmax(460px, 1.35fr)` mot editor) slik at preview ikke føles som «smalt sidespor».
- **Status:** Historikk-banner over preview beholdes; tydelig `aria-live` ved historikk-modus.

## Inspector

- **Høyre faner:** Egenskaper / AI / SEO / Diagnose / AI CEO — allerede store mål (U29R).
- **Egenskaper-innhold:** Underoverskrift «Innholdsapper» + faner for side-meta (U29R) — eventuelt videre gruppering i `<details>` for tunge seksjoner i senere fase (ikke påkrevd U30 hvis risiko).

## Publish / history / runtime

- **Top:** `ContentTopbar` eier publiseringshandlinger og dokumentstatus.
- **Audit:** Postgres `content_audit_log` — egen stripe; degradert modus når tabell mangler (ikke stille tom uten forklaring).
