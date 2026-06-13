-- SaaS: billing mirror + plan on company (extends existing multi-tenant core; does not recreate companies/profiles).
-- RLS: tenant-scoped read; superadmin read-all; writes via service role (API/webhooks).

begin;

-- Plan key on company (billing product tier; orthogonal to public.company_status lifecycle)
alter table public.companies
  add column if not exists saas_plan text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_saas_plan_ck'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_saas_plan_ck
      check (saas_plan in ('none', 'basic', 'pro', 'enterprise'));
  end if;
end
$$;

create table if not exists public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on update cascade on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'none',
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_subscriptions_plan_ck check (plan in ('none', 'basic', 'pro', 'enterprise')),
  constraint saas_subscriptions_stripe_sub_uid unique (stripe_subscription_id)
);

create unique index if not exists saas_subscriptions_one_row_per_company
  on public.saas_subscriptions (company_id);

create index if not exists saas_subscriptions_stripe_customer_idx
  on public.saas_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.saas_subscriptions enable row level security;

drop policy if exists saas_subscriptions_select_tenant on public.saas_subscriptions;
create policy saas_subscriptions_select_tenant
  on public.saas_subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = saas_subscriptions.company_id
    )
  );

drop policy if exists saas_subscriptions_select_superadmin on public.saas_subscriptions;
create policy saas_subscriptions_select_superadmin
  on public.saas_subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'superadmin'
    )
  );

comment on table public.saas_subscriptions is 'Stripe subscription mirror; tenant-isolated read; mutations via service role only.';

commit;
