# Cron – feilhåndtering i eksisterende system

Dette dokumentet beskriver **hvordan feil håndteres i de eksisterende cron-rutene** (app/api/cron/**). Det introduserer ikke ny kode i cron-mappen, men dokumenterer mønsteret for drift og feilsøking.

## Autentisering

- Alle cron-ruter må autentiseres. Se **docs/CRON_AUTH.md**.
- Hjelper: `lib/http/cronAuth.ts` → `requireCronAuth(req)`.
- Manglende/ugyldig credential → **403**. Manglende server-secret (env) → **500 misconfigured**.

## API-kontrakt ved feil

Cron-rutene bruker samme feilkontrakt som resten av systemet:

- **Suksess:** `{ ok: true, rid, data?: ... }`
- **Feil:** `{ ok: false, rid, error, message, status }`

Feilmeldingen (`message`) bør være **tydelig og sporbar** slik at drift kan feilsøke uten å åpne kode. Eksempler:

- «Kunne ikke kjøre jobb X: [kort årsak].»
- «Manglende konfigurasjon: Y.»

## Hvor feil håndteres

1. **requireCronAuth**  
   Ved manglende/ugyldig auth returnerer ruten typisk **403** med en fast melding (f.eks. «Ugyldig eller manglende cron-tilgang.»). Secret logges aldri.

2. **Business logic / try-catch**  
   Når selve jobben kaster eller returnerer feil:
   - Rutene bruker **jsonErr** (eller tilsvarende) fra `lib/http/respond` for å returnere **status 500/503** og body `{ ok: false, rid, error, message, status }`.
   - `error` er en kort kode (f.eks. `CRON_JOB_FAILED`, `FETCH_FAILED`) for aggregering og alarmer.
   - `message` er menneskelesbar og bør nevne hva som feilet (ikke sensitive data).

3. **Caller (f.eks. Vercel Cron)**  
   Får **non-2xx** og kan bruke det til å:
   - logge feil
   - sende varsel til drift
   - evt. prøve på nytt (avhengig av konfigurasjon)

## Tydelig feilmelding

For at feil skal være **tydelige** i eksisterende system:

- Ved **catch** i cron-ruter: returner `jsonErr(rid, "Kort, tydelig beskrivelse av hva som gikk galt.", 500, "FEILKODE")`.
- Unngå generiske meldinger som bare «Noe gikk galt.» – heller «Kunne ikke hente data fra X» eller «Validering feilet: Y».
- Logg **rid** og evt. feilkode server-side slik at support kan spore forespørselen.

## Oppsummering

| Situasjon              | Typisk respons        | Tydelighet                          |
|------------------------|------------------------|-------------------------------------|
| Mangler cron-auth      | 403, fast melding      | CRON_AUTH.md + respond              |
| Env/secret mangler     | 500, misconfigured     | Tydelig at konfigurasjon mangler    |
| Jobb kaster / feiler   | 500/503, jsonErr       | message + error-kode, rid logges     |
| Caller (Vercel m.m.)   | Ser non-2xx            | Kan varsle drift                    |

Cron-rutene ligger under **app/api/cron/** og endres ikke i denne dokumentasjonsrunden; dette dokumentet beskriver hvordan feilhåndtering allerede er tenkt og hvordan drift kan feilsøke.
