alter table public.agreements
  add column if not exists start_date date;

update public.agreements
set start_date = starts_at
where start_date is null
  and starts_at is not null;
