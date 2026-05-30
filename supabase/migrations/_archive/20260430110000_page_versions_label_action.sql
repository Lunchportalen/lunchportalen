-- Add human-readable version labels + action codes (additive).

alter table public.page_versions
  add column if not exists label text not null default 'Manuell lagring',
  add column if not exists action text not null default 'save';

-- Replace RPC: include label + action on insert.
drop function if exists public.lp_insert_page_version(uuid, text, text, jsonb, uuid);

create or replace function public.lp_insert_page_version(
  p_page_id uuid,
  p_locale text,
  p_environment text,
  p_data jsonb,
  p_created_by uuid,
  p_label text,
  p_action text
) returns table (id uuid, version_number int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
  v_label text;
  v_action text;
begin
  if not exists (select 1 from public.content_pages where public.content_pages.id = p_page_id) then
    raise exception 'page_not_found';
  end if;

  v_label := nullif(trim(coalesce(p_label, '')), '');
  if v_label is null then
    v_label := 'Manuell lagring';
  end if;

  v_action := nullif(trim(coalesce(p_action, '')), '');
  if v_action is null then
    v_action := 'save';
  end if;

  perform 1 from public.content_pages where public.content_pages.id = p_page_id for update;

  select coalesce(max(pv.version_number), 0) + 1 into v_next
  from public.page_versions pv
  where pv.page_id = p_page_id
    and pv.locale = p_locale
    and pv.environment = p_environment;

  return query
  insert into public.page_versions (page_id, locale, environment, version_number, data, created_by, label, action)
  values (p_page_id, p_locale, p_environment, v_next, p_data, p_created_by, v_label, v_action)
  returning page_versions.id, page_versions.version_number;
end;
$$;

revoke all on function public.lp_insert_page_version(uuid, text, text, jsonb, uuid, text, text) from public;
grant execute on function public.lp_insert_page_version(uuid, text, text, jsonb, uuid, text, text) to service_role;
