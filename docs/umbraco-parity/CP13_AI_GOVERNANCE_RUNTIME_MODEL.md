# CP13 — AI governance runtime model (baseline)

## Eksisterende lag

- **API:** `app/api/backoffice/ai/**` — modulære endepunkter.
- **CI:** `npm run ai:check`, `check:ai-internal-provider`.
- **Innhold:** `contentWorkspace.ai.ts`, modaler — menneskelig review før publish der påkrevd.

## Modenhet

| Område | Status |
|--------|--------|
| Tekst/layout/SEO assist | Moden |
| Bilde/metadata | Moden |
| Social publish | LIMITED / DRY_RUN |
| Worker-jobs | STUB (jf. `moduleLivePosture`) |

## Umbraco.AI-prinsipper (operativ tolkning)

- **Modulær** — én route = én kapabilitet; kan skrus av via policy/env.
- **Valgfri** — ingen tvang for redigering.
- **Governed** — sjekk-skript + server-validering.
- **Human-reviewed** — workflow/publish i content.
- **Provider-flexible** — env-basert; ingen hardkodet ene-leverandør i produksjonskode.
- **Cost-aware** — operativt; ikke full dashboard i CP13.

## CP13-kode

- AI Tower-lenke i manifest med `modulePostureId: worker_jobs` der relevant — **ærlig** om begrensninger.
- Ingen ny orchestrator.

## Hva som må vente

- Samlet **AI-innstillinger**-UI for ikke-tekniske brukere.
- Full **kost-taksometer** i CMS.
