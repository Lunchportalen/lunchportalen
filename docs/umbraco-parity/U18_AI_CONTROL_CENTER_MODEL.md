# U18 — AI control center model

## Eksisterende flater

- **API:** `app/api/backoffice/ai/**`
- **Side:** `/backoffice/ai-control` — logg + autonom kjøring (begrenset)
- **CI:** `ai:check`, `check:ai-internal-provider`

## Modenhet

- **Moden:** innholdsassist, SEO, media-ruter (der miljø støtter).
- **LIMITED / STUB:** social publish, worker-jobs (jf. `MODULE_LIVE_POSTURE_REGISTRY`).

## Umbraco AI-prinsipper (operativ)

- CMS stabil, AI modulær og valgfri; **human approval** i content; **ingen** leverandørlås-narrativ som bryter sjekker.

## U18 UI

- **`AiGovernanceOverview`** viser **hele** `MODULE_LIVE_POSTURE_REGISTRY` — **én sann tabell** for drift, ikke pynt.
- Hurtiglenker til Content, Media, SEO, Social, Uke & meny.

## Må vente

- Dedikert **kost-dashboard** og **modellvelger** i UI.
- **Ny orchestrator** — ikke påkrevd.
