# SLO, SLI og alarmer – runbook

**Én sannhetskilde:** `GET /api/superadmin/system/status` (superadmin-gate) og Superadmin → System (SLO og alarmer-kort).

---

## 1. Definerte SLO-er

| SLO-id | Navn | Beskrivelse | Måling (SLI) | Mål % | Kritisk under | Advarsel under |
|--------|------|-------------|--------------|-------|----------------|----------------|
| `system_health` | System health | Runtime, DB, Sanity, tid OK | Andel `system_health_snapshots` med status=normal (siste 60 min) | 99,5 | 95 | 99 |
| `cron_critical` | Kritiske cron-jobber | Forecast, preprod, week-visibility kjører OK | Andel `cron_runs` (siste 24t) med status=ok | 99 | 90 | 95 |
| `cron_outbox` | Outbox | Outbox-cron kjører OK | Fra `cron_runs` (job=outbox) når outbox persisterer; ellers «ukjent» | 99 | 90 | 95 |
| `order_write` | Ordre-skriving | Ordre (POST /api/orders/upsert) feiler ikke med 5xx / ingen åpne ORDER-incidents | Ingen åpne `system_incidents` type ORDER | 99,5 | 98 | 99 |
| `auth_protected_route` | Auth / beskyttede ruter | Ingen auth-relaterte systemfeil | Ingen åpne `system_incidents` type AUTH | 99,9 | 99 | 99,5 |
| `content_publish` | Content/CMS | Publisering og scheduler uten vedvarende feil | Ingen åpne SANITY/INTEGRATION `system_incidents` | 99 | 95 | 98 |

---

## 2. Hva utløser alarmer

- **Kritisk:** SLI under kritisk terskel (f.eks. system_health &lt; 95 %) eller minst én sjekk FAIL.
- **Advarsel:** SLI under advarselsterskel (f.eks. system_health &lt; 99 %).
- Alarmer beregnes i `lib/observability/alertEvaluator.ts` og leveres i `status.alerts`. Ingen ekstern varsling (PagerDuty/Slack/e-post) er koblet på; status er **alert-klar** for operatører i Superadmin-system og for eventuell senere integrasjon.

---

## 3. Hva operatører bør gjøre

1. **Sjekk operativ status**  
   Gå til Superadmin → System. Kortet «SLO og alarmer» viser status (normal/degraded/critical), alle SLO/SLI og aktive alarmer.

2. **Ved kritisk (critical)**  
   - Les «Aktive alarmer» og «Årsaker».  
   - Sjekk «Sjekker» (runtime, db, sanity, time) og «Hendelser» (åpne system_incidents).  
   - Bruk «Kjør flytsjekk» og «Codex Prompt» for sporbar kontekst.  
   - Fiks årsak (env, DB, Sanity, cron), deretter «Oppdater status».

3. **Ved advarsel (warning)**  
   - Overvåk; vurder om tiltak trengs før terskel blir kritisk.

4. **RID**  
   - Alle responser har `rid`; bruk den i logger og ved eskalering.

---

## 4. Begrensninger (ærlig dokumentert)

- **Ingen ekstern varsling:** Ingen PagerDuty-, Slack- eller e-postintegrasjon er implementert. Alarmer er kun synlige i Superadmin-system og i API-responsen. Implementasjonen er «alert-klar»; ekstern transport kan kobles på senere.
- **Outbox-SLI:** Outbox-cron skriver per i dag ikke til `cron_runs`, så `cron_outbox` SLI vises som «ukjent» inntil outbox-ruten persisterer kjøringsresultat der.
- **Ordre/auth/content:** Ordre/auth/content-SLI er avledet fra **åpne system_incidents** (ORDER, AUTH, SANITY/INTEGRATION). Det gir ikke «antall forespørsler vs. feil», men «ingen åpne incidents = OK». For mer presis ordre-SLI kan man legge inn én `ops_event` per ordre-skriving (suksess/feil) og beregne rate derfra.

---

## 5. Utvide modellen

- **Nye SLO-er:** Legg til i `lib/observability/sloRegistry.ts` og tilhørende SLI-beregner i `lib/observability/sli.ts`. Kall den nye SLI-beregneren fra `computeAllSlis()`.
- **Outbox målbart:** I `app/api/cron/outbox/route.ts`, etter `processOutboxBatch`, sett inn rad i `cron_runs` (job=outbox, status=ok/error, ran_at, rid/meta) slik at `computeSliCronOutbox` får data.
- **Ordre-rate:** Ved suksess/feil i `app/api/orders/upsert/route.ts`, skriv `ops_event` (f.eks. event=order.upsert.success / order.upsert.failure). Lag SLI som teller success/(success+failure) i vindu.
- **Ekstern varsling:** Konsumér `status.alerts` fra en cron eller webhook og send til valgt kanal (f.eks. Slack webhook); ikke gjort i repo ennå.

---

## 6. Filer som er sannhetskilde

| Område | Fil(er) |
|--------|--------|
| SLO-definisjoner | `lib/observability/sloRegistry.ts` |
| SLI-beregning | `lib/observability/sli.ts` |
| Alert-evaluering | `lib/observability/alertEvaluator.ts` |
| Samlet operativ status | `lib/observability/statusAggregator.ts` |
| API (én sannhetskilde) | `GET /api/superadmin/system/status` |
| UI | Superadmin → System → «SLO og alarmer» |
