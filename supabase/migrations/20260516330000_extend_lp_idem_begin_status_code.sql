-- Utvid public.lp_idem_begin: returner status_code på COMPLETED cache-hit.
-- FASE 13.5-FIX-2. Lukker kontrakts-lukene i lp_idem_*: cache-hit kunne
-- tidligere ikke gjenskape HTTP-status, kun body. Etter denne migrasjonen
-- kan cachede svar inkludere status_code (fra response_code-kolonnen som
-- allerede finnes).
--
-- Endring er KUN i COMPLETED-grenen i lp_idem_begin. Signatur uendret.
-- Ingen endring av lp_idem_complete / lp_idem_fail / public.idempotency.
-- Idempotent (CREATE OR REPLACE FUNCTION).

BEGIN;

CREATE OR REPLACE FUNCTION public.lp_idem_begin(
  p_scope text,
  p_key text,
  p_request_hash text,
  p_ttl_seconds integer DEFAULT 86400
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  r record;
  now_ts timestamptz := now();
  exp_ts timestamptz := now_ts + make_interval(secs => greatest(p_ttl_seconds, 60));
begin
  -- Normalize
  p_scope := btrim(coalesce(p_scope,''));
  p_key := btrim(coalesce(p_key,''));
  p_request_hash := btrim(coalesce(p_request_hash,''));

  if p_scope = '' or p_key = '' or p_request_hash = '' then
    raise exception 'idempotency: missing scope/key/hash' using errcode='23514';
  end if;

  -- Try fetch existing row
  select scope, key, request_hash, status, response_json, response_code, expires_at
    into r
  from public.idempotency
  where scope = p_scope and key = p_key
  for update;

  if found then
    -- Expired row: allow reuse by resetting
    if r.expires_at is not null and r.expires_at < now_ts then
      update public.idempotency
         set request_hash = p_request_hash,
             status = 'IN_PROGRESS',
             response_code = null,
             response_json = null,
             last_error = null,
             expires_at = exp_ts,
             updated_at = now_ts
       where scope = p_scope and key = p_key;

      return jsonb_build_object('hit', false);
    end if;

    -- If hash mismatch: fail-closed
    if coalesce(r.request_hash,'') <> p_request_hash then
      raise exception 'idempotency hash mismatch for scope=% key=%' , p_scope, p_key
        using errcode='23514';
    end if;

    -- If completed: return cached response
    if r.status = 'COMPLETED' and r.response_json is not null then
      return jsonb_build_object(
        'hit', true,
        'response', r.response_json,
        'status_code', r.response_code
      );
    end if;

    -- If in progress: refuse (prevents duplicate concurrent execution)
    if r.status = 'IN_PROGRESS' then
      raise exception 'idempotency in progress for scope=% key=%', p_scope, p_key
        using errcode='23514';
    end if;

    -- If failed: allow retry with same hash (reset to IN_PROGRESS)
    if r.status = 'FAILED' then
      update public.idempotency
         set status = 'IN_PROGRESS',
             last_error = null,
             expires_at = exp_ts,
             updated_at = now_ts
       where scope = p_scope and key = p_key;

      return jsonb_build_object('hit', false);
    end if;

    -- Default: treat as in-progress
    raise exception 'idempotency invalid state' using errcode='23514';
  end if;

  -- Insert new row
  insert into public.idempotency(scope, key, request_hash, status, expires_at, created_at, updated_at)
  values (p_scope, p_key, p_request_hash, 'IN_PROGRESS', exp_ts, now_ts, now_ts);

  return jsonb_build_object('hit', false);
end;
$function$;

COMMIT;
