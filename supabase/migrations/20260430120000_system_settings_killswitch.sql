-- system_settings.killswitch — additive column alignment (no data loss)
-- Application expects jsonb killswitch on public.system_settings.

alter table public.system_settings
add column if not exists killswitch jsonb default '{}'::jsonb;

update public.system_settings
set killswitch = '{}'::jsonb
where killswitch is null;

alter table public.system_settings
alter column killswitch set not null;
