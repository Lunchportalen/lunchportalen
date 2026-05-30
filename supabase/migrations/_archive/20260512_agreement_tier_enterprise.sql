-- Legg til ENTERPRISE-verdi til agreement_tier-enum.
-- Additiv migrasjon. Eksisterende avtaler påvirkes ikke.
-- ENTERPRISE = premium-plan med samme 5 kategorier som LUXUS, høyere kvalitet (170 kr eks mva).
--
-- Bakgrunn: lib/cms/menuDay.ts PLAN_TIERS inneholder ['BASIS', 'LUXUS', 'ENTERPRISE'] etter fase 6.
-- Denne migrasjonen synkroniserer Supabase med Sanity/Next-laget.

alter type public.agreement_tier add value if not exists 'ENTERPRISE';
