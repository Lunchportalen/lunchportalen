-- Index for FK and tenant filtering: profiles.company_id.
-- Supports: list employees by company (admin), RLS subqueries (company/location scope).
-- No duplicate: no existing index on profiles other than PK.

create index if not exists profiles_company_id_idx
  on public.profiles (company_id);
