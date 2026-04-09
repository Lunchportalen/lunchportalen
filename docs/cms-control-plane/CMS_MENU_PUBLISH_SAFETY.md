# CMS — Menu publish safety (CP7)

## Trusler og mitigasjon

| Risiko | Mitigasjon |
|--------|------------|
| Token lekker til klient | `SANITY_WRITE_TOKEN` kun server env; aldri `NEXT_PUBLIC_*` |
| Uautorisert publish | `scopeOr401` + `requireRoleOr403(["superadmin"])` |
| Trodde LP eier ny sannhet | Ingen Postgres-skriv for menyinnhold; kun Sanity Actions |
| Feil dato | Validering 422; ingen partial publish i LP |

## Operativ sjekkliste

- [ ] `SANITY_WRITE_TOKEN` satt i produksjon der broker skal brukes.
- [ ] Superadmin konto begrenset til drift.
- [ ] Etter publish: verifiser at `GET /api/week` viser forventet rad (CDN kan ha kort forsinkelse).

## Feilkoder (API)

- 503 — `SANITY_WRITE_UNAVAILABLE`
- 422 — `INVALID_DATE`
- 404 — `NOT_FOUND`
- 502 — `SANITY_PUBLISH_FAILED`
