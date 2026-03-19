-- Domain constraint hardening: enforce documented domain values only.
-- No schema redesign; only CHECK constraints for fields with a single documented value.

begin;

-- company_deletions.mode: only documented value is 'archive+kill-access' (company lifecycle).
alter table public.company_deletions
  drop constraint if exists company_deletions_mode_ck;

alter table public.company_deletions
  add constraint company_deletions_mode_ck
  check (mode in ('archive+kill-access'));

commit;
