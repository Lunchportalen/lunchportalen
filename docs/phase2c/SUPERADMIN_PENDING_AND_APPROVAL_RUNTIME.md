# Superadmin — pending og godkjenning (2C4 runtime)

## Datakilder (ekte)

| Behov | Kilde | UI-inngang |
|-------|--------|------------|
| Ventende **firma** (status) | `companies.status` — pending-telling i `loadSuperadminHomeSignals` | Signal «Firma (venter)» → `/superadmin/companies` |
| Ventende **avtaler** | `agreements.status = 'PENDING'` — antall i `loadSuperadminHomeSignals` | Signal «Avtaler (venter godkjenning)» → `/superadmin/agreements` |
| Avtaleliste + filter | `GET /api/superadmin/agreements/list` (brukes av klient) | Eksisterende `agreements-client` |
| Aktivering / godkjenning | `POST` på eksisterende ruter (`approve`, `reject`, `activate` under `app/api/superadmin/agreements/...`) | Detaljsider — **ikke** endret i 2C4 |

## Hva 2C4 gjorde

- **Synlighet:** pending-tall på `/superadmin` med direkte lenker.  
- **Ingen** ny approve/reject-knapp på forsiden — unngår destruktive handlinger uten kontekst.

## Hva som ikke er «trygt» å automatisere her

- Bulk-godkjenning uten gjennomgang — **ikke** levert.  
- Endring av onboarding-kø uten idempotens — **ikke** rørt.

## Forventet brukerflyt

1. Åpne `/superadmin` → se om signaler > 0.  
2. Gå til **Avtaler** eller **Firma** → bruk eksisterende skjermbilder for beslutning.
