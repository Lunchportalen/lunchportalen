alter table public.agreements
  add column if not exists submitted_by_email text,
  add column if not exists submitted_by_name text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists rejected_reason_internal text,
  add column if not exists price_per_employee numeric;
