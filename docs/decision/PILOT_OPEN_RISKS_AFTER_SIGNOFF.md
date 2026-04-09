# Åpne risikoer etter signoff (G0)

**Dato:** 2026-03-29  
**Skille:** Akseptert for pilot vs ikke akseptert vs utsatt.

---

## Risikoer akseptert for pilot (med vilkår)

| ID / tema | Begrunnelse | Vilkår |
|-----------|-------------|--------|
| R2 Middleware uten rolle | Mønster kjent; API håndhever | Ingen nye ureviderte API-yter i pilot |
| R3 `strict: false` | Lav endringshastighet antatt | Rask utbedring ved prod-feil |
| R5 Worker stubs | Pilot avhenger ikke av stub-jobs | Ikke bruk e-post/AI-kø som suksesskriterium |
| D1 Social dry-run | Marked forstår begrensning | Signert limitation |
| F1 Ingen lasttest | Lav trafikk | Overvåk latency/feil |
| R4 Cron-sprawl | Operasjon bruker kun Vercel-listen + dokumenterte manuelle | Dokumenter hvis annet brukes |

---

## Risikoer ikke akseptert for pilot (krever scope-kutt eller fix før start)

| Tema | Handling |
|------|----------|
| **Røde gates** — `typecheck` / `build:enterprise` / obligatoriske tester feiler | **NO-GO** til grønt |
| **Secrets mangler** i prod for cron/system | **NO-GO** til verifisert |
| **Løfte** om ekstern SoMe-suksess uten nøkler | **Ikke** akseptert — endre løfte eller scope |
| **Full økonomi-garanti** uten økonomi-QA | **Ikke** akseptert som pilot-KPI |

---

## Risikoer utsatt til etter pilot

| ID / tema | Oppfølging |
|-----------|------------|
| R1 API inventory | Eierskap per prefix / route |
| R7 Trippel ESG API | Konsolidering |
| R6 Komponent-alias | Én rot-policy |
| Strict mode | Fasevis på |
| Lasttest | Etter definerte KPI |
| PagerDuty/Slack | Observability v2 |
| Restore drill | Operasjonelt vindu |

---

## Kobling til register

Se `docs/audit/GO_LIVE_RISK_REGISTER_V2.md` (R1–R10) — denne filen oversetter til **beslutning etter** at `PILOT_SIGNOFF_CHECKLIST.md` er behandlet.
