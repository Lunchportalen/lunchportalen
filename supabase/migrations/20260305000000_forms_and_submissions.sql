-- Phase 21: Form Builder. Superadmin-only RLS. Public API uses service role.

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  environment text not null check (environment in ('prod','staging')),
  locale text not null check (locale in ('nb','en')),
  schema jsonb not null default '{}'::jsonb,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forms_env_locale_idx on public.forms (environment, locale);
create index if not exists forms_created_at_idx on public.forms (created_at desc);

alter table public.forms enable row level security;
drop policy if exists forms_select_superadmin on public.forms;
create policy forms_select_superadmin on public.forms for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
drop policy if exists forms_all_superadmin on public.forms;
create policy forms_all_superadmin on public.forms for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
revoke all on public.forms from anon, authenticated;
grant select, insert, update on public.forms to authenticated;

create or replace function public.forms_updated_at()
returns trigger language plpgsql as 
begin
  new.updated_at = now();
  return new;
end;
;
drop trigger if exists forms_updated_at_trigger on public.forms;
create trigger forms_updated_at_trigger
  before update on public.forms
  for each row execute function public.forms_updated_at();

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  environment text not null check (environment in ('prod','staging')),
  locale text not null,
  data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists submissions_form_created_idx on public.form_submissions (form_id, created_at desc);
create index if not exists submissions_env_locale_created_idx on public.form_submissions (environment, locale, created_at desc);

alter table public.form_submissions enable row level security;
drop policy if exists form_submissions_select_superadmin on public.form_submissions;
create policy form_submissions_select_superadmin on public.form_submissions for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
drop policy if exists form_submissions_insert_superadmin on public.form_submissions;
create policy form_submissions_insert_superadmin on public.form_submissions for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
revoke all on public.form_submissions from anon, authenticated;
grant select, insert on public.form_submissions to authenticated;
