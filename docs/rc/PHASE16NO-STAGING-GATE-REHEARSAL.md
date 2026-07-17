# PHASE 16NO — STAGING GATE REHEARSAL

**Environment:** staging Supabase `uigxsboqeruxflgzqztl`  
**Applied:** `norway_first_country_activation` (MCP apply_migration)  
**Production:** unchanged

## Results

| Check | Result |
|-------|--------|
| Table `country_production_activation` created | PASS |
| 21 countries seeded, all flags false | PASS |
| `lp_country_production_allowed('NO','order')` | false (accountant REQUIRED) |
| `lp_country_production_allowed('SE','order')` | false |
| `lp_market_commercially_active('NO')` | false |
| Non-NO enable attempt | BLOCKED (`NON_NO_COUNTRY_ACTIVATION_FORBIDDEN`) |
| NO ordering without accountant | BLOCKED (`NORWAY_FISCAL_REQUIRES_ACCOUNTANT_CONFIRMATION`) |
| Global kill switch | remains false |

## Explicitly not done

- Production migration
- Norway ordering enablement
- Commission invoicing enablement
- Accountant confirmation forge
