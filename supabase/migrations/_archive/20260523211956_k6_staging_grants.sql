-- K6 staging parity: GRANTs applied ad-hoc during DC-032 dry-run (MCP).
-- Documents + idempotently restores PostgREST privileges for order preflight chain.
-- Safe to re-run: GRANT is additive.
--
-- Refs: docs/audit/dc-032-staging-paritet-K6.md (Del 4.5.1)

begin;

grant all on table public.closed_dates to service_role;
grant select on table public.company_current_agreement to service_role;
grant select on table public.company_current_agreement_rules to service_role;
grant select on table public.agreement_delivery_days to service_role;
grant select on table public.agreement_delivery_days to authenticated;

commit;
