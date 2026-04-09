# Forretningsmodell — Lunchportalen

Dokumentet beskriver **modell og prinsipper** for prising mot SMB og enterprise. Konkrete prislister hører hjemme i CRM eller eget internt prisark — ikke i offentlig repo uten godkjenning.

## Inntektsform

**SaaS-abonnement** — abonnementsperiode typisk månedlig eller årlig (årlig ofte med rabatt).

## Prisdimensjoner

| Dimensjon | Beskrivelse |
|-----------|-------------|
| **Per lokasjon** | Naturlig for multi-location; speiler faktisk drifts- og supportkost |
| **Per aktiv bruker / sete** | Der kunden vil koble pris til faktisk bruk (f.eks. minimum + bruksbasert) |
| **Plattform-/basisavgift** | Fast komponent som dekker drift, sikkerhet og felles kost |

Kombinasjonen **lokasjon + bruker** er vanlig i enterprise: forutsigbar minimum + skalering.

## Enterprise-nivå

Inkluderer typisk:

- Utvidede sikkerhets- og revisjonskrav  
- Dedikert onboarding og navngiven kontaktperson  
- SLA og responstid etter avtale  
- Tilpassede avtalevilkår og DPA-behov  
- Eventuelt SSO og avansert brukerstyring (jf. `docs/enterprise/sso-roadmap.md`)  

## Hva som ikke er kjernemodell

- **Transaksjonsprovisjon per ordre** som primær inntekt (kan vurderes som tillegg, men endrer insentiv)  
- **Ren konsulentforretning** uten gjentakende SaaS (unntatt bevisst tidsbegrenset implementering)  

## Partner og kanal (valgfritt)

- Referansepartner for større kontrakter  
- Integrasjonspartnere (kasse, lønn, regnskap) — ofte co-sell, ikke rev-share som default  

## Neste steg internt

- Lås **standardpakker** (Starter / Professional / Enterprise) med tydelig funksjonsmatrise  
- Legg **listepris** og **rabattregler** i salgsplaybook (ikke nødvendigvis offentlig)  

## Relaterte dokumenter

- [Verdiløfte](value.md)  
- [Enterprise-funksjoner](enterprise.md)  
- [Salgs-one-pager](../sales/one_pager.md)  
