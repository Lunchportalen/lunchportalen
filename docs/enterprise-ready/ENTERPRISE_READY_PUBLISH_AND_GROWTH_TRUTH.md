# E0 — Publish & growth truth (arbeidsstrøm 3)

**Dato:** 2026-03-29

## CMS / publish

- Lagring, preview, publish og outbox er **implementert** med tester (`tests/cms/**`, `contentOutbox`, merge-tester).
- Kompleksitet: feil bruk kan ødelegge innhold — **prosess**-risiko, ikke nødvendigvis stub.

## Social

- Intern kalender/utkast: **runtime** i DB.
- Ekstern publisering: kan være **DRY_RUN** eller kanal av uten nøkler — jf. API-kontrakter og `LIVE_READY_GROWTH_POSTURE.md`.
- UI: tidligere presisering i `SocialCalendarRuntimeClient.tsx` (dry-run-ærlighet).

## SEO

- **Review-first** — ikke ubetinget «live metadata everywhere» uten eksplisitt lagring/publish.

## ESG

- Tall fra DB/cron; **tom data** må ikke tolkes som suksess — copy-risiko (D3).

## E0-endringer

- Ingen nye UI/tekstendringer i denne runden — eksisterende sannhet beholdt.

## Konsekvens

- DRY_RUN + review-first + kommunikasjonsrisiko → **ikke** full «enterprise-live truth» for alle growth-flater uten videre.
