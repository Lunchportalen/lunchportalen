# Enterprise-funksjoner — Lunchportalen

Oversikt for **innkjøp, IT, sikkerhet og revisjon**. For detaljert teknisk og sikkerhetsdokumentasjon, se `docs/enterprise/` og `docs/security/`.

## Multi-tenant og datatilhørighet

- Data knyttes til **firma og lokasjon** etter definert modell — ikke «åpen pool» på tvers av kunder  
- **Ingen stoling på klient-sendt `company_id`** for tilgang; server er autoritativ kilde der det er implementert  

## Rollebasert tilgang

- Roller som **superadmin**, **bedriftsadmin**, **ansatt**, **kjøkken**, **sjåfør** med tydelig avgrensning  
- Tilgang sjekkes **serverside** der det er påkrevd — ikke «skjult sikkerhet» kun i UI  

## Revisjonsspor (audit trail)

- Sikkerhets- og enterprise-hendelser kan logges med **append-only** tenkning der det er bygget inn  
- Egnet for **intern kontroll**, **hendelsesanalyse** og **dialog med revisor** — omfang avhenger av aktivert funksjonalitet og konfigurasjon  

## Etterlevelse og personvern (GDPR)

- Personvern og databehandleravtale (DPA) etter standard SaaS-praksis  
- Mulighet for **pseudonymisering** i eksportkontekst der det er relevant (se compliance-lag i produktet)  
- **EU/EØS-hosting** og databehandling bør bekreftes i kontraktsunderlag — ikke antas i salg uten fakta  

## Skalerbarhet

- Skybasert arkitektur egnet for **vekst i antall tenants og transaksjoner**  
- Ytelse og kostnad følger bruk; enterprise-avtaler kan inkludere **kapasitetsplanlegging**  

## Observabilitet og drift

- Systemhelse og flytdiagnostikk for superadmin (der aktivert)  
- Støtte for **forutsigbar feilsøking** uten å eksponere sensitive detaljer i UI  

## Integrasjon og SSO (roadmap)

- Se `docs/enterprise/sso-roadmap.md` for retning på enterprise-innlogging  
- API-kontrakter og sikkerhet beskrives i teknisk pakke  

## Salgsbudskap (kort)

«Lunchportalen er bygget for at **riktig person ser riktig data**, at **kritiske handlinger kan spores**, og at **skalering til flere lokasjoner** ikke bryter kontrollen.»

## Neste lesning

- [Teknisk oversikt](technical.md)  
- [Investorpitch](../investor/pitch.md)  
