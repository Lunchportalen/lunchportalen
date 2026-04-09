# CP3 — Open risks

1. **Worker stubs:** `send_email`, `ai_generate`, `experiment_run` — kan gi forventningsgap om «alt er LIVE».
2. **To publish-fortellinger:** Postgres content vs Sanity meny — krever fortsatt opplæring (UI hjelper, eliminerer ikke risiko fullt ut).
3. **Social DRY_RUN:** Ekstern publish ikke fullt koblet — policy og nøkler mangler kan fortsatt.
4. **Skala/last:** CP3 introduserer ikke bevis for høy last på `loadDomainRuntimeOverview` (superadmin-only, begrenset antall firma).
5. **Global sikkerhetsaudit:** CP3 berører ikke full middleware/API-gjennomgang — se `docs/hardening` / `docs/audit`.
