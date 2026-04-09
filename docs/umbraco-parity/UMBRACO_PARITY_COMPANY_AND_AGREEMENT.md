# Umbraco parity — company & agreement (WS2)

## Mål

Firma, kunder, avtaler og lokasjoner som **førsteordens moduler** i fortellingen — **uten ny avtale-sannhet**.

## Dagens mønster (kilde: `controlPlaneDomainActionSurfaces`)

| Modul | Sannhet | CMS-flate | Mutasjon |
|-------|---------|-----------|----------|
| Firma & kunder | Supabase | `/backoffice/customers` | Routing → superadmin |
| Avtale | `company_current_agreement` + JSON | `/backoffice/agreement-runtime` | Review → admin/superadmin ruter |
| Lokasjoner | Telling/visning i speil | Kundekontekst | Superadmin |

## Umbraco-paritet

- **Ikke** falsk «save agreement» i backoffice uten backend — **review + routing**.
- **Tydelig CTA** til `/superadmin/companies`, `/admin/agreement` der mutasjon er trygg og allerede finnes.

## Risiko å unngå

- To mutasjonsstier til samme avtale uten koordinering.
