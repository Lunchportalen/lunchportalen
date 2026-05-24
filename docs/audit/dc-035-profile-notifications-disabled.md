# DC-035 — Profile notification opt-out for K6 pool users

**Status:** OPEN (ticket)  
**Dato:** 2026-05-24  
**Kontekst:** K6 LIVE Del 5 — 20× `k6-vu-*@lunchportalen.no` på prod

## Problem

`public.profiles` har ingen kolonne for å slå av e-post/push-varsler:

| Kolonne søkt | Finnes (prod) |
|--------------|---------------|
| `notifications_enabled` | ✗ |
| `email_notifications` | ✗ |
| `notification_preferences` | ✗ |

K6 load mot prod kan utløse ordre-/påminnelsesnotifikasjoner til pool-brukere uten eksplisitt opt-out.

## Anbefalt løsning

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

-- Etter deploy: batch for K6 pool
UPDATE public.profiles SET notifications_enabled = false
WHERE email LIKE 'k6-vu-%@lunchportalen.no';
```

Alternativ: `raw_app_meta_data.k6_pool = true` på auth.users (mindre ideelt — ikke RLS-vennlig for app-logikk).

## K6 LIVE impact

`scripts/k6/provision-k6-prod-pool.mjs` har hook `disablePoolNotifications()` — no-op inntil kolonne finnes.

## Acceptance

- [ ] Kolonne på staging + prod
- [ ] K6 pool-brukere har `notifications_enabled = false`
- [ ] Ordre-pipeline respekterer flagget (fail-closed: send ikke hvis `false`)
