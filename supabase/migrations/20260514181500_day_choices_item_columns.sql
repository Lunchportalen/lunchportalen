-- FASE 10C.3: Nullable item-level choice on day_choices (additive).
begin;

alter table public.day_choices
  add column if not exists item_key text,
  add column if not exists item_title_snapshot text;

commit;
