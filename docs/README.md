# Lunchportalen dokumentasjon

Toppnivå-index for repository documentation. For naming-regler og hub-struktur: [CONVENTIONS.md](./CONVENTIONS.md).

## Hub-kataloger

| Hub | Beskrivelse | Hovedinnhold |
|-----|-------------|--------------|
| [architecture/](./architecture/) | **Monorepo og systemgrenser** | [monorepo.md](./architecture/monorepo.md) — canonical two-system layout, deploy, data, CI |
| [governance/](./governance/) | Beslutningstaking og prosesser | Codex-policies, drift-prosedyrer, audit-templates |
| [security/](./security/README.md) | Sikkerhetspolicy og runbooks | Threat model, RLS, tenant isolation, incident response |
| [compliance/](./compliance/) | Compliance-rammeverk | SOC2 control matrix, ISO27001 SoA + alignment, GDPR |
| [strategy/](./strategy/) | Forretningsstrategi og audits | Full-repo-audits, frameworks/, GTM-alignment, TECH DD |
| [engineering/](./engineering/) | Teknisk dokumentasjon | Architecture, onboarding, control map, ESG brief |
| [launch/](./launch/) | **Production launch readiness** | [enterprise-production-readiness-audit.md](./launch/enterprise-production-readiness-audit.md) |
| [sales/](./sales/) | Salgsmateriell | Enterprise RFP-templates, AI positioning |

## Audit-record (immutable)

Historiske dokumenter — endres ikke per [CONVENTIONS.md](./CONVENTIONS.md) immutability-regel:

- [audit/](./audit/) — periodiske audit-rapporter med dato-suffix
- [repo-audit/](./repo-audit/) — fullstendige file-classification audits
- [strategy/full-repo-audit-2026-05-25.md](./strategy/full-repo-audit-2026-05-25.md)
- [strategy/phase2-cut-list-2026-05-26.md](./strategy/phase2-cut-list-2026-05-26.md)

## Special directories

- [enterprise/](./enterprise/README.md) — Enterprise DD-pakke (kurert sub-set)
- [umbraco-parity/](./umbraco-parity/) — Auto-generert Umbraco backoffice-eksport (ikke manuelt rediger)

## Toppnivå-filer (legacy/discovery)

docs/ root inneholder ~50 standalone .md-filer fra pre-Sprint-AB discovery-fase. Disse vil organiseres i Fase F naming-sweep. Foreløpig: bruk `grep` eller IDE-søk for å lokalisere spesifikke docs.

---

For developer onboarding: [engineering/developer-onboarding-guide.md](./engineering/developer-onboarding-guide.md)

For DD-pakke: [enterprise/README.md](./enterprise/README.md)
