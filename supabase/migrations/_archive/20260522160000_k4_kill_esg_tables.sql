-- K4 Bølge 2A: Kill ESG — drop scaffold tables (empty on prod 2026-05-22).
-- Data archived to docs/archive/esg-data-2026-05-22.json before apply.

DROP TABLE IF EXISTS public.esg_daily;
DROP TABLE IF EXISTS public.esg_monthly;
