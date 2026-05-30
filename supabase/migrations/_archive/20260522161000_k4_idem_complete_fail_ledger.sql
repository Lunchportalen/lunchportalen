-- K4 Bølge 1: Ledger drift — lp_idem_complete / lp_idem_fail finnes på prod, manglet i repo-migrasjoner.

CREATE OR REPLACE FUNCTION public.lp_idem_complete(
  p_scope text,
  p_key text,
  p_request_hash text,
  p_response_json jsonb,
  p_response_code integer DEFAULT 200
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare now_ts timestamptz := now();
begin
  update public.idempotency
     set status = 'COMPLETED',
         response_code = p_response_code,
         response_json = p_response_json,
         last_error = null,
         updated_at = now_ts
   where scope = p_scope
     and key = p_key
     and request_hash = p_request_hash;
end;
$function$;

CREATE OR REPLACE FUNCTION public.lp_idem_fail(
  p_scope text,
  p_key text,
  p_request_hash text,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare now_ts timestamptz := now();
begin
  update public.idempotency
     set status = 'FAILED',
         last_error = left(coalesce(p_error,''), 4000),
         updated_at = now_ts
   where scope = p_scope
     and key = p_key
     and request_hash = p_request_hash;
end;
$function$;
