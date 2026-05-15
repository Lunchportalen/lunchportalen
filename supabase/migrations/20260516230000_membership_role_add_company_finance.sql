-- FASE 13-IMPL-3L — Forbered CFO/finance-rolle på memberships.
-- Idempotent enum-utvidelse (PostgreSQL 15+: ADD VALUE IF NOT EXISTS).
-- Apply via normal Supabase migration flow når godkjent.

ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'company_finance';
