# U19 — Indexed discovery model

## Eksisterende (U18)

- `filterBackofficeNavItems` + `discoveryAliases` + søkeblob i registry.

## U19 — «Indeks» tolkning

| Begrep | Betydning i LP |
|--------|----------------|
| Indeks | **Precomputert** `Map<href, blob>` fra `BACKOFFICE_EXTENSION_REGISTRY` |
| Rankering | `rankDiscoveryNavItems` — score på delstreng og ord-tokens + lett boost for TopBar-ruter |

## Ikke bygget

- Ekstern søkemotor, crawler, eller ny API.

## Trygg utvidelse senere

- Flere felt i blob (f.eks. dokumenterte tags) uten ny plattform.
