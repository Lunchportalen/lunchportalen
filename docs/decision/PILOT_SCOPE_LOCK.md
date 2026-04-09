# Pilot scope lock (G0)

**Dato:** 2026-03-29  
**Formål:** Eksplisitt IN / OUT / LIMITED slik at pilot ikke blir «hele produktet».

---

## IN SCOPE (forventet brukt og støttet i pilot)

| Område | Beskrivelse |
|--------|-------------|
| **Employee** | Ukevisning `/week`, ordre i tråd med eksisterende ordre-API og **ikke** endret i G0. |
| **Company admin** | Egen bedrift: folk, invitasjoner, lokasjoner, avtale-innsikt som allerede ligger i `app/admin` (innenfor tenant). |
| **Kitchen** | Produksjonsliste for pilot-lokasjon(er) — read-only operasjonsmodus. |
| **Driver** | Leveranser for pilot — innenfor eksisterende driver-flyt. |
| **Superadmin (begrenset)** | Drift av pilot-tenant, system/innsikt der avtalt — **ikke** eksperimentere vilkårlig på tvers av tenants. |
| **CMS / backoffice (begrenset)** | Innhold som pilot eksplisitt trenger (sider, media) — superadmin/backoffice roller som allerede er satt. |
| **Kritiske croner (Vercel)** | Paths i `lib/pilot/vercelScheduledCrons.ts` — må matche `vercel.json`. |
| **Outbox / retry** | `retry_outbox` worker + `/api/cron/outbox` der pilot bruker ordre-backup — **ikke** stub-jobbene. |

---

## OUT OF SCOPE (ikke pilot-løfter uten nytt vedtak)

| Område | Beskrivelse |
|--------|-------------|
| **Full markeds-publisering** | Ekstern SoMe-success som KPI uten teknisk bevis. |
| **Full økonomi-garanti** | Komplett Tripletex/Stripe/ledger-scenario uten egen økonomi-QA. |
| **50k brukere / enterprise last** | Ingen bevis — se trafikklys skala. |
| **Alle 561 API-ruter** | Kun avtalte flyter; ingen «hele API-et er støttet». |
| **Sanity Studio som typed** | Ekskludert fra `tsc` — egen livssyklus. |
| **Nye integrasjoner** | Ingen nye kanaler i pilot uten eget vedtak. |

---

## DRY RUN / STUB / LIMITED

| Element | Modus |
|---------|--------|
| **Social ekstern publish** | Kan returnere `PUBLISH_DRY_RUN` / `CHANNEL_NOT_ENABLED` — se `OPEN_PLATFORM_RISKS` D1. |
| **Worker** | `send_email`, `ai_generate`, `experiment_run` — **STUB** (`workers/worker.ts`). |
| **Strict typing** | `strict: false` — **LIMITED** statisk sikkerhet. |
| **Middleware** | **LIMITED** til cookie — rolle i API/layout. |
| **Observability** | Superadmin-endepunkter + DB — **LIMITED** vs full alerting stack. |

---

## Cron-jobber — aktivt relevante for pilot (Vercel)

Synk mellom `vercel.json` og `lib/pilot/vercelScheduledCrons.ts`:

- `/api/cron/week-scheduler`
- `/api/cron/forecast`
- `/api/cron/preprod`
- `/api/cron/outbox`
- `/api/cron/cleanup-invites`
- `/api/cron/esg/daily`
- `/api/cron/esg/monthly`
- `/api/cron/esg/yearly`

**Øvrige** `app/api/cron/*`-ruter: antas **ikke** pilot-kritiske med mindre operasjon eksplisitt tar dem i bruk (auth med `CRON_SECRET` fortsatt påkrevd).

---

## Kanaler / integrasjoner som faktisk skal brukes i pilot

| Kanal | Status |
|-------|--------|
| **Supabase** (auth, DB) | Ja — kjernesystem. |
| **Vercel** (hosting/cron) | Ja. |
| **Stripe / Tripletex / e-post** | Kun som allerede konfigurert for pilot-tenant — **ikke** nye integrasjoner i G0. |
| **Meta / SoMe API** | Kun hvis nøkler finnes og scope sier det — ellers **ikke** forvent ekstern post. |

---

**Lås:** Endringer i denne tabellen krever **ny** beslutning (ikke G0-revidert i drift uten dokumentert vedtak).
