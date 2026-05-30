-- Persist Control Tower autopilot state across server restarts.
-- Runtime reads this column through service_role and syncs process-local state.

begin;

alter table public.system_settings
  add column if not exists autopilot_enabled boolean not null default false;

update public.system_settings
set autopilot_enabled = false
where autopilot_enabled is null;

commit;
