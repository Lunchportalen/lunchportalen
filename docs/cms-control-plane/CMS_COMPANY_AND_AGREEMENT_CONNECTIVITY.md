# Arbeidsstrøm 2 — Company / customer / agreement CMS connectivity

**Dato:** 2026-03-29  
**Mål:** Firma, kunder, avtaler og lokasjoner **forstås og styres narrativt** fra kontrollplanet — **read-first** og **review** der mutasjon er sensitiv.

## Operativ sannhet (uendret)

- **Companies, agreements, locations** lever i **Supabase** og aktiveres via eksisterende admin/superadmin/onboarding-flyt — jf. AGENTS.md **P16** (company lifecycle frozen areas).
- **Ingen ny agreement-tabell** eller CMS-lagret «shadow agreement».

## Eksisterende CMS-koblinger

- `lib/cms/backoffice/getSuperadminCompaniesContent.ts` — bro mellom superadmin-kontekst og innhold.
- **Product/plan helpers:** `lib/cms/getProductPlan.ts`, `tierConfig` — brukes i markedsførings-/CMS-kontekst; må holdes konsistent med **runtime** `plan_tier` i avtale.

## Anbefalt mønster

| Behov | Løsning | Risiko ved feil |
|-------|---------|-----------------|
| Se avtalestatus mens man redigerer innhold | Server component / API som henter **read-only** summary scoped til superadmin | Lekkasje uten scope |
| Forstå hva employee kan bestille | Vis **derived** fra `company_current_agreement` + meal types — ikke CMS-fritekst | Dobbel sannhet |
| Godkjenning av sensitive endringer | Fortsett i **dedikerte** superadmin-ruter — CMS viser «pending» state kun som speil | Feil forventning |

## Ikke gjøre

- POST fra `ContentWorkspace` til `company` eller `agreement` tabeller uten eksplisitt API-design og audit.
- Klient-styrt `company_id` i CMS API-kall — server må alltid bruke `profiles`/session.

## CP1 (runtime integration)

- **Navigasjon:** `/backoffice/control` har seksjon «Operative tårn og runtime-sannhet» med lenker til superadmin **firma**, **system**, **oversikt**, **fakturagrunnlag**, **social engine** — kun bro (ingen ny datalagring i CMS).
- **Agreement-sannhet** forblir i Supabase; CMS muterer ikke avtaler.

## Neste dokumentasjonskobling

- Ved senere read-only aggregater: oppdater `CMS_CONTROL_PLANE_SOT_MAP.md`.
