begin;

create extension if not exists pgcrypto;

alter table public.company_invites
  add column if not exists token_hash text,
  add column if not exists used_at timestamptz,
  add column if not exists contact_email text,
  add column if not exists contact_name text;

alter table public.company_invites
  alter column expires_at set default (now() + interval '7 days');

update public.company_invites
   set expires_at = coalesce(expires_at, now() + interval '7 days'),
       contact_email = coalesce(contact_email, email),
       token_hash = coalesce(token_hash, encode(digest(coalesce(code, id::text) || ':' || id::text, 'sha256'), 'hex'))
 where expires_at is null
    or contact_email is null
    or token_hash is null;

do $$
begin
  if exists (select 1 from public.company_invites where token_hash is null or btrim(token_hash) = '') then
    raise exception 'COMPANY_INVITES_TOKEN_HASH_REQUIRED';
  end if;

  if exists (select 1 from public.company_invites where contact_email is null or btrim(contact_email) = '') then
    raise exception 'COMPANY_INVITES_CONTACT_EMAIL_REQUIRED';
  end if;
end $$;

alter table public.company_invites
  alter column token_hash set not null,
  alter column expires_at set not null,
  alter column contact_email set not null,
  alter column code set default ('token:' || gen_random_uuid()::text),
  alter column role set default 'company_admin';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_invites_token_hash_uniq'
      and conrelid = 'public.company_invites'::regclass
  ) then
    alter table public.company_invites
      add constraint company_invites_token_hash_uniq unique (token_hash);
  end if;
end $$;

alter table public.agreements
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.company_registrations
  add column if not exists rejection_reason text;

create or replace function public.lp_agreement_approve_active(
  p_agreement_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_agreement public.agreements%rowtype;
  v_registration public.company_registrations%rowtype;
  v_now timestamptz := now();
begin
  if p_agreement_id is null then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_ID_REQUIRED';
  end if;

  select * into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AGREEMENT_NOT_FOUND';
  end if;

  if upper(v_agreement.status::text) not in ('PENDING', 'ACTIVE') then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_NOT_PENDING';
  end if;

  select * into v_registration
  from public.company_registrations
  where company_id = v_agreement.company_id
  order by case when agreement_id = v_agreement.id then 0 else 1 end, created_at desc, id desc
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'REGISTRATION_NOT_FOUND';
  end if;

  update public.agreements
     set status = 'ACTIVE'::public.agreement_status,
         start_date = coalesce(start_date, current_date),
         reviewed_by = coalesce(reviewed_by, p_actor_user_id),
         reviewed_at = coalesce(reviewed_at, v_now),
         updated_at = v_now
   where id = v_agreement.id;

  update public.companies
     set status = 'ACTIVE'::public.company_status,
         updated_at = v_now
   where id = v_agreement.company_id;

  update public.company_registrations
     set status = 'APPROVED',
         agreement_id = v_agreement.id,
         reviewed_by = p_actor_user_id,
         reviewed_at = v_now,
         updated_at = v_now
   where id = v_registration.id;

  return jsonb_build_object(
    'ok', true,
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'contact_email', v_registration.contact_email,
    'contact_name', v_registration.contact_name
  );
end;
$function$;

create or replace function public.lp_agreement_reject_pending(
  p_agreement_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_agreement public.agreements%rowtype;
  v_registration public.company_registrations%rowtype;
  v_now timestamptz := now();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_agreement_id is null then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_ID_REQUIRED';
  end if;

  select * into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AGREEMENT_NOT_FOUND';
  end if;

  if upper(v_agreement.status::text) not in ('PENDING', 'CLOSED', 'REJECTED') then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_NOT_PENDING';
  end if;

  select * into v_registration
  from public.company_registrations
  where company_id = v_agreement.company_id
  order by case when agreement_id = v_agreement.id then 0 else 1 end, created_at desc, id desc
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'REGISTRATION_NOT_FOUND';
  end if;

  update public.agreements
     set status = 'CLOSED'::public.agreement_status,
         rejection_reason = v_reason,
         reviewed_by = coalesce(reviewed_by, p_actor_user_id),
         reviewed_at = coalesce(reviewed_at, v_now),
         updated_at = v_now
   where id = v_agreement.id;

  update public.companies
     set status = 'CLOSED'::public.company_status,
         updated_at = v_now
   where id = v_agreement.company_id;

  update public.company_registrations
     set status = 'REJECTED',
         agreement_id = v_agreement.id,
         reviewed_by = p_actor_user_id,
         reviewed_at = v_now,
         rejection_reason = v_reason,
         updated_at = v_now
   where id = v_registration.id;

  return jsonb_build_object(
    'ok', true,
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'contact_email', v_registration.contact_email,
    'contact_name', v_registration.contact_name
  );
end;
$function$;

revoke all on function public.lp_agreement_approve_active(uuid, uuid) from public, anon, authenticated;
grant execute on function public.lp_agreement_approve_active(uuid, uuid) to service_role, postgres;

revoke all on function public.lp_agreement_reject_pending(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.lp_agreement_reject_pending(uuid, uuid, text) to service_role, postgres;

commit;
