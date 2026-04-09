# Phase H0 — Neste steg (anbefalinger)

H0 leverer **beslutningsgrunnlag**, ikke implementasjon. Neste steg bør eies eksplisitt av produkt/tech-lead.

---

## Kort sikt (før pilot)

1. **Gå gjennom** `GO_LIVE_READINESS_CHECKLIST.md` og tildel eiere per seksjon.  
2. **Stikkprøve-audit** av API-ruter med høy risiko (`backoffice`, `superadmin`, `admin`, betaling).  
3. **Miljø:** bekreft `CRON_SECRET`, `SYSTEM_MOTOR_SECRET`, Supabase URL/keys — uten å logge dem.  
4. **Uke/ordre:** manuell QA-sesjon for fredag 15:00 + torsdag 08:00 + samme-dag 08:00 (ansatt-flow).  
5. **Support:** ett-siders runbook for topp 5 henvendelser.

---

## Mellomlang sikt

1. **`strict: true`** plan (inkrementelt eller per pakke).  
2. **Lasttest** med definert mål (samtidige brukere, varighet).  
3. **Observability:** samle logger + minimum alerting (5xx, cron silence).  
4. **Ukeplan-dualitet:** arkitekturavgjørelse (Sanity vs operativ meny) — **egen** beslutning, ikke skjult i H0.

---

## Det som ikke skal startes «automatisk» fra H0

- Nye produktfaser (f.eks. ESG-automatisering, ny SEO-motor).  
- Stor auth-refaktor eller middleware med rolle.  
- Skaleringsarkitektur (replika, sharding) uten måling.

---

## Referanser

- Baseline: `REPO_DEEP_DIVE_REPORT.md`  
- Senere delta: `docs/phase2d/PHASE2D_BASELINE_DELTA_AUDIT.md` (2D-kontekst)
