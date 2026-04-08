# Canonical proof policy (Lunchportalen)

**Status:** BINDENDE. Ingen “snill tolkning” ved revisjon.

## 1. Hva som teller som gyldig proof

Gyldig proof er **én sammenhengende kjede** av:

1. **Kjørbar evidens** som viser faktisk systemtilstand (skjermbilder, loggfiler, HTTP-svar, test-/playwright-output) lagret som **filer** som kan verifiseres.
2. **Manifest eller indeks** som lister hvert bevisfilnavn og — der det er mulig — **hash, størrelse og tidspunkt** for samme run.
3. **Korrelasjonsnøkkel for én run**: `runStartedAt` / `runFinishedAt` eller tilsvarende, slik at gates, playwright-kommando og binære filer kan knyttes til **samme** kjøring.
4. Der proof krever UI: **PNG/WebP/JPEG** (eller annet avtalt rasterformat) som faktisk finnes på disk og er referert i manifest.

**Tekst som hevder PASS uten tilhørende filer er ikke proof.**

## 2. Hva som IKKE teller som proof

- Manifest alene (JSON/MD) uten de binære eller loggfilene det refererer til.
- README som lister forventede skjermbilder uten at filene finnes i mappen.
- `.gitkeep` eller tom mappe som “plassholdere” for fremtidig proof.
- Lokale kjøringer uten lagrede artifacts.
- “Grønt” uten lagret stdout/stderr/exit-kode fra den aktuelle kommandoen.
- Antakelser om at CI har kjørt uten CI-artifacts knyttet til commit SHA.

## 3. E4-nivå proof (enterprise / auditérbar)

E4 krever **alt** i avsnitt 1, pluss:

- **SHA256** (eller sterkere) per binært bevis der formatet tillater det (jf. `proof-manifest.json`-mønster).
- **Full gate-kjede** for avtalt scope: `typecheck`, `lint`, `test:run`, `build:enterprise`, `sanity:live` der det er relevant for pakken — lagret som **tekst** med exit-kode/spor.
- **Playwright-/e2e-bevis**: kommando, exit-kode, og utvalg av output som beviser én run (ikke bare “det fungerte her”).
- **Ingen manglende filer** i manifest: hver `file`-referanse må eksistere.

## 4. Når manifest alene er utilstrekkelig

Alltid når proof-kravet er **visuell eller binær** (screenshots, PDF, video, traces). Da er manifest kun **indeks**, ikke proof.

## 5. Når lokal run ikke er nok

Når påstanden er **release**, **CI** eller **reproduserbarhet for andre maskiner**:

- Lokal run må erstattes eller supplementeres med **CI-artifacts** (eller ekvivalent lagringssted) med **samme manifestkontrakt** og **commit SHA**.

## 6. Hva som må være fra samme run

- Alle screenshots som hører til én **hypotese** (én e2e-fil / én pakke).
- Gate-filer som inngår i samme **proof-pakke** for samme `runStartedAt`–`runFinishedAt` (eller eksplisitt `rid`/run-id).
- Playwright stdout og manifest for den pakken.

**Blanding** av filer fra ulike `runStartedAt` uten eksplisitt merking = **ugyldig proof-pakke**.

## 7. Repo vs artifact-lager

| Innhold | Repo (git) | Eksternt lager |
|--------|------------|----------------|
| Manifest, gate-tekst, hashes, små JSON | Ja | Kan speiles |
| Store binærfiler (video, store traces) | Kun hvis policy og repo-grenser tillater det | Foretrukket for store filer |
| Hemmeligheter | **Aldri** | Aldre |

Manifest i repo **skal** liste filnavn (og hash der kravet gjelder). Hvis binærene kun ligger eksternt, skal manifestet ha **full URL eller objekt-ID** og **integritet (hash)**.

## 8. Manifest og binære filer

Hver oppføring som beskriver et binært bevis skal inneholde minst: `file`, og der E4 gjelder: `sha256`, `bytes`, `mtime` eller tilsvarende.

**Brudd:** referanse til fil som mangler på disk → **hele pakken ugyldig**.

## 9. Når en proof-pakke er ugyldig

- Minst én manifestreferanse peker på manglende fil.
- Gates eller playwright-bevis mangler for påstått scope.
- Binære filer og manifest er fra **forskjellige** runs uten dokumentasjon.
- Working tree eller commit ikke kan knyttes entydig til proof (se baseline-policy).

**Slutt:** Proof er enten komplett og verifiserbar, eller den er **ugyldig**. Det finnes ingen “delvis godkjent” E4-proof.
