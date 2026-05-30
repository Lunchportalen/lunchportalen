-- CMS page content versioning (additive). Snapshots per page + locale + environment.
-- Deterministic version_number via row lock on content_pages.

create table if not exists public.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.content_pages (id) on delete cascade,
  locale text not null default 'nb',
  environment text not null default 'prod',
  version_number int not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid null,
  constraint page_versions_env_check check (environment in ('prod', 'staging', 'preview')),
  constraint page_versions_version_positive check (version_number > 0),
  constraint page_versions_unique_triplet unique (page_id, locale, environment, version_number)
);

create index if not exists page_versions_page_locale_env_created_idx
  on public.page_versions (page_id, locale, environment, created_at desc);

alter table public.page_versions enable row level security;

-- Atomic version_number: lock parent page row, then allocate next number for (page, locale, env).
create or replace function public.lp_insert_page_version(
  p_page_id uuid,
  p_locale text,
  p_environment text,
  p_data jsonb,
  p_created_by uuid
) returns table (id uuid, version_number int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  if not exists (select 1 from public.content_pages where public.content_pages.id = p_page_id) then
    raise exception 'page_not_found';
  end if;

  perform 1 from public.content_pages where public.content_pages.id = p_page_id for update;

  select coalesce(max(pv.version_number), 0) + 1 into v_next
  from public.page_versions pv
  where pv.page_id = p_page_id
    and pv.locale = p_locale
    and pv.environment = p_environment;

  return query
  insert into public.page_versions (page_id, locale, environment, version_number, data, created_by)
  values (p_page_id, p_locale, p_environment, v_next, p_data, p_created_by)
  returning page_versions.id, page_versions.version_number;
end;
$$;

revoke all on function public.lp_insert_page_version(uuid, text, text, jsonb, uuid) from public;
grant execute on function public.lp_insert_page_version(uuid, text, text, jsonb, uuid) to service_role;
