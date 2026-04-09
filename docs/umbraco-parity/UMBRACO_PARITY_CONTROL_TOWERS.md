# Umbraco parity — control towers (WS4)

## Prinsipp

Tårn er **moduler** i samme produkt: **CMS** forklarer *hvor* og *hvorfor*; **runtime** utfører operativ sannhet.

## Kart (kort)

| Tårn | Runtime | CMS-kobling |
|------|---------|-------------|
| Company admin | `/admin` | Domain surface + lenke |
| Kitchen | `/kitchen` | Read-only + kontekst |
| Driver | `/driver` | Read-only + kontekst |
| Superadmin | `/superadmin` + `/backoffice` | Hub — backoffice som kontrollplan |

## Umbraco-paritet

- **Ingen** sideopplevelse skal fremstå som «lost island» — hver har **entry** fra kontrollplan eller runtime status strip der det gir mening.

## Ikke mål

- Slå sammen ulike roller i én UI.
