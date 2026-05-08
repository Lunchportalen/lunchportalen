-- Canonical kitchen batch status per delivery date, delivery window and location.
-- `kitchen_batches` is the physical table. `kitchen_batch` is a compatibility
-- view for existing singular code paths so kitchen and driver share one store.

begin;

create table if not exists public.kitchen_batches (
  id uuid primary key default gen_random_uuid(),
  delivery_date date not null,
  delivery_window text not null default 'lunch',
  company_location_id uuid not null references public.company_locations (id) on delete cascade,
  status text not null default 'QUEUED',
  packed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kitchen_batches_key unique (delivery_date, delivery_window, company_location_id),
  constraint kitchen_batches_status_ck check (upper(status) in ('QUEUED', 'PACKED', 'DELIVERED'))
);

create index if not exists kitchen_batches_delivery_date_idx
  on public.kitchen_batches (delivery_date);

create index if not exists kitchen_batches_location_date_idx
  on public.kitchen_batches (company_location_id, delivery_date);

drop view if exists public.kitchen_batch;
create view public.kitchen_batch as
select
  id,
  delivery_date,
  delivery_window,
  company_location_id,
  status,
  packed_at,
  delivered_at,
  created_at,
  updated_at
from public.kitchen_batches;

alter table public.kitchen_batches enable row level security;

revoke all on public.kitchen_batches from public;
revoke all on public.kitchen_batches from anon;
revoke all on public.kitchen_batches from authenticated;
grant select, insert, update, delete on public.kitchen_batches to service_role;

revoke all on public.kitchen_batch from public;
revoke all on public.kitchen_batch from anon;
revoke all on public.kitchen_batch from authenticated;
grant select, insert, update, delete on public.kitchen_batch to service_role;

do $$
begin
  if to_regprocedure('public.tg_set_updated_at()') is not null then
    drop trigger if exists kitchen_batches_set_updated_at on public.kitchen_batches;
    create trigger kitchen_batches_set_updated_at
      before update on public.kitchen_batches
      for each row execute function public.tg_set_updated_at();
  end if;
end
$$;

comment on table public.kitchen_batches is
  'Canonical kitchen batch status shared by kitchen and driver for date/window/location.';

comment on view public.kitchen_batch is
  'Compatibility alias for legacy singular kitchen_batch code paths. Writes target public.kitchen_batches.';

commit;
