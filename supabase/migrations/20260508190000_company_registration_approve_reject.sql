begin;

create extension if not exists pgcrypto;

-- Schema-safe hardening for the registration approval flow.
alter table if exists public.company_registrations
  add column if not exists status text not null default 'PENDING',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid null references auth.users(id) on delete set null,
  add column if not exists rejected_reason text,
  add column if not exists agreement_id uuid null references public.agreements(id) on delete set null;

alter table if exists public.company_invites
  add column if not exists company_id uuid references public.companies(id) on update cascade on delete cascade,
  add column if not exists email text,
  add column if not exists role text,
  add column if not exists token_hash text,
  add column if not exists expires_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.agreements
  add column if not exists submitted_by_email text,
  add column if not exists submitted_by_name text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists rejected_reason_internal text,
  add column if not exists price_per_employee numeric,
  add column if not exists comment_from_company text,
  add column if not exists start_date date;

alter table if exists public.companies
  add column if not exists agreement_json jsonb;

create unique index if not exists company_invites_token_hash_uniq
  on public.company_invites (token_hash)
  where token_hash is not null;

create index if not exists company_invites_company_role_email_idx
  on public.company_invites (company_id, role, lower(email))
  where revoked_at is null and accepted_at is null;

create or replace function public.lp_company_registration_approve(
  p_registration_id uuid,
  p_actor_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_registration public.company_registrations%rowtype;
  v_company public.companies%rowtype;
  v_location_id uuid;
  v_agreement_id uuid;
  v_invite_id uuid;
  v_token_hash text;
  v_now timestamptz := now();
  v_weekday_tiers jsonb;
  v_delivery_days text[];
  v_day text;
  v_tier text;
  v_first_tier text := null;
  v_slot_start time := time '11:00';
  v_slot_end time := time '13:00';
  v_binding integer;
  v_notice integer;
  v_agreement_json jsonb;
begin
  if p_registration_id is null then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_ID_REQUIRED';
  end if;

  select *
    into v_registration
  from public.company_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'REGISTRATION_NOT_FOUND';
  end if;

  if upper(coalesce(v_registration.status, '')) <> 'PENDING' then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_NOT_PENDING';
  end if;

  if v_registration.company_id is null then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_COMPANY_REQUIRED';
  end if;

  select *
    into v_company
  from public.companies
  where id = v_registration.company_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COMPANY_NOT_FOUND';
  end if;

  select cl.id
    into v_location_id
  from public.company_locations cl
  where cl.company_id = v_registration.company_id
  order by
    case when cl.id = v_company.default_location_id then 0 else 1 end,
    cl.created_at asc,
    cl.id asc
  limit 1
  for update;

  if v_location_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_LOCATION_REQUIRED';
  end if;

  if exists (
    select 1
    from public.agreements a
    where a.company_id = v_registration.company_id
      and a.status = 'ACTIVE'::public.agreement_status
    for update
  ) then
    raise exception using errcode = 'P0001', message = 'ACTIVE_AGREEMENT_EXISTS';
  end if;

  if nullif(btrim(coalesce(v_registration.contact_email, v_registration.submitted_by_email, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'CONTACT_EMAIL_REQUIRED';
  end if;

  v_weekday_tiers := case
    when jsonb_typeof(v_registration.weekday_meal_tiers) = 'object' then v_registration.weekday_meal_tiers
    else null
  end;

  if v_weekday_tiers is null then
    raise exception using errcode = 'P0001', message = 'WEEKDAY_MEAL_TIERS_REQUIRED';
  end if;

  foreach v_day in array array['mon', 'tue', 'wed', 'thu', 'fri']::text[] loop
    v_tier := upper(btrim(coalesce(v_weekday_tiers ->> v_day, '')));
    if v_tier not in ('BASIS', 'LUXUS') then
      raise exception using errcode = 'P0001', message = 'WEEKDAY_MEAL_TIERS_INVALID';
    end if;
    v_delivery_days := array_append(v_delivery_days, v_day);
    v_first_tier := coalesce(v_first_tier, v_tier);
  end loop;

  if v_registration.delivery_window_from is not null
     and btrim(v_registration.delivery_window_from::text) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]' then
    v_slot_start := left(btrim(v_registration.delivery_window_from::text), 5)::time;
  end if;

  if v_registration.delivery_window_to is not null
     and btrim(v_registration.delivery_window_to::text) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]' then
    v_slot_end := left(btrim(v_registration.delivery_window_to::text), 5)::time;
  end if;

  if v_slot_end <= v_slot_start then
    raise exception using errcode = 'P0001', message = 'DELIVERY_WINDOW_INVALID';
  end if;

  v_binding := greatest(1, coalesce(v_registration.terms_binding_months, 12));
  v_notice := greatest(0, coalesce(v_registration.terms_notice_months, 3));

  v_agreement_json := jsonb_build_object(
    'version', 1,
    'source', 'company_registration_approve',
    'registration_id', v_registration.id,
    'company_id', v_registration.company_id,
    'created_at', v_now,
    'admin', jsonb_build_object(
      'name', coalesce(v_registration.contact_name, v_registration.submitted_by_name),
      'email', coalesce(v_registration.contact_email, v_registration.submitted_by_email),
      'phone', v_registration.contact_phone
    ),
    'plan', jsonb_build_object(
      'days', jsonb_build_object(
        'mon', jsonb_build_object('enabled', true, 'tier', upper(v_weekday_tiers ->> 'mon')),
        'tue', jsonb_build_object('enabled', true, 'tier', upper(v_weekday_tiers ->> 'tue')),
        'wed', jsonb_build_object('enabled', true, 'tier', upper(v_weekday_tiers ->> 'wed')),
        'thu', jsonb_build_object('enabled', true, 'tier', upper(v_weekday_tiers ->> 'thu')),
        'fri', jsonb_build_object('enabled', true, 'tier', upper(v_weekday_tiers ->> 'fri'))
      )
    ),
    'terms', jsonb_build_object(
      'binding_months', v_binding,
      'notice_months', v_notice
    ),
    'delivery', jsonb_build_object(
      'window_from', to_char(v_slot_start, 'HH24:MI'),
      'window_to', to_char(v_slot_end, 'HH24:MI')
    ),
    'submitted_payload', coalesce(v_registration.submitted_payload, '{}'::jsonb),
    'raw_payload', coalesce(v_registration.raw_payload, '{}'::jsonb)
  );

  update public.companies
     set status = 'ACTIVE'::public.company_status,
         agreement_json = v_agreement_json,
         updated_at = v_now
   where id = v_registration.company_id;

  insert into public.agreements (
    company_id,
    location_id,
    tier,
    status,
    delivery_days,
    slot_start,
    slot_end,
    starts_at,
    start_date,
    binding_months,
    notice_months,
    price_per_employee,
    submitted_by_email,
    submitted_by_name,
    reviewed_by,
    reviewed_at,
    approved_at,
    activated_at,
    comment_from_company
  )
  values (
    v_registration.company_id,
    v_location_id,
    v_first_tier::public.agreement_tier,
    'ACTIVE'::public.agreement_status,
    to_jsonb(v_delivery_days),
    v_slot_start,
    v_slot_end,
    current_date,
    current_date,
    v_binding,
    v_notice,
    null,
    coalesce(v_registration.contact_email, v_registration.submitted_by_email),
    coalesce(v_registration.contact_name, v_registration.submitted_by_name),
    p_actor_user_id,
    v_now,
    v_now,
    v_now,
    'Godkjent fra company_registrations.'
  )
  returning id into v_agreement_id;

  update public.company_registrations
     set status = 'APPROVED',
         reviewed_at = v_now,
         reviewed_by = p_actor_user_id,
         agreement_id = v_agreement_id,
         updated_at = v_now
   where id = v_registration.id;

  if to_regprocedure('public.lp_materialize_agreement_day_slots(uuid,uuid)') is not null then
    perform public.lp_materialize_agreement_day_slots(v_registration.company_id, v_agreement_id);
  end if;

  v_token_hash := encode(digest(
    gen_random_uuid()::text || ':' || clock_timestamp()::text || ':' || v_registration.company_id::text,
    'sha256'
  ), 'hex');

  select ci.id
    into v_invite_id
  from public.company_invites ci
  where ci.company_id = v_registration.company_id
    and ci.revoked_at is null
    and ci.accepted_at is null
  order by ci.created_at desc, ci.id desc
  limit 1
  for update;

  if v_invite_id is null then
    insert into public.company_invites (
      company_id,
      code,
      email,
      role,
      token_hash,
      expires_at,
      created_by,
      created_at,
      updated_at
    )
    values (
      v_registration.company_id,
      'hash:' || left(v_token_hash, 32),
      lower(coalesce(v_registration.contact_email, v_registration.submitted_by_email)),
      'company_admin',
      v_token_hash,
      v_now + interval '7 days',
      p_actor_user_id,
      v_now,
      v_now
    )
    returning id into v_invite_id;
  else
    update public.company_invites
       set email = lower(coalesce(v_registration.contact_email, v_registration.submitted_by_email)),
           role = 'company_admin',
           token_hash = v_token_hash,
           expires_at = v_now + interval '7 days',
           updated_at = v_now
     where id = v_invite_id;
  end if;

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by
  )
  values (
    'company_registration.approved:' || v_registration.id::text,
    jsonb_build_object(
      'event', 'company_registration.approved',
      'type', 'company_registration.approved',
      'from', 'Lunchportalen <no-reply@lunchportalen.no>',
      'to', lower(coalesce(v_registration.contact_email, v_registration.submitted_by_email)),
      'subject', 'Firmaet er godkjent i Lunchportalen',
      'bodyText', 'Hei ' || coalesce(v_registration.contact_name, v_registration.submitted_by_name, '') || E',\n\nFirmaet ' || coalesce(v_registration.company_name, v_company.name, 'deres') || ' er godkjent i Lunchportalen. Vi har opprettet en trygg invitasjon for firmaadministrator.\n\nVennlig hilsen Lunchportalen',
      'bodyHtml', '<p>Hei ' || coalesce(v_registration.contact_name, v_registration.submitted_by_name, '') || '</p><p>Firmaet ' || coalesce(v_registration.company_name, v_company.name, 'deres') || ' er godkjent i Lunchportalen. Vi har opprettet en trygg invitasjon for firmaadministrator.</p><p>Vennlig hilsen Lunchportalen</p>',
      'company_id', v_registration.company_id,
      'registration_id', v_registration.id,
      'agreement_id', v_agreement_id,
      'invite_id', v_invite_id
    ),
    'PENDING',
    0,
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  return json_build_object(
    'registration_id', v_registration.id,
    'company_id', v_registration.company_id,
    'agreement_id', v_agreement_id,
    'invite_id', v_invite_id,
    'status', 'APPROVED'
  );
end;
$function$;

create or replace function public.lp_company_registration_reject(
  p_registration_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_registration public.company_registrations%rowtype;
  v_company public.companies%rowtype;
  v_now timestamptz := now();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_registration_id is null then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_ID_REQUIRED';
  end if;

  select *
    into v_registration
  from public.company_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'REGISTRATION_NOT_FOUND';
  end if;

  if upper(coalesce(v_registration.status, '')) <> 'PENDING' then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_NOT_PENDING';
  end if;

  select *
    into v_company
  from public.companies
  where id = v_registration.company_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COMPANY_NOT_FOUND';
  end if;

  update public.company_registrations
     set status = 'REJECTED',
         reviewed_at = v_now,
         reviewed_by = p_actor_user_id,
         rejected_reason = v_reason,
         updated_at = v_now
   where id = v_registration.id;

  -- Legacy agreements.PENDING cleanup is intentionally not performed here.
  -- company_registrations is the pending source of truth, and legacy agreement
  -- mapping is not safe to infer inside this RPC.

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by
  )
  values (
    'company_registration.rejected:' || v_registration.id::text,
    jsonb_build_object(
      'event', 'company_registration.rejected',
      'type', 'company_registration.rejected',
      'from', 'Lunchportalen <no-reply@lunchportalen.no>',
      'to', lower(coalesce(v_registration.contact_email, v_registration.submitted_by_email)),
      'subject', 'Takk for interessen for Lunchportalen',
      'bodyText', 'Hei ' || coalesce(v_registration.contact_name, v_registration.submitted_by_name, '') || E',\n\nTakk for at dere registrerte ' || coalesce(v_registration.company_name, v_company.name, 'firmaet') || '. Vi kan dessverre ikke godkjenne registreringen akkurat nå.' || case when v_reason is null then '' else E'\n\nBegrunnelse: ' || v_reason end || E'\n\nVennlig hilsen Lunchportalen',
      'bodyHtml', '<p>Hei ' || coalesce(v_registration.contact_name, v_registration.submitted_by_name, '') || '</p><p>Takk for at dere registrerte ' || coalesce(v_registration.company_name, v_company.name, 'firmaet') || '. Vi kan dessverre ikke godkjenne registreringen akkurat nå.</p>' || case when v_reason is null then '' else '<p>Begrunnelse: ' || v_reason || '</p>' end || '<p>Vennlig hilsen Lunchportalen</p>',
      'company_id', v_registration.company_id,
      'registration_id', v_registration.id,
      'reason', v_reason
    ),
    'PENDING',
    0,
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  return json_build_object(
    'registration_id', v_registration.id,
    'company_id', v_registration.company_id,
    'status', 'REJECTED'
  );
end;
$function$;

revoke all on function public.lp_company_registration_approve(uuid, uuid) from public;
revoke all on function public.lp_company_registration_approve(uuid, uuid) from anon;
revoke all on function public.lp_company_registration_approve(uuid, uuid) from authenticated;
grant execute on function public.lp_company_registration_approve(uuid, uuid) to service_role;
grant execute on function public.lp_company_registration_approve(uuid, uuid) to postgres;

revoke all on function public.lp_company_registration_reject(uuid, uuid, text) from public;
revoke all on function public.lp_company_registration_reject(uuid, uuid, text) from anon;
revoke all on function public.lp_company_registration_reject(uuid, uuid, text) from authenticated;
grant execute on function public.lp_company_registration_reject(uuid, uuid, text) to service_role;
grant execute on function public.lp_company_registration_reject(uuid, uuid, text) to postgres;

commit;
