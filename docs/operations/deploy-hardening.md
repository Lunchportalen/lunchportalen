# Umbraco deploy hardening

## Bakgrunn

2026-05-27 prod-incident: deploy til `lunchportalen-umbraco` wipet `wwwroot/media/`. Root cause: `.gitignore` ekskluderer media → ikke i deploy-artifact → `azure/webapps-deploy@v3` (default clean) overskrev prod-disk.

## F.X.1 mitigering (2026-05-27, #55)

- Workflow `clean: false` bevarer filer ikke i artifact
- V.25 gate: assert `wwwroot/media/` ikke i artifact før deploy
- V.26 gate: assert `appsettings.Development.json` ikke i artifact
- `.csproj` ekskluderer `Development.json` fra Release publish

## F.X.3 permanent fix (2026-05-28, #58)

Media flyttet til **Azure Blob Storage**. `clean:false` fjernet — default OneDeploy `clean:true` gjenopprettet.

| Lag | Rolle |
|-----|-------|
| **Azure Blob** (`lunchportalenmedia` / container `lunchportalen-media`) | Media-filer (`media/<hash>/file`) |
| **Azure SQL** | Umbraco content + media-referanser |
| **Git** | Kode, views, config (tom `ConnectionString` i repo) |
| **App Setting** | `UMBRACO__STORAGE__AZUREBLOB__MEDIA__CONNECTIONSTRING` (Key Vault i F.X.4) |

Blob-path mapping:

```
URL:      /media/<hash>/file.png
Blob:     lunchportalen-media/media/<hash>/file.png
```

Container **må ikke** hete `media` — provideren legger alltid `media/`-prefix inni containeren.

### Hvorfor `clean:false` fjernet

`clean:false` + incremental OneDeploy var **deterministisk blokkerende** (#68: «Incrementally deploying → ZIP Deploy failed»). Etter Blob-cutover er det trygt og korrekt å bruke `clean:true`: media ligger i Blob, ikke på disk. V.25/V.26 gates uendret.

### OneDeploy no-op (#404) — lærdom 2026-05-28

GitHub Actions `webapps-deploy@v3` rapporterte **success** uten å oppdatere prod-disk (DLL forble 493 KB @ 09:26, ingen AzureBlob-DLLs). Kjent OneDeploy-atferd ved SCM-restart / App Setting-endring i quick succession (#444).

**Verifiser alltid disk etter deploy (ikke stol på CI-grønn alene):**

1. Kudu: `lunchportalen.dll` ≈ **502 KB** (ikke ~493 KB)
2. Kudu: `Umbraco.StorageProviders.AzureBlob*.dll` **tilstede**
3. Kudu: `Views/Partials/_Layout.cshtml` inneholder `@faviconUrl` (F.X.6)
4. HTTP: `/media/<hash>/...` returnerer **200** (Blob-provider aktiv)

**Fallback ved no-op:** stopp app → `az webapp deploy --type zip --clean true` → start app. Ikke endre App Settings rett før/during deploy.

## F.X.7 deploy-automatisering (2026-05-26, branch `chore/sprint-ab-fase-f-x7-deploy-hardening`)

Erstatter `azure/webapps-deploy@v3` (folder OneDeploy) med **stop → zip deploy → start** + post-deploy gates. Auth: eksisterende OIDC (`azure/login@v2`).

| Steg | Beskrivelse |
|------|-------------|
| Build | Skriver `App_Data/deploy-stamp.json` `{sha, dllSize}` i publish-artifact (ikke serverbar path) |
| V.25 + V.26 | Uendret — artifact-integritet før deploy |
| Package | `app.zip` fra `umbraco-app/` |
| Stop | `az webapp stop -n lunchportalen-umbraco -g rg-lunchportalen-prod` |
| Deploy | `az webapp deploy --type zip --clean true` |
| Start | `az webapp start` med **`if: always()`** (sikrer oppstart ved deploy-feil) |
| V.27a | Kudu VFS: les `App_Data/deploy-stamp.json` — `sha == GITHUB_SHA`, `dllSize` match artifact |
| V.27b | Poll `https://www.lunchportalen.no/` → **200** innen ~5 min (cold start) |

**Concurrency:** `deploy-prod`, `cancel-in-progress: false` — ingen overlappende prod-deploys.

**Env:** `AZURE_RESOURCE_GROUP: rg-lunchportalen-prod`

### V.27 — post-deploy system truth (fail-closed)

CI-grønn alene er **ikke** nok (#68). V.27 kjører etter hver prod-deploy:

| Gate | Sjekk | Feil = |
|------|-------|--------|
| **V.27a** | Kudu Bearer (`az account get-access-token --resource https://appservice.azure.com`) → `/api/vfs/site/wwwroot/App_Data/deploy-stamp.json` | Mismatch/manglende stamp → deploy antatt no-op eller stale disk |
| **V.27b** | HTTP GET forsiden → 200 innen 300 s | App nede etter cold start |

V.27a sammenligner **primært** `sha` mot `GITHUB_SHA`. `dllSize` er sekundær sanity (samme verdi som build-artifact).

### Første kjøring etter merge

1. **Ikke** push-trigger — bruk **`workflow_dispatch`** (kontrollert)
2. Verifiser V.27a grønn (disk oppdatert) + V.27b grønn (app oppe)
3. Mål faktisk nedetid (stop → deploy → start)
4. **Rollback** ved heng: `az webapp start -n lunchportalen-umbraco -g rg-lunchportalen-prod` manuelt + revert workflow

## Operasjonelle krav

- **ALDRI** sett `WEBSITE_RUN_FROM_PACKAGE=1` (Umbraco offisielt ikke støttet)
- Portal Continuous Deployment skal være **AV**
- Pre-cutover rollback-net: `media-live-precutover.zip` på Kudu (behold til post-deploy verifisert grønt)
- Blob soft delete **30 dager** + versioning **On** (enterprise-net)

## Verifikasjon post-deploy

Automatisert i workflow (F.X.7):

1. **V.27a** — `deploy-stamp.json` på prod-disk matcher commit + dllSize
2. **V.27b** — `https://www.lunchportalen.no/` returnerer 200

Manuell sanity (valgfritt etter første grønn V.27):

3. Kudu: `Umbraco.StorageProviders.AzureBlob*.dll` tilstede
4. HTTP: logo, hero, favicon fra Blob
5. HTTP: `/umbraco/login` returnerer 200
6. `wwwroot/media/` tom/mangler på disk (forventet med `clean:true` + Blob)
