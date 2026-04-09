# U20 — AI control center runtime

## Status (ingen hemmeligheter)

- `AiGovernanceSettingsPanel` henter `GET /api/backoffice/ai/status` og viser `enabled`, `provider`, `model`, `errorCode`.
- Plassering: `/backoffice/ai-control` mellom `AiGovernanceOverview` og `AiGovernanceHumanAndCostPanel`.

## Eksisterende

- `MODULE_LIVE_POSTURE_REGISTRY`, autonomy-logg, `AiControlRunClient` — uendret sannhet.
