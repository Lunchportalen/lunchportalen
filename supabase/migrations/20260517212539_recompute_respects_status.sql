-- Project profile scope fra memberships, med status-respekt for companies.
--
-- ENDRING:
-- company_memberships filtreres nå på BÅDE active=true OG status IN ('active', 'suspended').
-- Det bevarer profiles.company_id for brukere som er midlertidig deaktivert
-- (status='suspended') så deres tilhørighet ikke nulles.
--
-- Status 'invited' (ikke akseptert) og 'revoked' (permanent kastet ut) gir
-- IKKE scope, slik at profile.company_id korrekt blir null for dem.
--
-- location_memberships er IKKE endret. Den fortsetter med active-modellen
-- inntil location-lifecycle blir aktuelt og status-kolonne legges til.

create or replace function public.project_profile_scope_from_memberships(p_user_id uuid)
 returns table(projected_company_id uuid, projected_location_id uuid)
 language sql
 stable
 set search_path to 'public'
as $function$
  with company_scope as (
    select
      count(*) filter (
        where cm.active = true
          and cm.status in ('active', 'suspended')
      ) as scope_company_memberships,
      (array_agg(cm.company_id order by cm.company_id::text) filter (
        where cm.active = true
          and cm.status in ('active', 'suspended')
      ))[1] as single_company_id
    from public.company_memberships cm
    where cm.user_id = p_user_id
  ),
  location_scope as (
    select
      count(*) filter (where lm.active = true) as active_location_memberships,
      (array_agg(lm.location_id order by lm.location_id::text) filter (where lm.active = true))[1] as single_location_id,
      (array_agg(lm.company_id order by lm.company_id::text) filter (where lm.active = true))[1] as single_location_company_id
    from public.location_memberships lm
    where lm.user_id = p_user_id
  )
  select
    case
      when coalesce(cs.scope_company_memberships, 0) = 1 then cs.single_company_id
      when coalesce(cs.scope_company_memberships, 0) = 0 and coalesce(ls.active_location_memberships, 0) = 1 then ls.single_location_company_id
      else null
    end as projected_company_id,
    case
      when coalesce(ls.active_location_memberships, 0) = 1 then ls.single_location_id
      else null
    end as projected_location_id
  from company_scope cs
  cross join location_scope ls;
$function$;
