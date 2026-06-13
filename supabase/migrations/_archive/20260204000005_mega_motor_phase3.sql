-- supabase/migrations/20260204_mega_motor_phase3.sql
alter table if exists public.orders
  add column if not exists integrity_status text not null default 'ok';

alter table if exists public.orders
  add column if not exists integrity_reason text;

alter table if exists public.orders
  add column if not exists integrity_rid text;

update public.orders
  set integrity_status = 'ok'
  where integrity_status is null;

create index if not exists orders_integrity_status_date_idx
  on public.orders (integrity_status, date);
