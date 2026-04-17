-- Programmatic PostgREST schema reload (service_role only). Enables API to pick up new RPC signatures after deploy.
begin;

create or replace function public.lp_pgrst_reload_schema()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform pg_notify('pgrst', 'reload schema');
end;
$$;

revoke all on function public.lp_pgrst_reload_schema() from public;
revoke all on function public.lp_pgrst_reload_schema() from anon;
revoke all on function public.lp_pgrst_reload_schema() from authenticated;
grant execute on function public.lp_pgrst_reload_schema() to service_role;
grant execute on function public.lp_pgrst_reload_schema() to postgres;

-- Legacy 3-arg overload (e.g. p_date, p_note, p_status) shadows canonical 4-arg in PostgREST.
drop function if exists public.lp_order_set(date, text, text);

notify pgrst, 'reload schema';

commit;
