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

## Operasjonelle krav

- **ALDRI** sett `WEBSITE_RUN_FROM_PACKAGE=1` (Umbraco offisielt ikke støttet)
- Portal Continuous Deployment skal være **AV**
- Pre-cutover rollback-net: `media-live-precutover.zip` på Kudu (behold til post-deploy verifisert grønt)
- Blob soft delete **30 dager** + versioning **On** (enterprise-net)

## Verifikasjon post-deploy

1. Kudu disk-sjekk (DLL-størrelse, AzureBlob-DLLs, `_Layout` F.X.6)
2. HTTP: `https://lunchportalen.no/` — logo, hero, favicon fra Blob
3. HTTP: `https://lunchportalen.no/umbraco/login` returnerer 200
4. `wwwroot/media/` tom/mangler på disk (forventet med `clean:true` + Blob)
