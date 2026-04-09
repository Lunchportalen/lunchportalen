# U30X — Docs prune decision

**Prinsipp:** Kode vinner over utdatert markdown. Ingen massesletting i denne runden — alle fem «DELETE»-kriterier var ikke samtidig oppfylt for konkrete filer uten å miste revisjonsspor.

## Klassifisering (utdrag)

| Fil / mønster | Status | Begrunnelse |
|-----------------|--------|-------------|
| `docs/umbraco-parity/U30*.md` | SUPERSEDED (narrativt av U30X) | Historisk leveranse; fortsatt sporbar kontekst |
| `docs/umbraco-parity/U30R*.md` | SUPERSEDED (narrativt av U30X) | Reparaturredaksjon; overlapp med U30, men nyttig diff-historikk |
| `docs/phase2b/CONTENT_TREE_*.md` | CURRENT (teknisk flyt) | Matcher fortsatt tree + parse; oppdater ved API-endring |
| `docs/cms-control-plane/**` | CURRENT (kontrakt) | Styringsdokumenter — ikke slettet |

## DELETE_CANDIDATE

Ingen filer slettet i U30X. Ved fremtidig opprydding: slå sammen `U30_DECISION` + `U30R_DECISION` til én kanonisk beslutning når eier eksplisitt arkiverer R-varianten.

## MISLEADING (adferd rettet i kode)

- Tidligere antakelse om at «does not exist» i tree-API alltid betød manglende tabell — **rettet i kode** (`tree/route.ts`).
