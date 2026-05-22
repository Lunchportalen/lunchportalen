-- TPT-B-7b-hotfix-8: full service_role grants for B-7 onboarding/outbox worker (staging schema-drift; idempotent on prod)
begin;

-- Worker reads tier → product mapping (ensureProviderProduct)
grant select on table public.billing_products to service_role;

-- Worker + RPC audit trail (direct inserts from sync handlers; definer RPCs also write here)
grant select, insert on table public.lifecycle_audit_log to service_role;

-- Defensive repeats from hotfix-6 (no-op if already granted)
grant select on table public.billing_tax_codes to service_role;

grant select, insert, update, delete on table public.tripletex_customers to service_role;

commit;
