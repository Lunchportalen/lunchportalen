import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

import {
  requestTripletex,
  resolveTripletexAuth,
  type RequestOptions,
  TripletexClientError,
} from "./client";
import { TRIPLETEX_WEBHOOK_AUTH_HEADER } from "./verifyTripletexWebhookSignature";

type AnyJson = Record<string, unknown> | unknown[] | string | number | boolean | null;

/** Verified against Tripletex developer docs (2026-05-22). */
export const DEFAULT_TRIPLETEX_WEBHOOK_EVENTS = [
  "invoice.charged",
  "closegroup.create",
  "order.update",
] as const;

export type TripletexWebhookEventType = (typeof DEFAULT_TRIPLETEX_WEBHOOK_EVENTS)[number];

export type TripletexWebhookSubscriptionRow = {
  id?: number | string;
  event?: string;
  targetUrl?: string;
  authHeaderName?: string;
  authHeaderValue?: string;
  status?: string;
};

export type SyncedWebhookSubscription = {
  eventType: string;
  subscriptionId: string;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeUrl(url: string): string {
  return safeStr(url).replace(/\/+$/, "");
}

function extractSubscriptionRows(value: AnyJson): TripletexWebhookSubscriptionRow[] {
  const v = value as any;
  if (Array.isArray(v?.values)) return v.values as TripletexWebhookSubscriptionRow[];
  if (Array.isArray(v)) return v as TripletexWebhookSubscriptionRow[];
  return [];
}

function parseSubscriptionId(row: TripletexWebhookSubscriptionRow): string {
  const id = safeStr(row.id);
  return id;
}

function subscriptionMatchesDesired(
  row: TripletexWebhookSubscriptionRow,
  input: { eventType: string; targetUrl: string; secret: string },
): boolean {
  return (
    safeStr(row.event) === input.eventType &&
    normalizeUrl(safeStr(row.targetUrl)) === normalizeUrl(input.targetUrl) &&
    safeStr(row.authHeaderName) === TRIPLETEX_WEBHOOK_AUTH_HEADER &&
    safeStr(row.authHeaderValue) === input.secret
  );
}

/** Tripletex EventSubscriptionDTO — POST /event/subscription body shape. */
export function buildTripletexWebhookSubscriptionBody(input: {
  eventType: string;
  targetUrl: string;
  secret: string;
}): Record<string, unknown> {
  return {
    event: input.eventType,
    targetUrl: input.targetUrl,
    authHeaderName: TRIPLETEX_WEBHOOK_AUTH_HEADER,
    authHeaderValue: input.secret,
  };
}

export async function listWebhookSubscriptions(input: {
  providerId: string;
  env: "test" | "prod";
  request?: RequestOptions;
}): Promise<TripletexWebhookSubscriptionRow[]> {
  const auth = input.request?.auth ?? (await resolveTripletexAuth({ providerId: input.providerId, env: input.env }));
  const res = await requestTripletex(
    { method: "GET", path: "/event/subscription", query: { from: 0, count: 500 } },
    { ...input.request, auth },
  );
  return extractSubscriptionRows(res.value);
}

export async function createWebhookSubscription(input: {
  providerId: string;
  env: "test" | "prod";
  eventType: string;
  targetUrl: string;
  secret: string;
  request?: RequestOptions;
}): Promise<{ subscriptionId: string; raw: AnyJson }> {
  const auth = input.request?.auth ?? (await resolveTripletexAuth({ providerId: input.providerId, env: input.env }));
  const res = await requestTripletex(
    {
      method: "POST",
      path: "/event/subscription",
      body: buildTripletexWebhookSubscriptionBody({
        eventType: input.eventType,
        targetUrl: input.targetUrl,
        secret: input.secret,
      }),
    },
    { ...input.request, auth },
  );

  const subscriptionId = parseSubscriptionId((res.value ?? {}) as TripletexWebhookSubscriptionRow);
  if (!subscriptionId) {
    throw new TripletexClientError({
      message: "Tripletex webhook subscription create returned no id",
      kind: "PERMANENT",
      code: "TRIPLETEX_WEBHOOK_SUBSCRIPTION_ID_MISSING",
      detail: res.raw,
    });
  }

  return { subscriptionId, raw: res.raw };
}

export async function deleteWebhookSubscription(input: {
  providerId: string;
  env: "test" | "prod";
  subscriptionId: string;
  request?: RequestOptions;
}): Promise<void> {
  const id = safeStr(input.subscriptionId);
  if (!id) return;

  const auth = input.request?.auth ?? (await resolveTripletexAuth({ providerId: input.providerId, env: input.env }));
  await requestTripletex(
    { method: "DELETE", path: `/event/subscription/${encodeURIComponent(id)}` },
    { ...input.request, auth },
  );
}

async function persistWebhookSubscription(input: {
  providerId: string;
  env: "test" | "prod";
  eventType: string;
  subscriptionId: string;
  targetUrl: string;
  active: boolean;
}): Promise<void> {
  const admin = supabaseAdmin() as any;
  const now = new Date().toISOString();
  const { error } = await admin.from("provider_tripletex_webhook_subscriptions").upsert(
    {
      provider_id: input.providerId,
      env: input.env,
      event_type: input.eventType,
      tripletex_subscription_id: input.subscriptionId,
      target_url: input.targetUrl,
      active: input.active,
      updated_at: now,
    },
    { onConflict: "provider_id,env,event_type" },
  );

  if (error) {
    throw new TripletexClientError({
      message: `Webhook subscription persist failed: ${safeStr(error.message ?? error)}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_WEBHOOK_SUBSCRIPTION_PERSIST_FAILED",
      detail: error,
    });
  }
}

export async function syncWebhookSubscriptions(input: {
  providerId: string;
  env: "test" | "prod";
  secret: string;
  targetUrl: string;
  desiredEvents?: readonly string[];
}): Promise<{ subscriptions: SyncedWebhookSubscription[] }> {
  const desired = (input.desiredEvents ?? DEFAULT_TRIPLETEX_WEBHOOK_EVENTS).map(safeStr).filter(Boolean);
  const targetUrl = safeStr(input.targetUrl);
  const secret = safeStr(input.secret);

  if (!targetUrl || !secret) {
    throw new TripletexClientError({
      message: "Webhook targetUrl and secret are required",
      kind: "PERMANENT",
      code: "TRIPLETEX_WEBHOOK_SYNC_INPUT_INVALID",
    });
  }

  const auth = await resolveTripletexAuth({ providerId: input.providerId, env: input.env });
  const requestOpts: RequestOptions = { auth };
  const remoteRows = await listWebhookSubscriptions({
    providerId: input.providerId,
    env: input.env,
    request: requestOpts,
  });

  const synced: SyncedWebhookSubscription[] = [];

  for (const eventType of desired) {
    const desiredInput = { eventType, targetUrl, secret };
    const existing = remoteRows.find((row) => safeStr(row.event) === eventType);

    if (existing && subscriptionMatchesDesired(existing, desiredInput)) {
      const subscriptionId = parseSubscriptionId(existing);
      await persistWebhookSubscription({
        providerId: input.providerId,
        env: input.env,
        eventType,
        subscriptionId,
        targetUrl,
        active: true,
      });
      synced.push({ eventType, subscriptionId });
      continue;
    }

    if (existing) {
      const oldId = parseSubscriptionId(existing);
      if (oldId) {
        await deleteWebhookSubscription({
          providerId: input.providerId,
          env: input.env,
          subscriptionId: oldId,
          request: requestOpts,
        });
      }
    }

    const created = await createWebhookSubscription({
      providerId: input.providerId,
      env: input.env,
      eventType,
      targetUrl,
      secret,
      request: requestOpts,
    });

    await persistWebhookSubscription({
      providerId: input.providerId,
      env: input.env,
      eventType,
      subscriptionId: created.subscriptionId,
      targetUrl,
      active: true,
    });

    synced.push({ eventType, subscriptionId: created.subscriptionId });
  }

  return { subscriptions: synced };
}

export async function deleteProviderTripletexWebhookSubscriptions(input: {
  providerId: string;
  env: "test" | "prod";
}): Promise<{ deleted: number; warnings: number }> {
  const admin = supabaseAdmin() as any;
  const { data: rows, error } = await admin
    .from("provider_tripletex_webhook_subscriptions")
    .select("tripletex_subscription_id, event_type")
    .eq("provider_id", input.providerId)
    .eq("env", input.env)
    .eq("active", true);

  if (error) {
    opsLog("tripletex_webhook_subscription_db_load_failed", {
      provider_id: input.providerId,
      env: input.env,
      message: safeStr(error.message),
    });
    return { deleted: 0, warnings: 1 };
  }

  let deleted = 0;
  let warnings = 0;
  const auth = await resolveTripletexAuth({ providerId: input.providerId, env: input.env }).catch(() => null);

  for (const row of Array.isArray(rows) ? rows : []) {
    const subscriptionId = safeStr((row as { tripletex_subscription_id?: string }).tripletex_subscription_id);
    if (!subscriptionId) continue;

    if (auth) {
      try {
        await deleteWebhookSubscription({
          providerId: input.providerId,
          env: input.env,
          subscriptionId,
          request: { auth },
        });
        deleted += 1;
      } catch (error: unknown) {
        warnings += 1;
        opsLog("tripletex_webhook_subscription_delete_failed", {
          provider_id: input.providerId,
          env: input.env,
          subscription_id: subscriptionId,
          event_type: safeStr((row as { event_type?: string }).event_type),
          message: safeStr((error as Error)?.message ?? error),
        });
      }
    } else {
      warnings += 1;
    }
  }

  const now = new Date().toISOString();
  await admin
    .from("provider_tripletex_webhook_subscriptions")
    .update({ active: false, updated_at: now })
    .eq("provider_id", input.providerId)
    .eq("env", input.env);

  return { deleted, warnings };
}
