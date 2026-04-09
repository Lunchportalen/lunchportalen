# Superadmin — sensitive handlinger (2C4 runtime)

## Eksisterende mutasjoner (ikke endret i 2C4)

| Område | Typisk API | Risiko |
|--------|------------|--------|
| Firma activate | `POST .../company/[id]/activate` | Høy — global effekt |
| Firma status | `POST .../companies/set-status` | Høy |
| Avtale approve/reject/activate | Under `app/api/superadmin/agreements/**` | Høy — følsom sannhet |
| Brukere disable/delete/cleanup | `app/api/superadmin/users/**` | Høy |

## Hva 2C4 aktiverte i UI

- **Ingen nye** mutasjonsendepunkter.  
- **Kun** lesing på `/superadmin` (signalbånd).  
- Destruktive handlinger forblir på **eksisterende** sider med egne bekreftelser der de allerede finnes.

## Bevisst utsatt

- Massemutasjon, bulk-set, «ett-klikk» på tvers av firma uten review.  
- Nye delete-flows i kontrollsenteret.

## Før bredere runtime-handlinger

1. Egen sikkerhetsreview per endepunkt.  
2. Audit-spor og idempotens dokumentert.  
3. Egen PR — ikke blandet med IA-leveranser.
