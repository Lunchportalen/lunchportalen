import "server-only";

export function authLog(rid: string, event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production" && process.env.LP_DEBUG_AUTH !== "1") {
    return;
  }
  // eslint-disable-next-line no-console
  console.log("[auth]", { rid, event, ...payload });
}
