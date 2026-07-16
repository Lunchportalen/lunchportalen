-- PHASE 5 (part 1/2): additive agreement_status enum values.
--
-- The agreement state machine gains explicit APPROVED / SUSPENDED / TERMINATED
-- states (requirement: pending → approved → active → suspended → terminated).
-- Existing values (PENDING, ACTIVE, PAUSED, CLOSED, REJECTED) are untouched, so
-- nothing currently working changes behavior — all runtime gates treat
-- "not ACTIVE" as inactive already (lib/agreements/requireActiveAgreement,
-- lib/auth/agreementStatus).
--
-- Enum ADD VALUE must not be used in the same transaction that references the
-- new labels, hence this dedicated migration (part 2 contains the RPCs).

ALTER TYPE public.agreement_status ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE public.agreement_status ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE public.agreement_status ADD VALUE IF NOT EXISTS 'TERMINATED';
