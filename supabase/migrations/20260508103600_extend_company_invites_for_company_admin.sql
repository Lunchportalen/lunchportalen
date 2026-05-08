alter table public.company_invites
  add column if not exists email text,
  add column if not exists role text not null default 'company_admin',
  add column if not exists expires_at timestamptz,
  add column if not exists accepted_at timestamptz;
