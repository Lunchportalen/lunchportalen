# H1 — Cron, worker og outbox

**Dato:** 2026-03-28  
**Endringsnivå:** Primært **kartlegging** og **dokumentasjon**; ingen omlegging av cron-pipeline i denne PR.

---

## 1. Cron-autentisering

- **`requireCronAuth`** (`lib/http/cronAuth.ts`): `Authorization: Bearer` eller `x-cron-secret`; hemmelighet fra `CRON_SECRET` (eller override `secretEnvVar` f.eks. `SYSTEM_MOTOR_SECRET`).  
- **Fail-closed:** Manglende secret i miljø → konfigurasjonsfeil (kastet / håndtert per rute).  
- **H1:** Ingen endring av signatur — mønsteret anses som **modent** der det brukes konsekvent.

---

## 2. ESG / SEO-relaterte cron

- **`app/api/cron/esg/*`**: Bygger/låser snapshots via RPC — krever typisk **admin client** + cron-auth (se hver `route.ts`).  
- **H1:** Ingen kodeendring; **pilot-sjekk:** bekreft kjøring og feillogg i staging.

---

## 3. Social publish

- Cron som berører social (`app/api/cron/social/route.ts` m.fl.) bruker `requireCronAuth` der påkrevd.  
- **Fail-closed** ved ekstern publish ligger i **executor** / kanal-policy (stub, `CHANNEL_NOT_ENABLED`) — dokumentert i 2D; **ikke** endret i H1.

---

## 4. Outbox / retry

- Worker (`workers/worker.ts`): **`retry_outbox`** kaller `/api/cron/outbox` med `CRON_SECRET` — **reell** sti.  
- **`send_email`**, **`ai_generate`**, **`experiment_run`**: Fortsatt **stub** (logg-only) — **ikke** produksjonsklar for alle jobbtyper.

---

## 5. Stub-jobs (eksplisitt)

| Jobbtype | Status etter H1 |
|----------|-----------------|
| `retry_outbox` | Operativ (krever env) |
| `send_email` | Stub |
| `ai_generate` | Stub |
| `experiment_run` | Stub |

---

## 6. Anbefalinger før pilot

- [ ] **CRON_SECRET** og **SYSTEM_MOTOR_SECRET** satt og rotert etter policy.  
- [ ] Overvåk **5xx** på `/api/cron/outbox` og worker-logg.  
- [ ] Ikke forvent full e-post/AI-kø fra worker før stubs erstattes (egen fase).

---

## 7. H1-kodeendringer

- Ingen endring i cron-ruter eller worker i H1 — kun sikring av **`/api/something`** som kunne misbrukes uten auth (se `H1_AUTH_AND_ROUTE_HARDENING.md`).
