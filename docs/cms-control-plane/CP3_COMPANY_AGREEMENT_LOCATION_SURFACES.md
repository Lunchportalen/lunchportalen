# CP3 — Company / agreement / location surfaces

**Formål:** Klargjøre hva CMS control plane **gjør** vs. hva som fortsatt krever **superadmin/admin runtime**.

## Read-only i CMS (CP3)

- Liste over firma (siste oppdaterte, begrenset antall) med status, avledet tier/admin fra `agreement_json` der mulig, **antall lokasjoner** fra `company_locations`.
- Aggregater: totale firma-tall, lokasjoner, aktive avtaler (via `loadControlPlaneRuntimeSnapshot`), ordre siste 7 dager (telling).
- **Ingen** ny tabell som autorativ kilde — alt fra eksisterende Supabase + samme superadmin-gate som andre aggregater.

## Review / approval i CMS

- CP3 legger **ikke** inn et nytt godkjenningsløp i databasen.
- «Review» i betydning **menneskelig kontroll**: lese tall og avtalefelt i panel, deretter handle i **superadmin** hvis endring skal utføres.

## Trygg mutasjon fra CMS

- **Ingen** direkte mutasjon av `companies`, avtaler eller lokasjoner fra disse flatene i CP3.
- Endringer skjer fortsatt via eksisterende **superadmin** (og company admin der rollen allerede har det) — CMS **lenker** dit.

## Må fortsatt gå via eksisterende runtime-ruter

| Handling | Rute / flate |
|----------|----------------|
| Firmastatus, arkiv, avtaleendring | `/superadmin/companies`, relaterte API |
| Faktura / billing | Superadmin billing |
| Lokasjons-CRUD der definert | Eksisterende admin/superadmin-flyt |

## Kode

- `loadDomainRuntimeOverview`, `CmsCompanyAgreementLocationPanel`, `/backoffice/domains`, `/backoffice/customers`.
