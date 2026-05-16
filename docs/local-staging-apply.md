# Lokal staging-apply (Supabase + RLS-verktøy)

Kort guide for å verifisere migrasjoner og RLS-relaterte tester mot lokal Postgres før prod-apply.

## Forutsetninger

- **Docker Desktop** installert og **daemon kjørende** (`docker ps` skal fungere uten feil om `dockerDesktopLinuxEngine`).
- **Supabase CLI** (`supabase --version`) i PATH.
- **WSL2** er vanlig forutsetning på Windows (Docker Desktop).

## `.env.local` og Supabase CLI

Supabase CLI leser `.env.local` ved mange kommandoer. Feil format gir parse-feil før databasen startes.

Sjekkliste:

1. **UTF-8 uten BOM** (anbefalt). BOM kan gi merkelige feilmeldinger når filen parses.
2. **Variabelnavn**: ingen ledende eller etterfølgende mellomrom i navnet før `=`. Bruk `NØKKEL=verdi`, ikke `NØKKEL = verdi`.
3. **Unngå typografiske anførselstegn** (‚ », «, osv.) i navn eller i kopiert tekst fra Word/Notion/Slack i kommentarer hvis du ser rar parsing — hold kommentarer til ren UTF-8 eller enkle ASCII-tegn.
4. **Unngå `--debug` på `supabase`** mot arbeidskopier med hemmeligheter; debug kan skrive store deler av miljøfilen til stderr.

Etter endringer: `supabase status` skal ikke feile på «parse environment file».

**Merk:** Root-flagget `--no-color` finnes ikke på alle Supabase CLI-versjoner; bruk `supabase status` som den er.

### Rask verifisering (ingen hemmeligheter i logg)

- **BOM:** Filen bør være **UTF-8 uten BOM**. Hvis de tre første bytene er `EF BB BF`, har fila fortsatt BOM (noen editorer legger den på igjen ved lagring).
- **Nøkkelformat:** Én linje = `NAVN=verdi` eller `export NAVN=verdi` — **ikke** mellomrom før/etter navnet, **ikke** `NAVN = verdi`.
- Ved `unexpected character '»' in variable name`: ofte **BOM** eller **mellomrom rundt `=`**; sjeldnere et faktisk `»` i fila. Unngå `supabase … --debug` (dumper `.env.local` til stderr).

## Oppstart lokal database

```powershell
cd c:\prosjekter\lunchportalen
supabase status
supabase db start   # første gang / etter stopp
supabase db reset   # kjører alle migrasjoner (tar ofte 1–3 min)
```

Verifiser at migrasjoner er konsistente (forvent tomt diff mot modell):

```powershell
supabase db diff
```

### Migrasjonsnavn (CLI-krav)

Supabase CLI utleder migrasjonsversjon fra filnavnets tidsstempel-del. **To filer som deler samme versjonsprefiks** (f.eks. begge starter med `20260204_…`) gir typisk `duplicate key … schema_migrations_pkey` ved `db reset` / `db diff` (shadow DB). Da må filene få **unike** tidsstempel-prefiks etter prosjektets konvensjon.

Filer som **ikke** matcher mønsteret `tttttttttttt_name.sql` (kun ett `_` mellom tidsstempel og navn; f.eks. `20260513a_…` med bokstav i tidsstempel) meldes som **Skipped** og kjøres ikke.

## `DATABASE_URL` for tester og drift-script

Standard lokalt (Supabase CLI, default-port):

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres?sslmode=disable"
```

### Vitest (migration parity)

Standard `vitest.config.ts` **ekskluderer** `tests/rls/**`. Bruk RLS-profilen:

```powershell
npx vitest run --config vitest.rls.config.ts tests/rls/migrationParity.test.ts
```

På ren kun migrasjons-bootstrap forventes ofte **feil** sammenlignet med full prod-RLS — det er nyttig å se at testen **ikke** skipper når `DATABASE_URL` er satt.

### RLS-drift

```powershell
node scripts/check-rls-drift.mjs
```

Mot lokal DB uten prod-paritet forventes typisk **exit 1** (drift) — det bekrefter at scriptet kjører og reagerer.

## Hva lokal reset **ikke** garanterer

Lokal `supabase db reset` bruker migrasjonene i repo. **Full RLS-paritet med prod** (alle policies) kommer bare inn når de er fanget i migrasjoner; opp til flere hundre policies kan mangle lokalt til de er eksplisitt migrert.

## Blokkeringer (hvis noe feiler)

- **`docker ps` feiler** eller `supabase status` sier **`dockerDesktopLinuxEngine`** / **«failed to inspect container health»**: Docker Desktop kjører ikke eller motoren er ikke oppe. Start Docker Desktop manuelt (GUI). Dette er **ikke** en `.env.local`-parse-feil.
- **`failed to parse environment file: .env.local`**: Rett filen manuelt (BOM, `NAVN=verdi`, ingen mellomrom rundt `=`); ikke commit `.env.local`. Unngå `supabase … --debug` (dumper innhold til stderr).
- Etter **utilsiktet lekkasje** av miljøvariabler via debug-logg: roter berørte hemmeligheter.

### Verifisere én nøkkel uten å lekke verdi

`findstr` skriver hele linjen (inkl. hemmelighet) til konsollen. Foretrekk f.eks.:

```powershell
Select-String -Path .env.local -Pattern '^SUPABASE_DB_PASSWORD=' |
  ForEach-Object { "$($_.LineNumber):$($_.Line -replace '=.*','=<redacted>')" }
```
