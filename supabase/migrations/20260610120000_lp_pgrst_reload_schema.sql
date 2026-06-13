-- Forward #18: PostgREST schema reload (NOTIFY-only). After revoke lockdown (20260609150000).
-- App: lib/supabase/ensureRpc.ts via supabaseAdmin() → service_role EXECUTE.
-- Archive 20260321181000 also dropped legacy lp_order_set overload; omitted here (out of scope).

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

commit;
