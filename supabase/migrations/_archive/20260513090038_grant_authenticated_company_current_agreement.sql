-- Gir authenticated tilgang til å lese company_current_agreement viewet.
-- 
-- Tidligere hadde bare service_role og postgres tilgang. Det betydde at
-- company_admin (Inger og andre) ikke kunne lese sin egen avtale via
-- getAgreementStatus(), som resulterte i "Avtale: Ingen aktiv" selv om
-- avtalen var aktiv i databasen.
--
-- RLS-beskyttelse: company_current_agreement-viewet bygger på agreements-
-- tabellen, som har egne RLS-policyer som filtrerer på company_id.
-- En authenticated bruker vil derfor kun se rader for sitt eget firma
-- gjennom dette viewet, selv med SELECT-grant.
--
-- Vi grant'er IKKE de andre 6 agreement-conflict-views
-- (agreement_active_overlap_conflicts_v, agreement_overlap_conflicts_v,
-- agreement_pending_*_v) til authenticated, fordi de kan inneholde data
-- på tvers av firmaer og bør forbli superadmin/service_role-only.
--
-- Idempotent: kan kjøres flere ganger trygt.

grant select on public.company_current_agreement to authenticated;
