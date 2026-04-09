# U17 — Company / agreement / tower parity

**Arbeidsstrøm 4** — mål: domener og tårn føles som moduler under **samme** CMS-verden (IA + routing), ikke nye tårn.

## Tårn (eksisterende — ikke dupliser)

| Tower | Route-prefix | CMS-relasjon |
|-------|--------------|--------------|
| Company admin | `/admin` | Lenker/IA fra backoffice der policy tillater; **sannhet** i runtime |
| Kitchen | `/kitchen` | Read-only status; operativ produksjon |
| Driver | `/driver` | Leveranse |
| Superadmin | `/superadmin` | Frosset flows — **AGENTS.md** |

## Prinsipp

- **CMS control plane** eier **lesing, review, approval, publish, forklaring**.
- **Operational runtime** eier **auth, ordre, faktura, leveranse, audit events**.

## Agreement / firma / lokasjon

- Ingen ny agreement-sannhet i U17.
- Eventuelle CMS-nære flater = **eksisterende** admin/superadmin med **tydelig** språk om kilde.

## Referanse

- `CP11_DOMAIN_AND_TOWER_PARITY.md`, `CP12_DOMAIN_TOWER_PARITY.md`
