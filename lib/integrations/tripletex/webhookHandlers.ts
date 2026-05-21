import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type TripletexWebhookPayload = {
  subscriptionId?: number | string;
  event?: string;
  id?: number | string;
  value?: Record<string, unknown> | null;
};

export type WebhookHandlerResult = {
  success: boolean;
  error?: string;
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function tripletexObjectId(payload: TripletexWebhookPayload): string {
  return safeStr(payload.id);
}

async function writeWebhookAudit(
  admin: SupabaseClient,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await admin.from("lifecycle_audit_log").insert({
    actor_id: null,
    action,
    entity_type: "tripletex_webhook",
    entity_id: safeStr(metadata.event_id) || null,
    reason: null,
    metadata,
  });
}

async function findProviderInvoiceByTripletexId(
  admin: SupabaseClient,
  tripletexInvoiceId: string,
): Promise<{ id: string; status: string; provider_id: string } | null> {
  const { data, error } = await admin
    .from("provider_invoices")
    .select("id, status, provider_id")
    .eq("tripletex_invoice_id", tripletexInvoiceId)
    .maybeSingle();

  if (error) throw new Error(safeStr(error.message) || "PROVIDER_INVOICE_LOOKUP_FAILED");
  if (!data) return null;
  return {
    id: safeStr((data as { id?: unknown }).id),
    status: safeStr((data as { status?: unknown }).status),
    provider_id: safeStr((data as { provider_id?: unknown }).provider_id),
  };
}

export async function handleInvoicePaid(
  payload: TripletexWebhookPayload,
  admin: SupabaseClient,
  ctx: { eventId: string },
): Promise<WebhookHandlerResult> {
  const tripletexInvoiceId = tripletexObjectId(payload);
  if (!tripletexInvoiceId) {
    return { success: false, error: "MISSING_TRIPLETEX_INVOICE_ID" };
  }

  const invoice = await findProviderInvoiceByTripletexId(admin, tripletexInvoiceId);
  if (!invoice) {
    return { success: false, error: "UNKNOWN_INVOICE" };
  }

  if (invoice.status === "PAID") {
    return { success: true };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("provider_invoices")
    .update({ status: "PAID", paid_at: now })
    .eq("id", invoice.id)
    .in("status", ["SENT", "OVERDUE"]);

  if (updateError) {
    return { success: false, error: safeStr(updateError.message) || "PROVIDER_INVOICE_UPDATE_FAILED" };
  }

  await writeWebhookAudit(admin, "tripletex_webhook_invoice_paid", {
    event_id: ctx.eventId,
    provider_id: invoice.provider_id,
    invoice_id: invoice.id,
    tripletex_invoice_id: tripletexInvoiceId,
  });

  return { success: true };
}

export async function handleInvoiceVoided(
  payload: TripletexWebhookPayload,
  admin: SupabaseClient,
  ctx: { eventId: string },
): Promise<WebhookHandlerResult> {
  const tripletexInvoiceId = tripletexObjectId(payload);
  if (!tripletexInvoiceId) {
    return { success: false, error: "MISSING_TRIPLETEX_INVOICE_ID" };
  }

  const invoice = await findProviderInvoiceByTripletexId(admin, tripletexInvoiceId);
  if (!invoice) {
    return { success: false, error: "UNKNOWN_INVOICE" };
  }

  if (invoice.status === "VOID") {
    return { success: true };
  }

  const { error: updateError } = await admin
    .from("provider_invoices")
    .update({ status: "VOID" })
    .eq("id", invoice.id)
    .neq("status", "VOID");

  if (updateError) {
    return { success: false, error: safeStr(updateError.message) || "PROVIDER_INVOICE_UPDATE_FAILED" };
  }

  await writeWebhookAudit(admin, "tripletex_webhook_invoice_voided", {
    event_id: ctx.eventId,
    provider_id: invoice.provider_id,
    invoice_id: invoice.id,
    tripletex_invoice_id: tripletexInvoiceId,
  });

  return { success: true };
}

/** Tripletex native: invoice.charged — reinforce SENT when Tripletex invoice id is known. */
export async function handleInvoiceCharged(
  payload: TripletexWebhookPayload,
  admin: SupabaseClient,
  ctx: { eventId: string },
): Promise<WebhookHandlerResult> {
  const tripletexInvoiceId = tripletexObjectId(payload);
  if (!tripletexInvoiceId) {
    return { success: false, error: "MISSING_TRIPLETEX_INVOICE_ID" };
  }

  const invoice = await findProviderInvoiceByTripletexId(admin, tripletexInvoiceId);
  if (!invoice) {
    return { success: false, error: "UNKNOWN_INVOICE" };
  }

  if (invoice.status === "SENT" || invoice.status === "PAID") {
    return { success: true };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("provider_invoices")
    .update({
      status: "SENT",
      tripletex_invoice_id: tripletexInvoiceId,
      sent_at: now,
    })
    .eq("id", invoice.id)
    .eq("status", "DRAFT");

  if (updateError) {
    return { success: false, error: safeStr(updateError.message) || "PROVIDER_INVOICE_UPDATE_FAILED" };
  }

  await writeWebhookAudit(admin, "tripletex_webhook_invoice_charged", {
    event_id: ctx.eventId,
    provider_id: invoice.provider_id,
    invoice_id: invoice.id,
    tripletex_invoice_id: tripletexInvoiceId,
  });

  return { success: true };
}

function extractInvoiceIdsFromCloseGroup(value: Record<string, unknown> | null | undefined): string[] {
  if (!value || typeof value !== "object") return [];
  const postings = (value as { postings?: unknown }).postings;
  if (!Array.isArray(postings)) return [];
  const ids = new Set<string>();
  for (const row of postings) {
    if (!row || typeof row !== "object") continue;
    const invoice = (row as { invoice?: unknown; invoiceId?: unknown }).invoice;
    const direct = (row as { invoiceId?: unknown }).invoiceId;
    if (invoice && typeof invoice === "object") {
      const id = safeStr((invoice as { id?: unknown }).id);
      if (id) ids.add(id);
    }
    const flat = safeStr(direct);
    if (flat) ids.add(flat);
  }
  return [...ids];
}

/** Tripletex native: closegroup.create — OCR/payment matching may close invoice postings. */
export async function handleCloseGroupCreate(
  payload: TripletexWebhookPayload,
  admin: SupabaseClient,
  ctx: { eventId: string },
): Promise<WebhookHandlerResult> {
  const invoiceIds = extractInvoiceIdsFromCloseGroup(payload.value ?? null);
  if (invoiceIds.length === 0) {
    const fallbackId = tripletexObjectId(payload);
    if (fallbackId) invoiceIds.push(fallbackId);
  }
  if (invoiceIds.length === 0) {
    return { success: false, error: "NO_INVOICE_IDS_IN_CLOSEGROUP" };
  }

  let anyPaid = false;
  let lastError: string | undefined;
  for (const tripletexInvoiceId of invoiceIds) {
    const result = await handleInvoicePaid({ ...payload, id: tripletexInvoiceId }, admin, ctx);
    if (result.success) anyPaid = true;
    else lastError = result.error;
  }

  if (anyPaid) return { success: true };
  return { success: false, error: lastError ?? "UNKNOWN_INVOICE" };
}

export async function handleCustomerUpdated(
  payload: TripletexWebhookPayload,
  admin: SupabaseClient,
  ctx: { eventId: string },
): Promise<WebhookHandlerResult> {
  const tripletexCustomerId = tripletexObjectId(payload);
  if (!tripletexCustomerId) {
    return { success: false, error: "MISSING_TRIPLETEX_CUSTOMER_ID" };
  }

  const { data: rows, error } = await admin
    .from("tripletex_customers")
    .select("id, provider_id")
    .eq("tripletex_customer_id", tripletexCustomerId)
    .limit(5);

  if (error) {
    return { success: false, error: safeStr(error.message) || "TRIPLETEX_CUSTOMER_LOOKUP_FAILED" };
  }

  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    return { success: false, error: "UNKNOWN_CUSTOMER" };
  }

  await writeWebhookAudit(admin, "tripletex_webhook_customer_updated", {
    event_id: ctx.eventId,
    tripletex_customer_id: tripletexCustomerId,
    mapping_count: list.length,
  });

  return { success: true };
}

const SUPPORTED_EVENTS: Record<
  string,
  (
    payload: TripletexWebhookPayload,
    admin: SupabaseClient,
    ctx: { eventId: string },
  ) => Promise<WebhookHandlerResult>
> = {
  "invoice.paid": handleInvoicePaid,
  "invoice.voided": handleInvoiceVoided,
  "invoice.charged": handleInvoiceCharged,
  "closegroup.create": handleCloseGroupCreate,
  "customer.updated": handleCustomerUpdated,
  "customer.update": handleCustomerUpdated,
};

export function isSupportedTripletexWebhookEvent(eventType: string): boolean {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_EVENTS, eventType);
}

export async function dispatchTripletexWebhookEvent(
  eventType: string,
  payload: TripletexWebhookPayload,
  admin: SupabaseClient,
  ctx: { eventId: string },
): Promise<WebhookHandlerResult> {
  const handler = SUPPORTED_EVENTS[eventType];
  if (!handler) {
    return { success: true };
  }
  return handler(payload, admin, ctx);
}
