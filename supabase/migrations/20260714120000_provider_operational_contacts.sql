-- Provider-owned operational contacts (additive, nullable).
-- Each provider manages its own operations/kitchen/delivery notification e-mails.
--
-- RLS: intentionally unchanged. Existing provider_settings policies cover the new
-- columns (select via app_active_org()/platform admin, write via platform admin or
-- service_role). provider_admin writes go through a guarded server action that uses
-- the service-role client after an explicit provider_memberships role check.

alter table public.provider_settings
  add column if not exists operations_email text null,
  add column if not exists kitchen_email text null,
  add column if not exists delivery_email text null;

comment on column public.provider_settings.operations_email is
  'Provider-owned recipient for order/operations notifications. Null = fall back to providers.contact_email.';
comment on column public.provider_settings.kitchen_email is
  'Provider-owned recipient for kitchen/production notifications. Null = fall back to operations chain.';
comment on column public.provider_settings.delivery_email is
  'Provider-owned recipient for delivery/driver notifications. Null = fall back to operations chain.';

-- Backfill: seed operations_email from the provider''s existing contact e-mail.
-- No invented addresses; kitchen/delivery stay null until the provider sets them.
update public.provider_settings ps
set operations_email = lower(trim(p.contact_email))
from public.providers p
where p.id = ps.provider_id
  and ps.operations_email is null
  and coalesce(trim(p.contact_email), '') <> '';
