-- Trigger safety: order_status enum has both CANCELED and CANCELLED.
-- lp_orders_outbox_trigger previously only allowed ACTIVE and CANCELLED, so CANCELED (one L)
-- never emitted an outbox event → inconsistent state between orders and outbox.
-- Fix: treat both spellings as cancel and allow both to emit events (deterministic, no invalid state).

create or replace function public.lp_orders_outbox_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_kind text;
  v_event_key text;
begin
  v_status := upper(trim(new.status::text));

  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status
       and new.note is not distinct from old.note
       and new.slot is not distinct from old.slot
       and new.date is not distinct from old.date then
      return new;
    end if;
  end if;

  if v_status not in ('ACTIVE', 'CANCELLED', 'CANCELED') then
    return new;
  end if;

  v_kind := case when v_status in ('CANCELLED', 'CANCELED') then 'cancel' else 'set' end;
  v_event_key := format(
    'order:%s:%s:%s:%s',
    v_kind,
    new.user_id::text,
    new.date::text,
    coalesce(new.slot, 'unknown')
  );

  insert into public.outbox (event_key, payload, status, attempts)
  values (
    v_event_key,
    jsonb_build_object(
      'eventType', case when v_kind = 'cancel' then 'ORDER_CANCELLED' else 'ORDER_PLACED' end,
      'eventKey', v_event_key,
      'userId', new.user_id,
      'companyId', new.company_id,
      'locationId', new.location_id,
      'date', new.date,
      'slot', new.slot,
      'status', v_status,
      'orderId', new.id,
      'timestampISO', now()
    ),
    'PENDING',
    0
  )
  on conflict (event_key) do nothing;

  return new;
end;
$$;
