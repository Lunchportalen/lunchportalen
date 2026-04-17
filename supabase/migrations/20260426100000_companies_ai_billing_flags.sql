-- AI billing: surface cost vs included plan allowance (revenue-linked ops / invoicing hooks)
alter table public.companies
  add column if not exists ai_billing_flagged boolean not null default false;

alter table public.companies
  add column if not exists ai_billing_flag_reason text null;

alter table public.companies
  add column if not exists ai_billing_evaluated_at timestamptz null;

alter table public.companies
  add column if not exists ai_billing_last_period_cost_usd numeric null;

alter table public.companies
  add column if not exists ai_billing_last_period_overage_usd numeric null;

comment on column public.companies.ai_billing_flagged is 'True when last evaluation found estimated AI cost above plan included threshold.';
