# G0 — Endelig GO / NO-GO pilot-beslutning (Lunchportalen)

**Dato:** 2026-03-29  
**Beslutningstype:** Teknisk og operativ anbefaling til produkt/eier — ikke juridisk signatur.

---

## 1. Endelig beslutning

**GO WITH CONDITIONS**

**Én setning:** Tekniske release-gates og omfattende automatiske tester er grønne, men kjente plattformrisikoer (stor API-flate, middleware uten rolle, `strict: false`, delvis worker-stub, ekstern social-publish som dry-run, manglende dokumentert lasttest og uferdig operatør-sjekkliste) gjør at pilot **kun** er forsvarlig med eksplisitt scope, aksepterte begrensninger og menneskelig signoff — ikke som ubegrenset «go live».

---

## 2. Decision basis

| Kilde | Brukt til |
|-------|-----------|
| `docs/hardening/DELTA_AUDIT_FROM_BASELINE.md` | Hva som er RESOLVED vs STILL OPEN mot baseline |
| `docs/hardening/OPEN_PLATFORM_RISKS.md` | Åpne risikoer A–G |
| `docs/hardening/GO_LIVE_READINESS_CHECKLIST.md` | Prosesskrav — mange krever manuell kryss |
| `docs/hardening/RESOLVED_BASELINE_ITEMS.md` | 15:00 + employee `next` |
| `docs/hardening/H1_*.md` | Auth/route/cron-observability plan |
| `docs/hardening/H2_*.md` | Pilot hardening (dev-route prod-block, observability cron failures, cron path constants, SLI-tekst) |
| `docs/audit/FULL_REPO_AUDIT_V2.md` | Omfang, API-sprawl, komponent-alias |
| `docs/audit/GO_LIVE_RISK_REGISTER_V2.md` | R1–R10 |
| `docs/phase2b`–`2d` (oversikt) | Social/SEO/ESG intent vs runtime |
| `REPO_DEEP_DIVE_REPORT.md` (rot) | **Before snapshot** — ikke brukt som nåstatus |
| **Kode** | `middleware.ts`, `lib/http/routeGuard.ts`, `lib/auth/role.ts`, `lib/week/availability.ts`, `workers/worker.ts`, stikkprøver `app/api/**` |

**Verifikasjon (2026-03-29):** `npm run typecheck` ✅ · `npm run build:enterprise` ✅ · `npm run test:run` ✅ (212 filer / 1191 tester).

---

## 3. Hva som er godt nok til pilot

- **Enterprise build-pipeline:** `build:enterprise` inkluderer plattform-guards og SEO-skript — feil stopper linjen.
- **Automatiserte tester:** Stor dekning (tenant, RLS, API-guards, CMS, m.m.) — se `H2_VERIFICATION.md` / testlogg.
- **Lukket mot baseline (kode):** Fredag **15:00** for ukesynlighet (`lib/week/availability.ts`); employee **`next`** kun `/week` (`allowNextForRole` i `lib/auth/role.ts`) — jf. `RESOLVED_BASELINE_ITEMS.md`.
- **API-mønster:** `scopeOr401` / `requireRoleOr403` er etablert mønster på sensitive ruter (stikkprøver + tester).
- **Cron auth:** `requireCronAuth` på cron-ruter; outbox skriver til `cron_runs` (H2 observability + SLI-tekst oppdatert).
- **H2:** Dev order-endepunkt blokkert i Vercel production; superadmin observability viser `cronRecentFailures`.

---

## 4. Hva som fortsatt er svakt

- **`strict: false`:** Uoppdagede typefeil i kanttilfeller (STILL OPEN).
- **Middleware:** Ingen rolle — kun cookie på beskyttede **sider**; feil i én API-rute kan fortsatt lekke (A2).
- **APIflate (~561 `route.ts`):** Ingen full menneskelig/maskinell revisjon av hver rute (R1).
- **To spor ukeplan (Sanity vs meny):** Ikke løst — `DELTA_AUDIT` STILL OPEN.
- **Worker:** `send_email`, `ai_generate`, `experiment_run` er **stub** (E1).
- **Social ekstern publish:** Meta/kanaler kan være **dry_run** / `CHANNEL_NOT_ENABLED` — ikke «ekte» publisering uten nøkler (D1).
- **Skaleringsbevis:** Ingen dokumentert lasttest for målark (F1).
- **Trippel ESG API-yte:** admin/backoffice/superadmin — vedlikeholdsrisiko (R7).
- **GO_LIVE-sjekkliste:** Mange punkter er **prosess** (backup-restore test, on-call, stikkprøver) — ikke bevist utført i denne økten.

---

## 5. Hva som er akseptabel pilotrisiko — og hvorfor

| Risiko | Hvorfor akseptabel i **begrenset** pilot |
|--------|------------------------------------------|
| Middleware uten rolle | Akseptabel **kun** hvis teamet forstår at **API** er autoritativ sone og det ikke pilotes nye ureviderte API-yter. |
| `strict: false` | Akseptabel hvis pilot-trafikk og endringsflate er lav og feil overvåkes. |
| Worker-stubs | Akseptabel hvis pilot **ikke** avhenger av e-post/AI-jobbene som er stub. |
| Social dry-run | Akseptabel hvis pilot **ikke** lover ekstern publisering som suksesskriterium. |
| Ingen lasttest | Akseptabel kun ved **lav samtidighet** og avtalt kapasitetsantakelse. |
| API-sprawl | Akseptabel hvis **pilot-scope** låser hvilke flater/endepunkter som brukes (se `PILOT_SCOPE_LOCK.md`). |

---

## 6. Hva som ikke er akseptabelt — og hvorfor

| Forhold | Hvorfor |
|---------|---------|
| Pilot uten **skriftlig** scope og begrensninger | Åpner for at kunder/stakeholders forventer full produkt + ekstern SoMe/ESG-sannhet. |
| Pilot uten verifiserte **secrets** (`CRON_SECRET`, `SYSTEM_MOTOR_SECRET` der relevant) | Cron, system health og motor-jobs feiler eller er usikre. |
| Pilot som **lover** full faktura/Stripe/Tripletex-korrekthet uten egen økonomi-QA | `OPEN_PLATFORM_RISKS` C1–C2 — hybrid økonomi. |
| **NO-GO** hvis `typecheck` / `build:enterprise` / kritiske tester feiler på RC-commit | Release-gates er ikke-forhandlingsbare i denne modellen. |

---

## 7. Vilkår for GO WITH CONDITIONS (må være oppfylt før pilotstart)

1. **`PILOT_SIGNOFF_CHECKLIST.md`** utfylt med navn/dato der det kreves.  
2. **`PILOT_SCOPE_LOCK.md`** godkjent — ingen pilot utenfor IN SCOPE.  
3. **`PILOT_KNOWN_LIMITATIONS_ACCEPTANCE.md`** signert av **eier** for SoMe, SEO, ESG-ordlyd og worker-stub.  
4. **Secrets** verifisert i målmiljø (minst `CRON_SECRET`; `SYSTEM_MOTOR_SECRET` der system/superadmin krever det).  
5. **Pilot-tenant** og supportkontakt definert.  
6. **Rollback** (Vercel redeploy / forrige SHA) forstått av operatør.  
7. **Ingen** forventning om at middleware erstatter API-sikkerhet — kort briefing til alle som rører auth/API.

---

## 8. Hva som må vente til etter pilot

- Full **API-inventory** og eierskap per rute.  
- **`strict: true`** (gradvis).  
- **Konsolidering** av ESG-endepunkter og komponent-røtter.  
- **Produksjons** worker-jobs for stub-typer.  
- **Lasttest** og kapasitetsark.  
- **Ekstern** alerting (PagerDuty/Slack) utover dagens minimum.  
- **Restore-test** av Supabase hvis ikke gjort — dokumentert teknisk gjeld.

---

## Dokumentkobling

- `PILOT_TRAFFIC_LIGHT_MATRIX.md`  
- `PILOT_SCOPE_LOCK.md`  
- `PILOT_KNOWN_LIMITATIONS_ACCEPTANCE.md`  
- `PILOT_SIGNOFF_CHECKLIST.md`  
- `PILOT_OPEN_RISKS_AFTER_SIGNOFF.md`
