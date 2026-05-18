# Audit Log: Skala-strategi (Rev A)

**Status:** plan — kun dokumentasjon · **Ingen** DB-endringer, ingen migrasjoner, ingen kode i denne leveransen.

**Kilde:** Performance baseline [Rev A](performance-baseline-rev-a.md) (commit `5357d516`). Readonly discovery mot prod (mai 2026): `public.audit_log` var topp på størrelse og `seq_scan` per `pg_stat*`-snapshot; videre analyse viste at årsaken primært er **trigger-drevet radnivåaudit med full JSONB-rad** (ikke superadmin-«hendelsesfeed» som går via `audit_events`).

---

## TL;DR

- **Volum vil eksplodere ved skala** så lenge hver DML på **14 audited** tabeller skriver **full `old_data` + `new_data` som JSONB** (ved `UPDATE`: begge fullrader ⇒ **dobbel payload**).
- **Modell (konservativ konvolutt):** ved **50K firma × 500 ansatte** (25M brukere), **20 audit-hendelser/uke/bruker** ⇒ **~71,4M nye `audit_log`-rader/dag** ved lineær modell. Ved **~2 kB middel per rad** ⇒ **~143 GB/dag** rå vekst før retensjon (**~4,3 TB/mnd** ved 30 dagers akkumulering uten drop). **Konvolutten kan avvike ± ordenes størrelse** — den **må måles** mot faktisk INSERT-rate etter B2b (se [Volum-baseline måling](#volum-baseline-måling)).
- **Struktur før 1K firma:** **B2b** (smal trigger) → **B2c** (månedlig RANGE-partition på `created_at`) → **B2d** (retensjon + drop partition) → **B2a** (indekser) — se [Implementeringssekvens](#implementeringssekvens-kritisk-rekkefølge).
- **GDPR art. 9 — helsedata i JSONB-snapshot er uakseptabelt uten eksplisitt grunnlag.** Fjern **Allergen/kosthold**-snapshots fra audit-payload **umiddelbart** i B2b-2 ([GDPR art. 9 helsedata-risiko](#gdpr-art-9-helsedata-risiko)).

---

## Discovery-funn — skala-matematikk

### Faktisk prod-snapshot (sub-skala)

| Mål | Verdi (ca.) |
|-----|-------------|
| Tabellstørrelse | ~38 MB (`pg_total_relation_size`) |
| Rader | ~18,8k (`n_live_tup`) |
| `seq_scan` vs `idx_scan` | ~2472 vs 4 (indikerer **lite bruk av indekser** og/eller statistikk/autoanalyse) |
| Indekser på `audit_log` | `PRIMARY KEY (id)`, `idx_audit_log_actor_user_id` — **ingen** `created_at`, `table_name` |

### Trigger-mekanisme (14 tabeller)

Funksjon **`public.tg_audit_row()`** (SECURITY DEFINER, `search_path` tomt): ved **INSERT / UPDATE / DELETE** på bl.a. `companies`, `company_memberships`, `orders`, `order_items`, `menu_service_days`, `menu_service_day_items`, `products`, `billing_adjustments`, `company_contracts`, `company_product_prices`, `delivery_runs`, `invoice_lines`, `invoice_runs`, `location_policies` skrives én rad til `audit_log` med **hele raden** som `to_jsonb(old)` / `to_jsonb(new)`.

- **Ingen** filtrering (f.eks. «bare hvis noe annet enn `updated_at` endret seg»).
- **Ingen** redaksjon, hashing eller kolonnefiltrering i dag.

`pg_partman` er **ikke** installert. Eneste partitionering funnet: **`realtime.messages`** (ikke `public`).

### Modell: hendelser per bruker

**Antakelser (planleggingskonvolutt, ikke lovpålagt sannhet):**

- **N** = antall ansatte = `antall_firma × 500`.
- **20** audit-hendelser per ansatt per uke (samlet over alle audited tabeller og DML-type).

**Audit-rader per dag (modell):**

`rader/dag = N × (20 ÷ 7)`

**Rå lagringsvekst per dag** (lineær modell, middelradstørrelse **S** byte):

`GB/dag ≈ (N × 20 × S) ÷ (7 × 10^9)`

med **S ≈ 2048 B** (2 kB) som referansepunkt (API/ordrerader med notatfelt kan være **større**).

### Per-milestone (500 ansatte per firma)

| Milestone | Ansatt-masse (N) | Rader/dag @ 20/uke | ~GB/dag @ 2 kB/rad | ~GB/mnd @ 30 d |
|-----------|------------------|--------------------|--------------------|----------------|
| **1K firma** | 0,5M | **~1,43M** | **~2,9** | **~87** |
| **5K firma** | 2,5M | **~7,14M** | **~14,3** | **~430** |
| **50K firma** | 25M | **~71,4M** | **~143** | **~4 300** (= ~4,3 TB) |

**«1/10 konvolutt»** (same N, 2 hendelser/uke «ekvivalent» eller lavere DML): divider med 10 → f.eks. **~14,3 GB/dag**, **~430 GB/mnd** @ 50K.

**Akkumulasjon uten retensjon:** ved **1K firma** og **~2,9 GB/dag** er **~522 GB på ~6 måneder** (180 dager × 2,9 GB) — rundt av til **~500 GB innen 6 mnd** som planfase for risiko.

### Per-tabell orden (illustrativ)

| Kilde | Illustrativ antakelse | Kommentar |
|--------|----------------------|-----------|
| `orders` | mange DML/ansatt/uke | **Dominerende** hver ordre-livssyklus treffer tabellen ofte |
| `order_items` | flere linjer per ordre + oppdateringer | Ofte **>1×** volumet av `orders` |
| `company_memberships` | ~1 endring/ansatt/måned (snitt) | **~0,83M** inserts/updates/dag @ 25M ansatte |
| `companies` | lav absolutt rate, men **PII-tung** | Få rader/høy sensitivitet per rad |
| `menu_*` | avhenger av locations og menybredde | Kan spikke ved publisering |
| Økonomiske tabeller (`invoice_*`, …) | batch-kjøringer | Korte vinduer med høyt volum |

**Konklusjon:** Lineær ekstrapolasjon fra **3 firma** er irrelevant; konservativ **N × 20/uke** konvolutt er et **stress-case** som viser behov for **partition + retensjon + smal payload** før skala tar knekken på kost/WAL/backups/restores.

---

## GDPR art. 9 helsedata-risiko

**Særskilt kategori personopplysninger** (helsefortrolige opplysninger eller opplysninger som ved avledning beskytter sensitiv livssituasjon — jf. GDPR art. 9) er **ikke** ting vi kan «bake» inn i generell revisjons-JSON uten **eksplisitt** behandlingsregime.

### Konkret per felt (kopiert inn i `audit_log` via dagens `to_jsonb`)

| Kilde | Felt(er) | Vurdering |
|-------|----------|-----------|
| `order_items` | `allergens_snapshot` | **Helsedata (art. 9)** · sterkt sensitiv |
| `order_items` | `dietary_tags_snapshot` | Kan anses **særskilt** (helsekost/religion/etikk — kontekstavhengig) |
| `profiles` *(ikke auditert i dag — **advarsel ved fremtidig utvidelse**)* | `allergy_notes`, `dietary_notes` | **Art. 9** hvis noen gang inkluderes i trigger-audit |

### Rettslig og praktisk krav

Lagring i `audit_log` som **full JSONB-snapshot** med ovennevnte felt krever minst én av:

- **Eksplisitt rettslig grunnlag** som dekker både **art. 6** og **art. 9** (inkl. ev. medlemslandsfortolkning), **eller**
- **Samtykke** som er **spesifikt** for audit-formål og informasjonskrav oppfylt, **eller**
- **Eksklusjon** av disse feltene fra trigger-payload (**anbefalt standardløsning** inntil DPO/jurist har definert et kontrollert regime).

### Anbefaling (teknisk, avventer DPO)

- **B2b-2:** Ekskluder **`allergens_snapshot`**, **`dietary_tags_snapshot`** (og tilsvarende notatfelt fra `order_items`) fra `old_data`/`new_data` som skrives til `audit_log`.
- **Ikke** logg helsedata i generell revisjonslogg **uten** DPO/jurist — se [DPO/jurist required](#dpojurist-required).

---

## Faktisk bruk av `audit_log`

### Write path

- **Trigger-drevet:** `tg_audit_row` på **14** tabeller (se over); hoveddriver for vekst.
- **App:** `POST /api/superadmin/audit-write` har **fallback** til `audit_log`, men payload er **ikke** kompatibel med prod-`audit_log` (CHECK på `action` ∈ INSERT/UPDATE/DELETE + annet skjema) — i praksis **skriver superadmin til `audit_events`**, ikke til denne tabellen.

### Read path

- RLS: policy **`audit_log_select`** for `authenticated` med `USING (SELECT private.is_platform_admin())` — **ikke** generell company_admin-lesing.
- **Ingen dokumentert applikasjonsleser** av `audit_log` i dag; `lib/superadmin/queries.ts` (`listCompanyAudit`, `listAuditGlobal`) har **feltliste som ikke matcher prod** og er **ikke referert** — **P3 hygiene** (**B2-prelude**, se backlog).

### Skjemareferanse prod (`audit_log`)

Kolonner: `id bigint`, `actor_user_id`, `table_name`, `record_id`, `action` (INSERT|UPDATE|DELETE), `old_data`, `new_data`, `changed_at`, `created_at`.

**Repospor:** ingen `CREATE TABLE public.audit_log` i gjeldende migrasjonsspor; FK-indeks `idx_audit_log_actor_user_id` finnes i `20260510143500_add_missing_fk_indexes.sql`.

---

## Trigger-payload per audited tabell (kolonneskygge og PII)

Hele kolonnelisten for hver kilde-tabell kommer fra `information_schema.columns` (mai 2026). Under: **klassifiserte høyrisiko-kolonner** som i dag kopieres med i JSONB ved DML.

| Tabell | PII / sensitivt / merknad |
|--------|---------------------------|
| **companies** | `name`, `contact_name`, `contact_email`, `contact_phone`, `address`, orgnr-variante, `billing_email`, `delete_reason` |
| **company_memberships** | `user_id`, `employee_number`, `cost_center` |
| **orders** | `user_id`, `note`, `customer_note`, `internal_note`, `cancel_reason`, beløpskolonner (økonomi) |
| **order_items** | **`allergens_snapshot`, `dietary_tags_snapshot` (art. 9)**, `notes` |
| **delivery_runs** | `courier_note`, `kitchen_note`, `received_by` |
| **invoice_lines** | `description`, `basis` (jsonb), `user_id` |
| **invoice_runs** | `external_invoice_ref`, beløpsfelter |
| **billing_adjustments** | `description` |
| **company_contracts** | `notes` |
| **company_product_prices** | mest prisinformasjon |
| **menu_service_days**, **menu_service_day_items**, **products**, **location_policies** | hovedsakelig operative data; snapshots kan inneholde produkttekst |

**profiles** *(ikke i trigger i dag)*: `email`, `full_name`, `phone`, `allergy_notes`, `dietary_notes` — **ekstrem art. 9/PII** hvis triggers utvides.

### Narrow logging — målretting

- **Minimum revisjon:** `table_name`, `record_id`, `action`, kolonnenivå eller **Tillatt sett** av ikke-sensitive felter, tidsfelt.
- **Ekskluder:** art. 9-feltene ovenfor (obligatorisk i B2b-2) og bred PII-unngå via B2b-3/B2b-4 etter kartlegging.

---

## Prioritet — P1 / P2 / P3

| Prioritet | Når | Arbeidspakker |
|-----------|-----|----------------|
| **P1** | **Før 1000 firma** | **B2b-1**, **B2b-2**, **B2c**, **B2d** (+ DPO for B2d) |
| **P2** | **Før 5000 firma** | **B2a**, **B2b-3**, **B2b-4** (vurdering) |
| **P3** | Løpende hygiene | **B2‑prelude** (kodemismatch) |

---

## B2b — trigger-revisjon (underoppgaver)

Hver understakk skal leveres som **egen commit** og med **målt effekt** (før/etter: radstørrelse, `n_tup_ins`, stikkprøve-rader).

| ID | Beskrivelse |
|----|-------------|
| **B2b-1** | **Skip `updated_at`-only updates** — enkel sammenligning `old` vs `new` uten `updated_at` (eller tilsvarende trygg diff); test at integritetsjobber ikke krever «touch-audit». |
| **B2b-2** | **Ekskluder art. 9 helsedata** — `order_items.allergens_snapshot`, `dietary_tags_snapshot` (og evt. `notes` hvis DPO krever); ingen helsedata i `audit_log` uten vedtak. |
| **B2b-3** | **Per-tabell allowlist** for ikke-PII / lav-PII felter (mer kompleks; krever tabell-for-tabell design). |
| **B2b-4** | **PII-hashing** for felt som må spores uten å lagres i klartekst (valgfritt etter juridisk avklaring). |

---

## Foreslått strategi — partitionering (B2c)

- **RANGE på `created_at`**, typisk **`PARTITION BY RANGE (created_at)`** med **månedlige** barn (`FOR VALUES FROM (...) TO (...)`).
- **Månedlig** heller enn ukentlig: færre objekter, naturlig kobling til **månedlig retention/drop**.
- **Migrering (konsept, IMPLEMENT-commit):**
  1. Opprett partitionert forgjenger-tabell og pre-create måned-partisjoner (historikk + forkant).
  2. Kopier eksisterende rader (**38 MB er fortsatt «billig vindu`**).
  3. Replay **constraints, indexes (minimum), triggers på kildetabeller**, **RLS-policyer** på parent.
  4. Atomisk **`RENAME SWAP`** under kontrollert vedlikeholdsvindu; behold `*_legacy` til verifikasjon.
- **`pg_partman`:** ikke i bruk; kan vurderes senere eller **månedlig `CREATE PARTITION` via `pg_cron`**.

Deres Supabase-/Postgres-major er beskrevet i baseline (Postgres 17.x). Valider eksakt syntaks og lås på **staging branch / clone** før prod.

---

## Foreslått strategi — retensjon (B2d)

- **Mekanisme:** **`DROP PARTITION`** (evt. `DETACH` + arkiv + `DROP`) — unngå massive `DELETE` mot en enkelt heap.
- **Perioder (utkast — endelig tall = DPO/jurist):** operativ **hot** (f.eks. 30–90 dager), eventuell **warm** arkiv for delmengder med **bokføringsmessig behov** (typisk **5 år** diskuteres for regnskapsgrunnlag — **ikke vedtatt her**).
- **Arkiv:** valgfritt **S3 / object storage** i **Parquet eller NDJSON.gz** med **kolonnefiltrert** eksport og **tilgangskontroll** — teknisk løsning velges i egen arkitektur-oppgave.

**DPO/jurist påkrevd før implementasjon** — se neste kapittel.

---

## Foreslått strategi — indekser (B2a, P2)

Etter **partitionering** og kjente lesemønstre (om noen): typiske kandidater på **barn** / parent:

- `(created_at DESC)` eller `(created_at DESC, id DESC)` for «siste hendelser».
- `(table_name, created_at DESC)` for feilsøking per opphavstabell.

**Ikke** bulk-GIN på `old_data`/`new_data` som hot default (kostbart). Mål med `EXPLAIN` på staging.

---

## Tidsplan ved aktiv onboarding

Forutsetning: **~2,9 GB/dag** og **~87 GB/mnd** @ **1K firma** uten retensjon (se tabell over). Juster pro rata hvis onboarding er treigere.

| Gate | Anbefalt innhold |
|------|-------------------|
| **Før 100 firma** | **B2b-1**, **B2b-2** (art. 9-eksklusjon) **deployet og målt** |
| **Før 500 firma** | **B2c** (partitioning) + **B2d** (DPO-vedtak + drop-old-cron) **i produksjon** |
| **Før 1000 firma** | Alt over **må** være på plass + **B2a** (indekser) |
| **Før 5000 firma** | **B2b-3**, **B2b-4** **vurdert/implementert** etter behov; **alle DPO-vedtak** for retensjon ferdig |

Hvis volum **leder** onboarding (plutselig bulk-import), **fremskriv** datoene proporsjonalt — **måling slår kalender**.

---

## Volum-baseline måling

**Formål:** validere eller avvise volum-modellen **før** irreversibel **B2c**-migrering på feil antakelser.

**Etter B2b er i prod:**

1. Ta stikkprøve av **`pg_stat_user_tables.n_tup_ins`** (og ev. `n_tup_upd` på kildetabeller) for `audit_log` **før** og **etter** B2b-deploy (noter tidsvindu og antall timer/dager).
2. Sammenlign med forventet orden: `firma × ansatte × aktivitet` og forretningsmetrikker (ordrer/dag, meny-publisering, …).
3. Hvis avvik **> ~2–10×** fra modell (eller tegn til systematisk feil), **pause B2c** og revider plan / trigger-scope.

**Merk:** `n_tup_ins` er kumulativ siden stat reset — dokumenter **delta** over faste tidsvinduer eller bruk periodisk snapshot-prosedyre.

---

## Implementeringssekvens (kritisk rekkefølge)

**Anbefalt:** **B2b → B2c → B2d → B2a**

| Rekkefølge | Pakke | Begrunnelse |
|------------|--------|-------------|
| 1 | **B2b** (B2b-1 → B2b-2 → senere B2b-3/4) | Reduserer **ny** payload (art. 9 + støy), senker **WAL/IO** under migrering og daglig drift. Eksisterende rader endres **ikke** uten egen backfill. |
| 2 | **B2c** | Gjør **DROP PARTITION** billig; **billigst migrering mens tabellen er liten** (O(10 MB–GB) vs TB). |
| 3 | **B2d** | Uten TTL vokser selv «smale» rader mot uholdbar kost; ** krever DPO-vedtak**. |
| 4 | **B2a** | Indekser på **stabil partition-struktur** og kjente spørringer — unngår dobbelt arbeid. |

**B2b-3 / B2b-4** flyttes som **P2** når P1-kritisk båndbredde er under kontroll.

---

## Risiko og mitigering

| Risiko | Mitigering |
|--------|------------|
| Lang **COPY** / navneswap feiler under B2c | Kjør på **clone**; behold `audit_log_legacy`; idempotent runbook. |
| RLS/policies arves feil til partition parent | Sjekkliste mot `pg_policy` + test med **ikke**-admin bruker. |
| **Art. 9** i historiske rader | B2b-2 stopper **ny** smitte; vurder ** backfill-sanering** eller ** kortere retention** for gamle partisjoner etter DPO. |
| Pruning utelater felt som trengs i tvist | Juridisk **kravmatrise** før B2b-3; ev. **delt logg** (økonomi vs operasjon). |
| Feil estimat på volum | [Volum-baseline måling](#volum-baseline-måling) før full B2c-prod. |

---

## Rollback per fase

| Fase | Rollback |
|------|----------|
| **B2b-1 / B2b-2** | `CREATE OR REPLACE FUNCTION` til forrige versjon (versjoner funksjon i migrasjon); verifiser trigger fortsatt peker til riktig navn. |
| **B2c** | Behold `audit_log_legacy`; bytt navn tilbake til produksjonsnavn under kontrollert vindu hvis kritiske feil **før** avhending av legacy. |
| **B2d** | Stopp cron / jobb — **data i droppet partition kommer ikke tilbake** uten backup/arkiv; planlegg **legal hold** før drop. |
| **B2a** | `DROP INDEX CONCURRENTLY` (mønster velges i IMPLEMENT) per indeks. |
| **B2b-3 / B2b-4** | Tilbake til forrige allowlist/hash-regler; dokumenter avhengigheter til rapporter. |

---

## DPO/jurist required

Følgende er **ikke** tekniske beslutninger og skal **ikke** vedtas av utvikler alene:

- **Retensjon per kategori** av audited tabell / forretningsformål (operativ vs regnskapsrelevant).
- **Bokføringsloven** spørsmål: **Minimum** lagring for grunnlagsdata (ofte **5 år** diskuteres — **konkret per dataelement avklares med jurist**).
- **Art. 17** (rett til sletting) vs **legitime grunner** / **regnskapsplikt** — hvordan `audit_log` og primærdata samvirker.
- **Art. 9** — om noen helsedata ** i det hele tatt** skal finnes i `audit_log`; eventuelt **separat** behandlingsgrunnlag og DPIA.
- **Internkontroll:** hvem som skal ha tilgang utover dagens `private.is_platform_admin()`-lesing; revisjon av tilgangslogger.

**Før B2d implementeres i prod:** DPO-konsultasjon **obligatorisk** som gate.

---

## Backup / plattform (referanse)

Supabase **Database Backups** og **PITR** (WAL-arkiv, typisk fin granularitet på gjenoppretting) er beskrevet i [Database Backups](https://supabase.com/docs/guides/platform/backups). **Plattform-backup erstatter ikke** egen **retensjons- og arkivpolicy** for `audit_log` på måneds/år-nivå.

---

## What this DOES NOT do

- **Implementerer ingenting** i database eller applikasjon — kun plan.
- **Endrer ikke** `tg_audit_row`, triggers, `audit_log`-skjema eller RLS.
- **Vedtar ikke** endelig retention-periode eller art. 9-behandlingsgrunnlag — **DPO/jurist**.
- **Erstatter ikke** produktkrav til **staging-test**, **CLAUDE for clone**, eller ** målt** volum før B2c.
- Omfatter **ikke** `audit_events`, `audit_logs`, `content_audit_log`, `superadmin_audit_log` — kun **`public.audit_log`** og tilhørende triggrespor.

---

*Rev A · plan-only · FASE B oppgave 2 · 2026-05-18*
