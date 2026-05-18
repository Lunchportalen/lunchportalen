# Volum-seed pipeline: strategi (Rev A)

**Status:** dokumentasjon kun (ingen implementering i denne revisjonen).  
**Valutareferanse:** 1 USD = 9,3266 NOK (samme som [docs/staging-strategy.md](staging-strategy.md), observasjon mai 2026 — bekreft før regnskapsbruk).

---

## TL;DR

Anbefalt første B5-baseline etter aktiv staging: profil MEDIUM (`--size=medium`) med eksplisitte hypoteser for tid og kost (se [Skala-størrelser](#skala-størrelser-smallmediumlarge)).  
Beslutning på audit under seed: kombinasjon (a) aksepter trigger-drevet volum under selve seed-løpet og (b) tillat kontrollert post-seed `TRUNCATE` på `audit_log` på staging med hard gate (project_ref + bekreftelsesflagg), slik at B5 ikke tvinges til kunstig WAL/lagringspress fra syntetisk historikk.

CLI-målbilde (implementeres i B4d):  
`npm run seed:volume -- --size=<small|medium|large> --target-db=... [--dry-run] [--confirm=staging+<project_ref>]`.

---

## Bakgrunn

B5 last-test krever realistisk volum uten GDPR-risiko. [docs/staging-strategy.md](staging-strategy.md) (variant C) forbyr prod-kopi; staging fylles med fullstendig syntetiske data. [docs/audit-log-strategy.md](audit-log-strategy.md) beskriver konservativ steady-state matematikk ved høy DML-rate (71,4 M nye audit-rader/dag ved N = 25 M ansatte og 20 hendelser/uke/bruker, ~2 kB middel per rad) — den modellen skal brukes for planlegging av audit- og lagringspress, ikke lineær ekstrapolasjon fra mikro-prod.

Operativ kode mot database: [docs/hot-paths.md](hot-paths.md).

---

## Discovery-funn

### FK-graf (public) og topologisk rekkefølge

Alle faktiske FK-er hentes fra `pg_constraint` mot `public` ved behov før B4-implementering; nedenfor er den operative skriverekkefølgen som dekker kjernebaner og som er konsistent med prod-FK (mai 2026).

Sirkulær avhengighet som krever to-fase-innsetting (beslutning punkt 3):

1. `INSERT companies` med `default_location_id` satt til `NULL` der det trengs for å unngå tidlig validering mot `company_locations`.
2. `INSERT company_locations` for samme `company_id`.
3. `UPDATE companies SET default_location_id = …` når standardlokasjon skal peke på en rad som nå eksisterer.

Øvrig rekkefølge (samlet, daglig kjøring kan deles i batches innen samme transaksjon der det er trygt):

1. `auth.users` via Supabase Admin API (utenfor `public`, men forutsettes før profiler).
2. `enterprise_groups` (nullable på `companies`).
3. `allergens`, `dietary_tags`, `product_categories`.
4. `companies` (etter to-fase: start uten aktiv `default_location_id` om nødvendig).
5. `company_locations` → deretter ev. `UPDATE companies` for `default_location_id`.
6. `profiles` (`id → auth.users`).
7. `agreements`, `agreement_delivery_days`.
8. `products`, `company_product_prices`, `product_allergens`, `product_dietary_tags`.
9. `location_policies`, `menu_service_days`, `menu_service_day_items`.
10. `platform_user_roles` (test-superadmins ved behov).
11. `company_memberships`, `location_memberships`.
12. `standing_orders` (valgfritt).
13. `orders`, `order_items`, `order_status_history`.
14. `day_choices`, `menu_visibility_days` (etter behov i scenario).
15. Fakturaspor ved behov: `invoice_runs`, `billing_adjustments`, `invoices`, `invoice_lines`, ev. `tripletex_*`.
16. Logistikk: `driver_runs`, `deliveries`, `delivery_runs`, `delivery_run_items`, `kitchen_batches`.
17. Invite/registrering: `company_invites`, `employee_invites`, `company_registrations`, `agreement_requests` (valgfritt).

`audit_log`, `audit_log_legacy` og månedlige barn er ikke måltabeller for manuell seed-radliste; innhold oppstår via triggers (evt. månedlig partisjon etter migrasjonsspor).

Referansetabeller som `billing_tax_codes` og lignende må verifiseres eksplisitt mot gjeldende skjema før B4 bulk (FK kan finnes uten å være med i forkortede tall-lister ovenfor).

### Trigger-impact (staging-relevant)

I prod observeres `AFTER INSERT|UPDATE|DELETE … EXECUTE FUNCTION tg_audit_row()` på 14 tabeller:

`billing_adjustments`, `companies`, `company_contracts`, `company_memberships`, `company_product_prices`, `delivery_runs`, `invoice_lines`, `invoice_runs`, `location_policies`, `menu_service_day_items`, `menu_service_days`, `order_items`, `orders`, `products`.

Vanlig audit-ytelse: typisk èn audit-rad per ikke-skip‑et DML (B2b-1 skipper enkel «kun `updated_at`»‑UPDATE på enkelte spor). INSERT dominerer under seed på mange av disse.

`profiles` har egen spor (`trg_profiles_audit_legacy_scope_write` BEFORE UPDATE på scope-kolonner) og skal ikke blandas med volumantakelser for `tg_audit_row()` ved profil-INSERT — se backlog P3.D1.

Tillegg utenfor kjerne B4:`ai_config` har egen revisjonstrigger; hold utenfor volum-kjerne om ikke eksplisitt scenario.

### Snapshot-felt (`%_snapshot` i public, utdrag)

Oppdaget i `information_schema` på `public` (utkastliste): `order_items` (`allergens_snapshot`, `dietary_tags_snapshot`, `product_name_snapshot`, `unit_name_snapshot`, `vat_rate_snapshot`), `menu_service_day_items` (produkt/navn/mva‑snapshots), `day_choices.item_title_snapshot`, `delivery_run_items.product_name_snapshot`, arkiv-/eventuelle legacy-stub‑tabeller, `company_deletions` (firmalogo/navn ikke del av volum-seedkjerne).

Staging-regel jf. B3 variant C og audit-strategien: art. 9‑relevant innhold (`allergens_snapshot`, `dietary_tags_snapshot`) skal være `NULL` eller tomt strukturelt konsistent uten sensitiv mening (ingen helsedata i syntetiske menyer eller notater). øvrige snapshots skal ha realistiske verdier der app/kalkyle krever det (typisk `vat_rate_snapshot` som desimal mellom 0 og 1 jf. `lp_order_set`‑konvensjoner).

`order_items` fylles delvis av `tg_order_item_snapshot`; seed-planen må respektere eksisterende triggerflyt eller eksplisitt sette konsistente felt.

---

## Tabell-klassifisering

### SEED-CRITICAL

Nødvendig for operative hot-paths og representativ last: `profiles`, `companies`, `company_locations`, `company_memberships`, `location_memberships` der lokasjon brukes, `agreements`, `agreement_delivery_days`, `products`, `product_categories`, `company_product_prices`, `menu_service_days`, `menu_service_day_items`, `location_policies`, `orders`, `order_items`, `day_choices`, kjøkken/logistikk etter scenario (`kitchen_batches`, `delivery_runs`, `delivery_run_items`, `deliveries`, `driver_runs`). Referanse: små volum i `allergens`/`dietary_tags`/`koblingstabeller` om UI skal liste tags uten violating art. 9 i snapshots.

### SEED-OPTIONAL

Dekningsbredde og økonomi: `invoice_runs`, `invoices`, `invoice_lines`, `billing_adjustments`, `tripletex_customers`, `tripletex_invoices`, onboarding/CRM (`company_invites`, `employee_invites`, `company_registrations`, `standing_orders`, `lead_pipeline`), produksjon/ESG/overvåking, innhold-/AI-/growth‑subgraf ved behov.

### SEED-EXCLUDE

Manuelt fyll av revisjons_HEAP som bare skal oppstå via drift: `audit_log` hierarkiet (parent + barn + legacy), arkiv stubs `_migration_*`, og tabeller som krever egen DPIA før meningsfull kopierbarhet. Sanity CMS‑innhold seedes ikke i B4 (egen sak / B3c).

---

## GDPR-realitet (syntetisk data)

Epost: `@example.com` eller `example.invalid` (reserverte domener, RFC 2606 / 6761). Navn kan genereres deterministisk (faste seed‑offsets) eller hentes fra offentlige statistiske fornavnslister kombinert med syntetiske etternavnsstammer — uten målrette ekte privatpersoners fulle navn som «bevis». Adresser: kombiner strukturerte norske postnummer-/poststedsfiler med syntetiske gatenavn; ikke kopier konkrete gårds-/bruksenheter fra offentlige folkeregistersøk eller karttjenester.

Telefon (beslutning punkt 2): bruk struktur **`+47 20 00 XX XX`** (siste siffer varieres deterministisk per rad) som standard testprefiks. Serien `20` er vanlig brukt som eksempel/test i norsk nummerplan-kontekst; før endelig operasjonell policy i staging skal aktiv status som ikke-tildelt/ikke-routet intervall verifiseres mot Nkom / gjeldende nummerplan (offisiell kilde som primary reference i runbook). Ikke bruk treff på ekte mobilblokker (typisk 4xxxxxxx / 9xxxxxxx) som «tilfeldige» plassholdere uten kilde.

Fødselsnummer skal ikke lagres i syntetisk seed med mindre feltet finnes og da kun med strukturelt ugyldige testmønstre utenfor faktisk tildelingsrom.

Deterministisk datasett gir reproduserbarhet; det eliminerer ikke kravet om at innholdet skal være klart syntetisk og uten hensikt om gjenkjenning av ekte personer.

---

## Skala-størrelser (SMALL / MEDIUM / LARGE)

| Profil   | Firmavolum × ansatte/firma | N (ansatte) |
|----------|----------------------------|-------------|
| SMALL    | 500 × 100                  | 50 000      |
| MEDIUM   | 5 000 × 500                | 2 500 000   |
| LARGE    | 25 000 × 500               | 12 500 000  |

Alle tids- og kostnadsantakelser for seed-kjøring nedenfor er merket hypotese — de skal erstattes av målinger på aktiv staging etter B4b.

Hypotese (tid): SMALL «omtrent noen minutter», MEDIUM «omtrent en halvtime ordenes størrelse», LARGE «flere timer» ved en enkelt node og konservativ batching. Hypotese (lagring): ikke bruk enkle lineære «N × 5 kB» i regnskap uten `pg_total_relation_size` etter faktisk seed.

Steady-state audit (ikke seed-spike, hypoteser fra audit-strategi): med 20 hendelser/uke/bruker og ~2 kB/rad: N = 50 000 → ~0,14 M rader/dag; N = 2,5 M → ~7,14 M rader/dag; N = 12,5 M → ~35,7 M rader/dag. Bruk disse for kapasitetsplan, ikke ekstrapolasjon fra dagens mikro-prod.

---

## Datadistribusjons-modell

Firma-størrelse: vektet fordeling som reflekterer norsk SMB (typisk tolkning: ~80 % under 50 ansatte, ~15 % 50–500, ~5 % 500+), implementert deterministisk fra seed. Ordreintensitet over døgn: topper morgen (08–10) og lunsj (11–13), lavere ettermiddag, helg nær null med mindre scenario sier annet. Menyvalg: power-law (få populære retter dominerer). Geografi: cluster rundt Oslo, Trondheim, Bergen med realistisk postnummerfordeling uten punktpresisjon mot enkeltpersoner.

---

## Bulk-insert-strategi

Primært: `COPY` eller server-side multi-row `INSERT` i transaksjoner via direkte Postgres-tilkobling (service_role / pooler med kontrollert samtidighet). REST-bulk via PostgREST er sekundært for multimillion-rader.

Hypotese (batch): start 1k–5k rader per transaksjon; eskalér til 10k etter måling. 50k+ per batch er risikabelt for WAL/rollbackflate til bekreftet.

Hypotese (parallelitet): start med ≤4 samtidige writers; øk kun etter observerbar metrikk (ventetid, pool, timeouts).

Supabase-spesifikke rate limits er mindre relevante enn Postgres connection limits og `statement_timeout` ved tunge jobber.

---

## Trigger-håndtering under seed (audit_log-trade-off)

Beslutning (punkt 1 — staging only):

a) Aksepter at `tg_audit_row()` genererer stort audit-volum under seed (realistisk for senere churn/WAL-testing). Ikke gjør global trigger-deaktivisering til standard — det bryter sikkerhet og kan skjule regressjoner og partisjonvirkning.

b) Etter vellykket integritets-/fordelingssjekk (B4c) kan staging kjøre en eksplisitt post-seed `TRUNCATE` på `audit_log` (kun når partisjonsoppsett tillater det på parent; bruk dokumentert kommando eller `ONLY`/barn-strategi i tråd med migrasjonsspor fra B2c) — med hard gate:

- `ALLOW_AUDIT_TRUNCATE_AFTER_SEED=true` eller tilsvarende eksplisitt flagg og
- `CONFIRM=staging+<forventet project_ref>`
- kjøringsscript avviser kjøring hvis `project_ref`/URL ikke matcher allowlist.

Prod: ikke en del av denne playbooken.

Forvent spike-volum før truncate som funksjon av antall audited INSERT/UPDATE/DELETE under seed (typisk domineres av `company_memberships`, `order_items`, `orders`, `products`, menyer avhengig av scenario).

---

## Reset/teardown-strategi (sikkerhetsdesign)

Teardown er eget entrypoint fra seed (ikke implisitt). `TRUNCATE … CASCADE` bare mot tabell-whitelist i staging. `ALTER SEQUENCE … RESTART` der default bruker sekvenser. Post-seed audit-truncate er egen operasjon med gate (se over). Alltid: forhåndsvisning med `--dry-run` (radtellinger og plan, ingen mutasjon). Service_role med RLS-bypass krever hemmeligheter som aldri gjenbrukes fra prod i utvikler `.env` uten kryptografisk separasjon.

---

## Cost-impact mot B3-budget

Hypotese: persistert micro-branch compute-linje forblir i størrelsesorden beskrevet i staging-strategi (~92 NOK/mnd kun branching-compute uten disk-burst). Lagrings- og WAL-vekst under MEDIUM/LARGE seed kan midlertidig øke diskforbruk — kun målebar via Supabase dashboard etter kjøring. Mot budget-cap anbefalt kr 800/mnd: ingen konklusjon om overskridelse uten faktisk dashbord etter seed; dokumenter faktisk GB og eventuelle add-on-linjer når tall foreligger.

---

## Sub-task implementeringsplan (B4a–B4d)

| ID   | Scope | Risiko | Rollback |
|------|--------|--------|----------|
| B4a  | Dataobjekt-generatorer (deterministisk), art. 9-null policy, distribusjonsmodell, telefonformat + verifikasjons-task for `employee_order_items` (relkind: base table vs view) før noen INSERT-plan låses | Lav kode, høy compliance ved feil snapshot | Teardown whitelist |
| B4b  | Bulk-pipeline: COPY/chunked INSERT, batch/parallel-kontroll, metrikk (tid, WAL-proxy via size delta) | Pool exhaustion, timeouts | Truncate + reseed |
| B4c  | Verifikasjon: row counts, FK-sjekk, histogrammer, audit-før/etter ved valgt strategi | Feil partisjonsmåling | Gjenkjør fra tom DB |
| B4d  | CLI: `--size`, `--target-db`, `--dry-run`, `--confirm`, env-guard for project_ref | Feil mål-DB | Ingen auto-rollback; krever backup/branch reset |

---

## Risikomatrise (kort)

| Risiko | Mitigering |
|--------|------------|
| Feil `project_ref` / prod impact | Hard allowlist, dry-run, separate credentials, ingen delt «prod service_role» i dev-filer |
| Connection pool exhaustion | Lav konkurranse, backoff, måling |
| WAL/disk spike | Batch-størrelse, færre unødvendige UPDATE under seed, staging-only post-seed audit truncate etter sjekk |
| Audit-volum under seed | Aksepter + staging truncate med gate (beslutning 1) |
| Trigger-deaktivisering | Ikke standard; unntak krever egen sikkerhetsreview utenfor denne strategien |

---

## Rollback-strategi per fase

- B4a: slett ubrukt kodegrein; ingen DB-side effekt.
- B4b: staging `TRUNCATE` whitelist + re-run fra kjent snapshot; ev. gjenopprett branch fra Supabase hvis tillatt i driftspolicy.
- B4c: ingen varig effekt (read-only verktøy).
- B4d: CLI uten kjøring — null effekt; etter feilkjøring bruk samme teardown som B4b.

---

## What this DOES NOT do

Implementerer ikke B4-kode, endrer ikke triggers, RLS eller skjema, kjører ikke seed mot noen database i denne commiten, omfatter ikke Sanity-meny seed, og erstatter ikke juridisk DPIA der art. 9 eller finansiell etterlevelse krever eget vedtak.

---

## Avhengigheter mot B3

Før B4a starter for alvor:

- B3a: aktiv staging-branch (eller tilsvarende ikke-prod) med migrasjonssync lik prod-mønster.
- B3f: foundation `scripts/seed-staging.ts` (eller avtalt fil) for syntetikk uten art. 9.
- B3b–B3e etter behov for at CLI og hemmeligheter er isolert fra prod (Vercel staging, env-dokumentasjon, DNS ved manuell test).
- B3c: ikke en teknisk blocker for ren Postgres-volum, men nødvendig for full representativ app-røyk med ekte CMS-flyt.

---

## Referanser

- [docs/audit-log-strategy.md](audit-log-strategy.md)  
- [docs/staging-strategy.md](staging-strategy.md)  
- [docs/hot-paths.md](hot-paths.md)  
- [docs/performance-p-backlog.md](performance-p-backlog.md)
