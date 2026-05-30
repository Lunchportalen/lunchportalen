-- U30R — Sikre at page_key finnes der eldre databaser ikke har kjørt 20260417010000.
-- Idempotent: trygg å kjøre flere ganger.

alter table public.content_pages add column if not exists page_key text;

comment on column public.content_pages.page_key is 'Stabil side-klassifisering (home, employee_week, …); tree/API bruker fallback fra slug hvis null.';
