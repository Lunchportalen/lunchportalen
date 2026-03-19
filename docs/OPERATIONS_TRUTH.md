# Operations – sannhet

**Health, cron-auth, outbox og sporbarhet. Ingen fake OK.**

## 1. Health

### 1.1 Public: `GET /api/health`

- **Formål:** Load balancer / orchestrator probe. Ingen rollekrav.
- **Sjekker (ekte):**
  - **app:** Alltid `ok: true` (prosess kjører).
  - **supabase:** Én `profiles`-spørring; feil → `supabase.ok: false`.
  - **db_schema:** `profiles` + `orders`; begge må lykkes for `db_schema.ok: true`.
  - **sanity:** Oslo-dato og cutoff-hjelpere (`osloTodayISODate`, `isAfterCutoff0800`); unntak → `sanity.ok: false`.
- **Aggregering:** `ok = appOk && supabaseOk && dbSchemaOk && sanityOk`. Ved første feil: `ok: false`.
- **Respons:**
  - **200:** `{ ok: true, rid, data: { ok, ts, version, checks } }`.
  - **503:** Ved `!ok` – `{ ok: false, rid, message, status: 503, error: "HEALTH_FAILED" }`. Ingen grønnvasking.
- **Sporbarhet:** Ved feil settes `failureRid` i body (når 200); ved 503 returneres `rid` i respons.

### 1.2 Role-gated: `GET /api/system/health` og superadmin

- **Kilde:** `lib/system/health.ts` – `runHealthChecks()`.
- **Sjekker:** runtime (getRuntimeFacts), db (profiles), sanity (valgfri/skip), time (Oslo).
- **Regel:** `ok = checks.every(c => c.status === "ok" || c.status === "skip")`. FAIL/WARN → `ok: false`. Ingen fake OK.
- **Superadmin:** `/api/superadmin/system/health` skriver til `system_health_snapshots` og `ops_events`; åpner/lukker incidents. Status avledes fra `deriveSystemStatus` / `deriveReasons`.

### 1.3 Env

- **Kilde:** `lib/env/system.ts` – `validateSystemRuntimeEnv()`.
- **Påkrevd (eksempel):** `SYSTEM_MOTOR_SECRET`. Mangler → health WARN/FAIL, systemstatus DEGRADED/DOWN.

---

## 2. Cron-auth (FASIT)

- **Kilde:** `lib/http/cronAuth.ts` – `requireCronAuth(req)`.
- **Prod/staging:** Vercel sender `Authorization: Bearer <CRON_SECRET>`.
- **Lokal/manuell:** Støtte for `x-cron-secret` header. Ingen query-parametre for secret.
- **Env:** `CRON_SECRET` (standard). Unntak: system-motor bruker `SYSTEM_MOTOR_SECRET` og `missingCode: "system_motor_secret_missing"`.
- **Kastet feil:**
  - `cron_secret_missing` – env ikke satt.
  - `forbidden` – env satt, men header mangler eller secret ugyldig.
- **Cron-ruter:** Alle under `app/api/cron/*` bruker `requireCronAuth(req)` (eller wrapper). Ingen cron-logikk kjøres uten gyldig auth.

---

## 3. Outbox (cron)

- **Rute:** `POST /api/cron/outbox`.
- **Auth:** `requireCronAuth(req)` – 500 ved manglende `CRON_SECRET`, 403 ved ugyldig/manglende header.
- **Respons (200):** Deterministic shape:
  - `batchSize`, `timeBudgetMs`, `staleMinutes`
  - `processed`, `sent`, `failed`, `failedPermanent`, `timedOut`, `resetStale`, `maxAttempts`
- **Sporbarhet:** `rid` og worker-id (`cron-outbox:<rid>`) brukes i utboksen; feil returneres som 500 med `outbox_failed`, ingen stille drop.

---

## 4. Operativ status (SLO / alarmer)

- **Én sannhetskilde:** `GET /api/superadmin/system/status` (superadmin) – aggregerer health, SLO/SLI, alarmer, åpne incidents. Se `docs/SLO_ALERTING_RUNBOOK.md`.
- **UI:** Superadmin → System → kortet «SLO og alarmer». Ingen ekstern varsling (PagerDuty/Slack) koblet på; status er alert-klar.

## 5. Sporbarhet – hvor cron og health er synlige

- **Health:** Public health returnerer 503 ved reell feil; superadmin health skriver snapshots og ops_events.
- **Cron:** Outbox-respons inneholder tellere; andre cron-jobber logger/returnerer egne resultater. `CRON_SECRET` aldri logget eller eksponert.
- **Tester:**
  - `tests/api/healthPublic.test.ts` – public health 200 ved OK, 503 ved DB-feil.
  - `tests/api/cronOutboxAuth.test.ts` – 500 ved manglende secret, 403 ved ugyldig auth, 200 med resultat ved gyldig auth.

---

## 6. Prinsipper

- Health reflekterer **faktisk** tilstand; ingen fake OK.
- Cron kjører **aldri** uten gyldig auth (CRON_SECRET / SYSTEM_MOTOR_SECRET der aktuelt).
- Feil under cron (f.eks. outbox) gir eksplisitt 500 og feilkode, ikke stille fallback.
- Operative feil skal være **oppdagbare** (503, 500, 403, logs, snapshots, ops_events).
