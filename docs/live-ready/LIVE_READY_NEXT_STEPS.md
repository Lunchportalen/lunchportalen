# LIVE READY — Neste steg

**Dato:** 2026-03-29

## Umiddelbart (før bred trafikk)

1. Gå gjennom **`BROAD_LIVE_SIGNOFF_CHECKLIST.md`** og kryss av alle punkter.
2. Bekreft **secrets** og **cron** i produksjonsmiljø.
3. Kjør **røyktest** på `/week`, admin, kitchen, driver med representative brukere.
4. Avstem **forventning** mot kunder/internt: SoMe publish, SEO, ESG (`LIVE_READY_GROWTH_POSTURE.md`).

## Kort horisont (etter go)

- Overvåk feilrater og helse-endepunkter første uker.
- Samle tilbakemeldinger fra support — juster runbook ved behov.

## Senere (ikke del av denne leveransen)

- TypeScript **strict** (egen sak).
- Eventuell **middleware**-rolle (stor endring — eksplisitt beslutning).
- **B1**-konsolidering eller dokumentert eierskap permanent.
- **Load testing** før stor markedsføring.
- **Observability** utvidelse (K3).

## Filer i `docs/live-ready/`

| Fil | Formål |
|-----|--------|
| `LIVE_READY_BASELINE_DELTA.md` | Baseline delta |
| `LIVE_READY_SCOPE_LOCK.md` | IN/OUT scope |
| `LIVE_READY_MUST_FIX_MATRIX.md` | Must-fix tabell |
| `LIVE_READY_RUNTIME_STATUS.md` | Runtime status per flate |
| `LIVE_READY_EXECUTION_LOG.md` | Arbeidslogg |
| `LIVE_READY_CHANGED_FILES.md` | Endrede filer |
| `LIVE_READY_AUTH_HARDENING.md` | Auth/route-notater |
| `LIVE_READY_CRON_WORKER_STATUS.md` | Cron/worker |
| `LIVE_READY_PUBLISH_AND_CMS_SAFETY.md` | CMS/publish |
| `LIVE_READY_GROWTH_POSTURE.md` | Social/SEO/ESG |
| `LIVE_READY_RUNBOOK.md` | Deploy/rollback |
| `LIVE_READY_SUPPORT_MODEL.md` | Support |
| `LIVE_READY_VERIFICATION.md` | CI-kommandoer |
| `BROAD_LIVE_GO_DECISION.md` | GO/NO-GO |
| `BROAD_LIVE_TRAFFIC_LIGHT_MATRIX.md` | Trafikklys |
| `BROAD_LIVE_KNOWN_LIMITATIONS.md` | Begrensninger |
| `BROAD_LIVE_SIGNOFF_CHECKLIST.md` | Signoff |
| `BROAD_LIVE_OPEN_RISKS.md` | Åpne risikoer |
| `LIVE_READY_NEXT_STEPS.md` | Denne filen |
