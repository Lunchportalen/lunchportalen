# Observability & operations plan

**Mål:** Kunne **se**, **spore** og **gjenopprette** ved feil — uten å innføre ny leverandør-stack i denne dokumentasjonen.

---

## 1. Logging

| Kilde | Status | Hull |
|-------|--------|------|
| API `jsonOk` / `jsonErr` med **RID** | Etablert mønster | Ikke alle ruter like detaljerte |
| `opsLog` / incidents (5xx) | Delvis | Konsument må vite hvor loggene lander (Vercel/Supabase) |
| Worker `worker.ts` | JSON-linjer til stdout | Krever loggaggregat for søk |

**Før pilot:** avklar **én** loggdestinasjon og **retensjon** (minst 30 dager for feil).

---

## 2. Health & systemstatus

- **`/superadmin/system`** — frosset semantikk (AGENTS); brukes som **menneskelig** health-sjekk.  
- **`/api/health`**, **`/api/system/health`** — egnet for **syntetisk ping** (verifiser auth-krav før bruk i ekstern monitor).

---

## 3. Sporbarhet (traceability)

- **RID** i API-svar — kunder/support må kunne oppgi RID ved eskalering.  
- **Outbox / retry** (`/api/cron/outbox`, worker `retry_outbox`) — kritiske for pålitelig utsending; **må** overvåkes.

---

## 4. Feil per domene (kontrollpunkter)

| Domene | Hva overvåke | Tiltak ved feil |
|--------|----------------|-----------------|
| **Social publish** | `publish`-respons, `CHANNEL_NOT_ENABLED`, dry_run | Ikke markert ekstern suksess; manuell retry |
| **SEO / CMS publish** | 5xx på `PATCH` content | Rollback til forrige variant der mulig |
| **ESG** | `esg_build_*` RPC feiler | Blocker ikke ordre; ESG-panel viser «ikke data» — **sjekk cron** |
| **Billing cron** | Manglende kjøring / WARN i system | Stopp fakturering til avklart |

---

## 5. Cron drift

- Sammenlign **forventet schedule** (Vercel cron / ekstern scheduler) med **faktiske** `computed_at` / logglinjer.  
- **Alert** hvis kritisk jobb ikke har kjørt innen vindu (f.eks. 2× normal intervall).

---

## 6. Alerting — minimum

- **5xx-rate** spike på domene.  
- **Auth-feil** spike (kan indikere angrep eller konfigurasjonsfeil).  
- **Cron** «no successful run in 24h» for valgte jobber.

---

## 7. Runbook (operasjon)

Én side må eksistere (utenfor denne filen) med:

1. Hvem roterer **CRON_SECRET** / **SYSTEM_MOTOR_SECRET**.  
2. Hvordan **disable** skadelig cron raskt.  
3. Hvordan **eskalere** til Supabase support (DB).

---

## 8. Backup

- Supabase **PITR** eller snapshot — eier og RPO/RTO **skriftlig**.  
- **Årlig** restore-test anbefalt; **minst** før pilot hvis data er konfidensielt.
