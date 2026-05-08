begin;

alter table public.companies
  add column if not exists default_location_id uuid null;

alter table public.companies
  drop constraint if exists companies_default_location_id_fkey;

alter table public.companies
  add constraint companies_default_location_id_fkey
  foreign key (default_location_id)
  references public.company_locations (id)
  on update cascade
  on delete set null;

update public.companies c
set default_location_id = only_location.location_id
from (
  select cl.company_id, (array_agg(cl.id order by cl.id::text))[1] as location_id
  from public.company_locations cl
  group by cl.company_id
  having count(*) = 1
) only_location
where c.id = only_location.company_id
  and c.default_location_id is null;

create index if not exists companies_default_location_id_idx
  on public.companies (default_location_id)
  where default_location_id is not null;

commit;
