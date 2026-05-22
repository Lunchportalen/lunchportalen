-- TPT-B-7b-hotfix-6: repair service_role table grants (staging schema-drift; no-op on prod if already granted)
begin;

grant select on table public.billing_tax_codes to service_role;

grant select, insert, update, delete on table public.tripletex_customers to service_role;

commit;
