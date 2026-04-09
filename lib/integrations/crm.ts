import "server-only";

import { opsLog } from "@/lib/ops/log";

export type CrmLeadPayload = Record<string, unknown>;

export type CreateCrmLeadResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * CRM-webhook (valgfritt). Uten `CRM_WEBHOOK` returneres fail — ingen blokkering av hovedflyt.
 */
export async function createCRMLead(lead: CrmLeadPayload): Promise<CreateCrmLeadResult> {
  try {
    console.log("[CRM]", lead);

    const url = typeof process.env.CRM_WEBHOOK === "string" ? process.env.CRM_WEBHOOK.trim() : "";
    if (!url) {
      return { ok: false, reason: "no_crm" };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[CRM] webhook_http_error", res.status, text);
      opsLog("integration_crm", { ok: false, reason: "http_error", status: res.status });
      return { ok: false, reason: "http_error" };
    }

    opsLog("integration_crm", { ok: true });
    return { ok: true };
  } catch (e) {
    console.error("[CRM]", e);
    opsLog("integration_crm", { ok: false, reason: "exception" });
    return { ok: false, reason: "exception" };
  }
}
