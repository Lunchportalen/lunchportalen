# LIVE READY — Support model (bred live)

**Dato:** 2026-03-29

## Roller (minimum)

| Rolle | Ansvar |
|-------|--------|
| **L1 support** | Innlogging, enkle forklaringer, eskalering med RID |
| **Drift / ops** | Vercel deploy, cron, secrets, `cronRecentFailures` |
| **On-call tech** | P1: auth nede, betaling, data-isolasjon — avtal internt |

## Eskalering

1. Sjekk Vercel logs + `GET /api/observability` (superadmin).  
2. Supabase dashboard (queries, RLS-feil).  
3. Utvikling med repro + RID.

## Hva som **ikke** er garantert 24/7

- Ekstern SoMe-publisering (dry-run).  
- Worker stub-jobs.  
- Umiddelbar PagerDuty (ingen dedikert integrasjon i repo).

## Dokumentasjon til bruker

- Kjente begrensninger: `BROAD_LIVE_KNOWN_LIMITATIONS.md`.
