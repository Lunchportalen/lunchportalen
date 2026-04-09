# E0 — Åpne vilkår (fra «GO WITH CONDITIONS» til ubetinget)

**Dato:** 2026-03-29

Alle rader der **«Can close now?» = Nei** uten redesign / bevis er **blokkerende** for ubetinget GO (E0-regel: da **NO-GO**).

| Condition | Current state | Why this blocks unconditional broad live | Smallest safe closure | Needs code change? | Can close now? |
|-----------|---------------|------------------------------------------|------------------------|--------------------|----------------|
| Secrets fullt verifisert i prod | Miljøavhengig; ikke bevist i denne repo-kjøringen | Drift uten `SYSTEM_MOTOR_SECRET` / `CRON_SECRET` → fail eller usikkerhet | Manuell verifikasjon i målmiljø + runbook | Nei (drift) | **Nei** (uten org-bevis) |
| Middleware rolle-sannhet | Cookie på stier; **ikke** rolle (`OPEN_PLATFORM_RISKS` A1) | Grensesnitt kan ikke kalles «enterprise-closed» uten layout/API-sannhet overalt | Full rute-revisjon eller middleware-rolle (stor) | Ja for full lukking | **Nei** |
| APIflate 561+ handlers konsistent gated | Stikkprøver + tester; **ikke** full bevis | Én glemt rute → lekkasje | Automatisk audit + 100 % coverage | Delvis | **Nei** |
| TypeScript `strict: false` | `tsconfig.json` | Svak statisk garanti for enterprise | `strict: true` migrering | Ja (stor) | **Nei** |
| Worker `send_email` / `ai_generate` / `experiment_run` | **STUB** i `workers/worker.ts` | Ikke ekte leveranser — uforenlig med «live» for de jobbene | Implementer prod-leveranser eller fjern job-typer fra enterprise-scope | Ja | **Nei** |
| Social ekstern publish | DRY_RUN uten nøkler / policy | Ser ut som publish uten ekstern effekt | Nøkler + ekte API + revisjon | Ja + drift | **Nei** |
| Skala / last | Ingen dokumentert mål-lasttest (F1) | «Enterprise scale» ikke bevist | Lasttest + kapasitetsrapport | Nei (testmiljø) | **Nei** |
| B1 to spor uke | Arkitektonisk desynk-risiko | End-to-end sannhet ikke garantert uten redesign/konsolidering | Produkt/arkitektur-beslutning | Ev. ja | **Nei** |
| Billing hybrid QA | Krever økonomi utover unit tests | Faktura/Stripe/Tripletex feil → reell skade | Manuell QA + reconciler | Nei (prosess) | **Nei** |
| Observability + support 24/7 | Logging/health finnes; ingen full SOC | Hendelser kan ikke garanteres løst innen SLA | Ansettelse/kontrakt + paging | Delvis | **Nei** |

**Oppsummert:** Ingen av disse er **lukket innenfor små grep** i denne fasen; E0 ender i **NO-GO** for ubetinget status.
