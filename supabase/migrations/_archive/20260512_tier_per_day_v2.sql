-- Tier per dag for agreements.
-- Kjor denne som et frittstaende SQL-script i Supabase Studio, uten eksplisitt BEGIN/COMMIT.
-- Noen PostgreSQL-versjoner krever at ALTER TYPE ... ADD VALUE kjores utenfor transaksjon.
--
-- Denne migrasjonen utvider bare skjemaet. Faktisk backfill av eksisterende avtaler
-- (inkludert Melhus sin bekreftede BASIS/LUXUS-fordeling) skjer i fase 8 etter at
-- applikasjonslaget er klart og eksplisitt godkjent.

alter type public.agreement_tier add value if not exists 'ENTERPRISE';

alter table public.agreement_delivery_days
  add column if not exists tier public.agreement_tier not null default 'BASIS';

alter table public.agreements
  add column if not exists price_per_meal_enterprise_nok integer;

create index if not exists idx_agreement_delivery_days_tier
  on public.agreement_delivery_days(agreement_id, tier);
