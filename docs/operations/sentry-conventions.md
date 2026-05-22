# Sentry — logging og observability

Lunchportalen bruker [Sentry](https://sentry.io) (EU-region, Frankfurt) for feilsporing i **production** og **staging** (`VERCEL_ENV=preview`).

## Miljøvariabler (Vercel)

| Variabel | Scope | Beskrivelse |
|----------|-------|-------------|
| `SENTRY_DSN` | Server | DSN fra Sentry-prosjekt (samme verdi som client) |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | Samme DSN — kun for browser-init |
| `SENTRY_ORG` | Build | `lunchportalen` |
| `SENTRY_PROJECT` | Build | `lunchportalen-app` |
| `SENTRY_AUTH_TOKEN` | Build | Source map upload — **aldri i repo** |

Sett på Vercel: **Production** + **Preview**. La **Development** stå tom slik at lokal dev ikke sender events.

## Environment-tags

| Deploy | Sentry `environment` |
|--------|----------------------|
| `app.lunchportalen.no` (prod) | `production` |
| Staging / preview | `staging` |
| Lokal uten DSN | disabled (ingen send) |

## Logging — `lib/core/logger.ts`

| Metode | Bruk | Sentry |
|--------|------|--------|
| `log.info(msg, ctx?)` | Normal drift, breadcrumbs | Breadcrumb |
| `log.warn(msg, ctx?)` | Degradert, retry, uventet men håndtert | Message (warning) |
| `log.error(msg, err?, ctx?)` | Feil som påvirker bruker/flow | `captureException` |
| `log.fatal(msg, err?, ctx?)` | Systemkritisk — krever umiddelbar oppmerksomhet | `captureException` (fatal) |

### Context (trygt)

Legg kun **ikke-PII** i context:

- `company_id`, `provider_id`, `location_id` (UUID)
- `rid`, `route`, `cron`, `outbox_id`, `event_key` (prefix OK, ikke full payload)
- `http_status`, `code`

### Aldri logg

- E-post, telefon, orgnr som identifikator
- Passord, tokens, API-nøkler
- Faktura-beløp, betalingsreferanser
- Full outbox/webhook-payload

PII fjernes også i `beforeSend` (`lib/sentry/scrubEvent.ts`).

## Integrasjonspunkter

| Lag | Fil | Oppførsel |
|-----|-----|-----------|
| Client/server/edge init | `instrumentation-client.ts`, `sentry.*.config.ts`, `instrumentation.ts` | SDK + `onRequestError` |
| Error boundaries | `app/error.tsx`, `app/global-error.tsx`, admin/superadmin error | `captureException` |
| API routes | `lib/core/errorResponse.ts` via `safeHandler` | Automatisk capture |
| Cron (Vercel-scheduled) | `captureCronHandlerError()` i catch | Tag `cron`, `rid` |
| Outbox | `reportOutboxPermanentFailure()` ved `FAILED_PERMANENT` | Message uten payload |

## Cron-feil

Vercel-scheduled crons rapporterer håndterte feil via `lib/http/cronObservability.ts`. Uauth cron (403) sendes **ikke** til Sentry.

## Alerting (Sentry UI — manuell oppsett)

Anbefalt etter deploy:

1. **Ny unhandled error** i `production` → e-post
2. **10+ events på 5 min** for samme issue → e-post (storm)
3. **Ikke** alert på `staging` (for støy)

## Releases

Vercel + Sentry integrasjon tagger releases automatisk når `SENTRY_AUTH_TOKEN` er satt ved build.

## Verifikasjon

1. Sett DSN på staging i Vercel
2. Deploy staging
3. Utløs test-feil (midlertidig route eller error boundary i preview)
4. Bekreft i Sentry: environment=`staging`, ingen PII i event
5. Fjern test-rute før prod-promotering

## Agent-regel

**Bruk `lib/core/logger.ts` for ALL logging i prod-kode. Aldri `console.log`/`console.error` utenfor `tests/`. PII (e-post, orgnr, beløp) må aldri logges.**
