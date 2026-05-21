/**
 * Shared helpers for TPT-B-7 RPC integration tests.
 */
import { fixturePgQuery } from "@/tests/_helpers/fixturePg";

export const MOCK_VERIFICATION_OK = {
  auth: { ok: true, error: null, company_id: 114612665, company_name: "Test AS" },
  company_match: { ok: true, error: null, company_id: 114612665, company_name: "Test AS" },
  scope: { ok: true, error: null },
  all_passed: true,
};

export const MOCK_VERIFICATION_AUTH_FAIL = {
  auth: { ok: false, error: "Token avvist", company_id: null, company_name: null },
  company_match: { ok: false, error: null },
  scope: { ok: false, error: null },
  all_passed: false,
};

export const MOCK_VERIFICATION_MISMATCH = {
  auth: { ok: true, error: null, company_id: 999999999, company_name: "Other AS" },
  company_match: { ok: false, error: "Mismatch", company_id: 999999999 },
  scope: { ok: false, error: null },
  all_passed: false,
};

export const MOCK_VERIFICATION_SCOPE_FAIL = {
  auth: { ok: true, error: null, company_id: 114612665, company_name: "Test AS" },
  company_match: { ok: true, error: null, company_id: 114612665 },
  scope: { ok: false, error: "Mangler product-access" },
  all_passed: false,
};

export async function cleanupTripletexOnboarding(providerId: string): Promise<void> {
  await fixturePgQuery(`DELETE FROM public.outbox WHERE event_key LIKE $1`, [
    `tripletex.onboarding_provisioning_start:${providerId}:%`,
  ]);
  await fixturePgQuery(
    `DELETE FROM public.lifecycle_audit_log
     WHERE entity_type IN ('tripletex_connection', 'tripletex_credentials')
       AND entity_id = $1`,
    [providerId],
  );
  await fixturePgQuery(
    `DELETE FROM public.provider_tripletex_webhook_secrets WHERE provider_id = $1`,
    [providerId],
  );
  await fixturePgQuery(`DELETE FROM public.provider_tripletex_credentials WHERE provider_id = $1`, [
    providerId,
  ]);
}

export async function seedCredentialsRow(input: {
  providerId: string;
  env?: string;
  state?: string;
  companyId?: number;
  provisioningComplete?: boolean;
  disconnected?: boolean;
  vaultPurgeAt?: string | null;
}): Promise<void> {
  const env = input.env ?? "test";
  const state = input.state ?? "NOT_CONNECTED";
  const companyId = input.companyId ?? 114612665;

  await fixturePgQuery(
    `INSERT INTO public.provider_tripletex_credentials (
       provider_id, env, consumer_token_secret_id, employee_token_secret_id,
       company_id_external, sync_status, connection_state, state_changed_at,
       onboarding_provisioning_complete_at, disconnected_at, vault_purge_at
     )
     SELECT
       $1::uuid, $2, gen_random_uuid(), gen_random_uuid(),
       $3, 'READY', $4, now(),
       CASE WHEN $5 THEN now() ELSE NULL END,
       CASE WHEN $6 THEN now() ELSE NULL END,
       $7::timestamptz
     ON CONFLICT (provider_id) DO UPDATE SET
       env = excluded.env,
       connection_state = excluded.connection_state,
       company_id_external = excluded.company_id_external,
       onboarding_provisioning_complete_at = excluded.onboarding_provisioning_complete_at,
       disconnected_at = excluded.disconnected_at,
       vault_purge_at = excluded.vault_purge_at,
       updated_at = now()`,
    [
      input.providerId,
      env,
      companyId,
      state,
      Boolean(input.provisioningComplete),
      Boolean(input.disconnected),
      input.vaultPurgeAt ?? null,
    ],
  );
}

export async function seedWebhookSecret(providerId: string, env = "test"): Promise<void> {
  await fixturePgQuery(
    `INSERT INTO public.provider_tripletex_webhook_secrets (provider_id, env, webhook_secret_id)
     VALUES ($1::uuid, $2, gen_random_uuid())
     ON CONFLICT (provider_id, env) DO NOTHING`,
    [providerId, env],
  );
}
