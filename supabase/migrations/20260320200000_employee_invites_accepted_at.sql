-- Optional explicit acceptance timestamp (mirrors used_at when invite is consumed).

begin;

alter table public.employee_invites
  add column if not exists accepted_at timestamptz null;

update public.employee_invites
set accepted_at = used_at
where used_at is not null
  and accepted_at is null;

commit;
