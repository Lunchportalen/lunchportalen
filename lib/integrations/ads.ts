import "server-only";

import { opsLog } from "@/lib/ops/log";

export type AdTriggerPayload = Record<string, unknown>;

export type TriggerAdCampaignResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Ekstern annonse-/webhook-trigger (valgfritt). Brukes kun som hint — ingen garanti for kjøp.
 */
export async function triggerAdCampaign(data: AdTriggerPayload): Promise<TriggerAdCampaignResult> {
  try {
    console.log("[ADS TRIGGER]", data);

    const url = typeof process.env.ADS_WEBHOOK === "string" ? process.env.ADS_WEBHOOK.trim() : "";
    if (!url) {
      return { ok: false, reason: "no_ads_webhook" };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[ADS TRIGGER] http_error", res.status, text);
      opsLog("integration_ads", { ok: false, reason: "http_error", status: res.status });
      return { ok: false, reason: "http_error" };
    }

    opsLog("integration_ads", { ok: true });
    return { ok: true };
  } catch (e) {
    console.error("[ADS TRIGGER]", e);
    opsLog("integration_ads", { ok: false, reason: "exception" });
    return { ok: false, reason: "exception" };
  }
}
