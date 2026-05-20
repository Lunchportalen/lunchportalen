# MP5 Fase D — prod content revert (2026-05-20)

## Strategi

`id-segment`: kun `menuDay` med `_id` som inneholder `-ENTERPRISE-`.

**Ikke revertert:** 30 Melhus med `-LUXUS-` i id + 12 orphan (oppdatert `2026-05-15`, før Patch 12).

## Kjøring

```bash
npx tsx studio/scripts/revert-enterprise-tier.ts --confirm --dataset production
```

## Verifikasjon (prod GROQ)

| Metrikk | Forventet | Faktisk |
|---------|-----------|---------|
| `planTier == "ENTERPRISE"` | 30 | **30** |
| `planTier == "LUXUS"` (alle) | 42 | **42** |
| Melhus LUXUS | 42 | **42** |
| Melhus `-LUXUS-` segment | 30 | **30** |
| Melhus orphans (uten tier-segment) | 12 | **12** |

## Audit

30 JSON-linjer: `docs/audit/mp5-enterprise-tier-revert.log`

Patch 12-rapportens «36» var overestimering; reelt **30** deterministiske ENTERPRISE-kandidater.
