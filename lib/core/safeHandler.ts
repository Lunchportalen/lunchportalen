import "server-only";

import { logErrorResponse } from "@/lib/core/errorResponse";
import { jsonErr } from "@/lib/http/respond";
import { sendAlert } from "@/lib/sre/alerts";

/**
 * Try/catch rundt route-handlers som skal returnere Response — aldri ukontrollert throw ut.
 */
export async function safeHandler(rid: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err: unknown) {
    logErrorResponse(rid, err);
    const msg =
      err instanceof Error
        ? err.message
        : err && typeof err === "object" && err !== null && "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Uventet feil.";
    void sendAlert({
      type: "api_error",
      severity: "high",
      message: msg.slice(0, 2000),
    });
    return jsonErr(rid, msg, 500, err instanceof Error ? err.message : String(err), err);
  }
}
