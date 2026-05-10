import "server-only";

import { opsLog } from "@/lib/ops/log";

export function authLog(rid: string, event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production" && process.env.LP_DEBUG_AUTH !== "1") {
    return;
  }
  opsLog("auth.debug", { rid, event, ...payload });
}
