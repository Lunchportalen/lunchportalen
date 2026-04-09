# Teknisk oversikt — for enterprise (ikke-utvikler)

Dette dokumentet forklarer **arkitektur og prinsipper** på et nivå IT og sikkerhet forventer i en innledende vurdering. Det erstatter ikke detaljert sikkerhetsgjennomgang eller penetrasjonstest.

## AI-motor og beslutningsstøtte

- AI brukes til **innhold, forslag og beslutningsstøtte** innenfor definerte rammer  
- **Kritiske grep** (f.eks. spend, publisering) kan kreve **eksplisitt godkjenning** der det er bygget inn  
- Beslutninger og sykluser kan **logges** for sporbarhet (se enterprise-modul og revisjon)  

## Beslutningssystem

- Kombinasjon av **regler, policy, guardrails** og **AI-forslag**  
- Fail-closed der nødvendig data mangler — systemet skal **ikke** gjette seg frem i sensitive økonomiske flyter  

## Dataflyt (forenklet)

1. **Brukere** autentiseres via etablert identitetsleverandør  
2. **Profiler og roller** bestemmer hva som er lov å se og gjøre  
3. **Forretningsdata** (ordre, firma, lokasjon) lagres i database med tilgangsstyring  
4. **Hendelser** (audit) kan skrives append-only der implementert  
5. **Eksterne tjenester** (f.eks. annonseleverandører, AI) kalles kun der integrasjon finnes og er konfigurert  

## Sikkerhet (høyde over bakken)

- **TLS** for trafikk  
- **Hemmeligheter** i miljøvariabler — ikke i kildekode  
- **RLS og tenant-isolasjon** som designprinsipp i database (detaljer i `docs/security/TENANT_ISOLATION.md`)  
- **API-kontrakter** med forutsigbare svar for klienter (suksess/feil med sporings-ID der relevant)  

## Tilgjengelighet og drift

- Drift i sky med mulighet for **health checks** og **statusvisning** for autoriserte roller  
- Endringer i miljø krever **omstart eller redeploy** — ingen «skjult» runtime-magi  

## Dokumentasjon for dypere due diligence

| Tema | Sti |
|------|-----|
| Teknisk + sikkerhetsoversikt | `docs/enterprise/technical-security-overview.md` |
| Tenant-isolasjon | `docs/security/TENANT_ISOLATION.md` |
| Audit | `docs/security/AUDIT_COVERAGE.md` |
| SOC2-matrise (kontekst) | `docs/security/SOC2_CONTROL_MATRIX.md` |

## Ansvarsfordeling (klarering med juridisk)

- **Plattformleverandør:** sikker drift av applikasjon og standard databehandling etter avtale  
- **Kunde:** korrekt brukerstyring, intern prosess, og evt. innhold de legger inn  
