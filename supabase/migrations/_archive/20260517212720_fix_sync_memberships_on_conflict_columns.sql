-- fix_sync_memberships_on_conflict_columns (registered in prod as 20260517212720)
--
-- Idempotent re-apply of sync_memberships_from_legacy_profile + trigger.
-- Prod had a bad statement logged for 20260517212545 (typo: user_id,_location_id in ON CONFLICT);
-- this migration restores the canonical body matching 20260517212545_sync_memberships_with_status.sql.

-- Sync legacy profile -> company_memberships med korrekt lifecycle.
--
-- ENDRING:
-- company_memberships får nå:
--   * status = 'active' / 'suspended' basert på profile-tilstand
--   * activated_at = now() ved første aktivering
--   * active = TRUE alltid (raden eksisterer, ikke lifecycle)
--   * Dette unngår kaskade-sletting via recompute-trigger
--
-- location_memberships forblir uendret: active reflekterer fortsatt
-- profile-tilstand (legacy-modell, fix senere).
--
-- Trigger lytter også på UPDATE OF is_active (var bug i forrige versjon).

create or replace function public.sync_memberships_from_legacy_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_company_role public.membership_role;
  v_location_role public.membership_role;
  v_profile_active boolean;
  v_membership_status public.membership_status;
  v_activated_at timestamptz;
begin
  v_company_role := case
    when lower(coalesce(new.role::text, '')) = 'company_admin' then 'company_admin'::public.membership_role
    else 'employee'::public.membership_role
  end;
  v_location_role := case
    when lower(coalesce(new.role::text, '')) = 'location_admin' then 'location_admin'::public.membership_role
    else 'employee'::public.membership_role
  end;
  v_profile_active := coalesce(new.active, true)
                      and coalesce(new.is_active, true)
                      and new.archived_at is null
                      and new.disabled_at is null;
  v_membership_status := case
    when v_profile_active then 'active'::public.membership_status
    else 'suspended'::public.membership_status
  end;
  v_activated_at := case
    when v_profile_active then now()
    else null
  end;

  -- Rydd opp company memberships for endret scope (kun ved firma-bytte eller null)
  delete from public.company_memberships cm
  where cm.user_id = new.id
    and cm.source = 'legacy_profile_sync'
    and (
      new.company_id is null
      or cm.company_id <> new.company_id
    );

  if new.company_id is not null then
    insert into public.company_memberships (
      user_id,
      company_id,
      role,
      active,
      status,
      activated_at,
      source,
      created_at,
      updated_at
    )
    values (
      new.id,
      new.company_id,
      v_company_role,
      true,  -- ALLTID true; lifecycle håndteres via status
      v_membership_status,
      v_activated_at,
      'legacy_profile_sync',
      coalesce(new.created_at, now()),
      now()
    )
    on conflict (user_id, company_id) do update
    set role = case
                 when public.company_memberships.source <> 'legacy_profile_sync' then public.company_memberships.role
                 when excluded.role = 'company_admin'::public.membership_role then excluded.role
                 else public.company_memberships.role
               end,
        active = case
                   when public.company_memberships.source <> 'legacy_profile_sync' then public.company_memberships.active
                   else true  -- ALLTID true for legacy_profile_sync
                 end,
        status = case
                   when public.company_memberships.source <> 'legacy_profile_sync' then public.company_memberships.status
                   when excluded.status = 'active'::public.membership_status then 'active'::public.membership_status
                   when public.company_memberships.status = 'active'::public.membership_status then 'suspended'::public.membership_status
                   else public.company_memberships.status
                 end,
        activated_at = case
                         when public.company_memberships.source <> 'legacy_profile_sync' then public.company_memberships.activated_at
                         when excluded.status = 'active'::public.membership_status then coalesce(public.company_memberships.activated_at, now())
                         else public.company_memberships.activated_at
                       end,
        source = case
                   when public.company_memberships.source = 'manual' then public.company_memberships.source
                   else excluded.source
                 end,
        updated_at = case
                       when public.company_memberships.source <> 'legacy_profile_sync' then public.company_memberships.updated_at
                       else now()
                     end;
  end if;

  -- location_memberships: UENDRET fra original (bruker active-modell)
  delete from public.location_memberships lm
  where lm.user_id = new.id
    and lm.source = 'legacy_profile_sync'
    and (
      new.company_id is null
      or new.location_id is null
      or lm.company_id <> new.company_id
      or lm.location_id <> new.location_id
    );

  if new.company_id is not null and new.location_id is not null then
    insert into public.location_memberships (
      user_id, company_id, location_id, role, active, source, created_at, updated_at
    )
    values (
      new.id, new.company_id, new.location_id, v_location_role, v_profile_active,
      'legacy_profile_sync', coalesce(new.created_at, now()), now()
    )
    on conflict (user_id, location_id) do update
    set company_id = excluded.company_id,
        role = case
                 when excluded.role = 'location_admin'::public.membership_role then excluded.role
                 else public.location_memberships.role
               end,
        active = excluded.active,
        source = case
                   when public.location_memberships.source = 'manual' then public.location_memberships.source
                   else excluded.source
                 end,
        updated_at = now();
  end if;

  return new;
end;
$function$;

-- Oppdater trigger til også å lytte på is_active
drop trigger if exists trg_profiles_sync_memberships on public.profiles;
create trigger trg_profiles_sync_memberships
after insert or update of company_id, location_id, role, active, is_active, disabled_at, archived_at
on public.profiles
for each row
execute function public.sync_memberships_from_legacy_profile();
