/**
 * CRM-adapter: internt API-kall før evt. ekstern webhook (ingen skjulte kall).
 * Krever eksplisitt bruker-godkjenning — se {@link sendLeadToCRM}.
 */

import type { Lead } from "@/lib/leads/types";

export type CrmSendResult = {
  ok: boolean;
  message: string;
  rid?: string;
};

function crmEndpointPath(): string {
  return "/api/crm/lead";
}

/**
 * Sender lead til intern CRM-endepunkt (som kan videresende til HubSpot e.l.).
 * @param explicitUserApproved — MÅ være true; ellers returneres umiddelbart uten nettverk (fail-closed).
 */
export async function sendLeadToCRM(
  lead: Lead,
  options?: { explicitUserApproved?: boolean },
): Promise<CrmSendResult> {
  if (options?.explicitUserApproved !== true) {
    return {
      ok: false,
      message: "Stoppet: CRM-sending krever eksplisitt bruker-godkjenning (ingen auto-synk).",
    };
  }

  const path = crmEndpointPath();
  const url =
    typeof window !== "undefined"
      ? path
      : `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${path}`.replace(/([^:]\/)\/+/g, "$1");

  if (!url || (typeof window === "undefined" && !process.env.NEXT_PUBLIC_SITE_URL)) {
    return {
      ok: false,
      message:
        "Stoppet: server-side kall mangler NEXT_PUBLIC_SITE_URL — bruk adapter fra nettleser eller sett base-URL.",
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        lead,
        explicitUserApproved: true,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | {
          ok?: boolean;
          rid?: string;
          data?: { message?: string; received?: boolean };
          message?: string;
          error?: string;
        }
      | null;

    if (!res.ok || !data || data.ok !== true) {
      return {
        ok: false,
        message: String(data?.message ?? data?.error ?? `HTTP ${res.status}`),
        rid: typeof data?.rid === "string" ? data.rid : undefined,
      };
    }

    const innerMsg =
      data.data && typeof data.data === "object" && typeof data.data.message === "string"
        ? data.data.message
        : "Lead mottatt av CRM-lag.";

    return {
      ok: true,
      message: innerMsg,
      rid: typeof data.rid === "string" ? data.rid : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Nettverksfeil ved CRM-kall.",
    };
  }
}
