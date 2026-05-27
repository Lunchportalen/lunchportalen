# Umbraco deploy hardening

## Bakgrunn

2026-05-27 prod-incident: deploy til `lunchportalen-umbraco` wipet `wwwroot/media/`. Root cause: `.gitignore` ekskluderer media → ikke i deploy-artifact → `azure/webapps-deploy@v3` (default clean) overskrev prod-disk.

## F.X.1 mitigering (denne PR)

- Workflow `clean: false` bevarer filer ikke i artifact
- V.25 gate: assert `wwwroot/media/` ikke i artifact før deploy
- V.26 gate: assert `appsettings.Development.json` ikke i artifact
- `.csproj` ekskluderer `Development.json` fra Release publish

## Operasjonelle krav

- **ALLTID** backup av `wwwroot/media/` før push til `main` (Kudu/FTPS)
- **ALDRI** sett `WEBSITE_RUN_FROM_PACKAGE=1` (Umbraco offisielt ikke støttet)
- Portal Continuous Deployment skal være **AV**

## Begrensninger

F.X.1 forhindrer ikke alle media-tap-scenarier:

- VM-flytt kan fortsatt skje (Azure-platform)
- Manuell deploy-feil kan fortsatt skje
- Filsystem-corruption kan skje

Permanent fix: **F.X.3** (Azure Blob Storage for media) — separat batch.

## Verifikasjon post-merge

1. Dry-run deploy via `workflow_dispatch`
2. Etter deploy, verifiser via Kudu: `C:\home\site\wwwroot\wwwroot\media\` intakt
3. HTTP-sjekk: `https://lunchportalen.no/` rendrer med bilder
4. HTTP-sjekk: `https://lunchportalen.no/umbraco/login` returnerer 200
