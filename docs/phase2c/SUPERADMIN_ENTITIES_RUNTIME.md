# Superadmin — selskaper, avtaler, brukere (2C4 runtime)

## Navigasjon (eksisterende ruter)

| Entitet | Hovedrute | Merknad |
|---------|-----------|---------|
| Selskaper / livsløp | `/superadmin/companies` | Frosset livsløp per AGENTS — kun navigasjon forsterket fra hjem |
| Firmadetaljer | `/superadmin/firms`, `/superadmin/firms/[companyId]` | Eksisterende |
| Avtaler | `/superadmin/agreements`, `/superadmin/agreements/[id]` | Godkjenning/reject på detalj |
| Brukere | `/superadmin/users` | Eksisterende API for disable/cleanup — **høy risiko**; ikke utvidet i 2C4 |
| Enterprise | `/superadmin/enterprise` | Eksisterende |

## 2C4 endringer

- **Hjem (`/superadmin`):** hurtiglenker til Firma, Brukere, Revisjon, Driftsoversikt, Systemhelse, Ventende avtaler.  
- **Ingen** ny datamodell eller duplikatliste — `capabilities` fortsetter å peke på samme sider.

## Filtrering / detalj

- Avtaler: eksisterende statusfilter og søk i `agreements-client`.  
- Selskaper: eksisterende `companies-client` — ikke refaktorert.
