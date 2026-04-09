# E0 — Enterprise live limitations

**Dato:** 2026-03-29

| Limitation | Impact | Acceptable for unconditional enterprise live? | Owner | Required closure |
|------------|--------|-------------------------------------------------|-------|------------------|
| Worker stubs (e-post, AI, eksperiment) | Ingen ekte leveranser | **Nei** | Plattform | Implementer eller fjern fra scope |
| Social publish DRY_RUN | Feil forventning | **Nei** | Growth | Ekte integrasjon eller disable/hide |
| Ingen lasttest | Ukent skala | **Nei** | Drift+plattform | Mål-lasttest eller eksplisitt pilot-cap (sistnevnte = fortsatt vilkår) |
| Middleware uten rolle | Potensielt hull | **Nei** | Plattform | Full audit eller rolle-middleware |
| `strict: false` | Runtime-feil | **Nei** | Utvikling | strict-migrering |
| B1 to spor uke | Desynk | **Nei** | Produkt | Konsolidering / signert aksept |
| Billing hybrid uten full QA | Økonomisk feil | **Nei** | CFO/ops | Manuell reconciler-QA |
| Backup uverifisert | Data-tap | **Nei** | Drift | Verifisert restore |
| Support uten navngitt on-call | Lang MTTR | **Nei** | Ledelse | Kontrakt + runbook |

**Alle «Nei»** → samlet **NO-GO** for ubetinget status inntil lukket.
