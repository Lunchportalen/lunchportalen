# E0 — Ubetinget enterprise-live beslutning

**Dato:** 2026-03-29

---

## 1. Endelig beslutning

**NO-GO**

---

## 2. Hvorfor

Flere kritiske forhold — eksplisitte **worker-stubs**, **DRY_RUN**-risiko for ekstern social publish, **ikke-bevist skala**, **middleware uten rolle**, **`strict: false`**, og **ikke-fullstendig bevist API-gating** — er fortsatt åpne og kan ikke lukkes med små grep uten å villede; E0 tillater ikke «GO WITH CONDITIONS».

---

## 3. Hva som er godt nok

- Sterk **CI/enterprise build-kjede** (`build:enterprise`) og **bred Vitest-dekning** (1191 tester).
- **Kjerneflyt** (ordre, uke, kjøkken, driver, admin-scope) er **substantielt testet**.
- **Fail-closed** helse og mange API-mønstre (`scopeOr401`, cron-auth).
- **Dokumenterte** baseline-forbedringer (H2, resolved items).

---

## 4. Hva som fortsatt er svakt

- **A1** Middleware kjenner ikke rolle — kun cookie + layout/API må bære sannhet.
- **A2** Stor APIflate — full konsistens **ikke** mekanisk bevist.
- **A3** `strict: false` — svekket statisk sikkerhet.
- **B1** To spor for «uke» — arkitektonisk risiko.
- **C1–C2** Billing hybrid — økonomi utover enhetstester.
- **D** Growth — DRY_RUN/stub/forventning.
- **E1** Worker **send_email**, **ai_generate**, **experiment_run** er **STUB** i `workers/worker.ts`.
- **F1** Ingen dokumentert **mål-lasttest**.
- **Ops** Backup/restore og 24/7-respons **ikke** bevist som SLA i repo.

---

## 5. Hva som er uforenlig med ubetinget enterprise-live-ready

- **STUB** og **DRY_RUN** kan ikke kalles **live** under E0-reglene.
- **Skala** kan ikke hevdes uten **bevis**.
- **Uklare sikkerhetsgrenser** (rolle/middleware + ufullstendig API-bevis) kan ikke kalles **enterprise-closed**.
- **Organisatoriske** vilkår (secrets, support, økonomi-QA) er **ikke** lukket i kode.

---

## 6. Hva som må lukkes for å gå fra NO-GO til GO (minimalt, prioritert)

1. **Worker:** Erstatt stubs med produksjonsimplementasjoner **eller** fjern/disable job-typer og all UI/API som impliserer ekte leveranse.
2. **Social publish:** Enten ekte ekstern integrasjon med verifisert sporbarhet **eller** hard **DISABLE_FOR_ENTERPRISE_LIVE** for bruker-synlig «publish» inntil klart.
3. **Bevis:** Dokumentert lasttest **eller** akseptert skrivebordsark for «narrow scale» signert av drift — *merk: siste er fortsatt vilkår; ekte GO krever typisk bevis*.
4. **Auth:** Mekanisk gate/audit på alle muterende API-er **eller** middleware-rolle (større prosjekt).
5. **`strict: true`:** Planlagt migrering (ikke smågrep).
6. **B1:** Produkt/arkitektur-løsning eller formelt akseptert risiko **signert** (fortsatt vilkår — ekte ubetinget GO krever ofte konsolidering).
7. **Ops:** Navngitt on-call, verifisert backup-restore i prod, paging på 5xx/cron — **organisatorisk bevis**.

---

## 7. Hva som må være deaktivert eller skjult dersom systemet likevel går bredt live (uten GO)

- Bruker-synlige spor som antyder **ekstern** SoMe-suksess uten nøkler.
- Forventning om **worker**-e-post/AI/eksperiment som produksjonsjobber.
- Markedsføring av **enterprise scale** uten lastbevis.

---

## 8. Hva som kan vente til senere

- Estetiske/forbedrende CMS-UX som ikke endrer sannhet.
- Videre observability (K3) etter at blokker er lukket.
- Eksperimentelle superadmin-fliser som allerede er INTERNAL_ONLY.

---

**Kryssreferanse:** `docs/live-ready/BROAD_LIVE_GO_DECISION.md` forble **GO WITH CONDITIONS**; E0 er **strengere** og gir **NO-GO** for **ubetinget** status.

---

**Closeout 12 (2026-04-17):** E0-punktene er på nytt avstemt mot repo; **NO-GO** for ubetinget status **står**. Detaljer per rad: `ENTERPRISE_LIVE_E0_CLOSEOUT_12.md`.
