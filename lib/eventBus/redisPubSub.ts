import "server-only";

import { redisFetch } from "@/lib/infra/redis";

const CHANNEL = "lp:events";

export async function publishEvent(type: string, payload: unknown): Promise<{ ok: true } | { ok: false; code: string }> {
  const t = String(type ?? "").trim();
  if (!t) {
    return { ok: false, code: "EVENT_TYPE_MISSING" };
  }
  const body = JSON.stringify({ type: t, payload });
  const r = await redisFetch("PUBLISH", [CHANNEL, body]);
  if (r.ok === false) {
    console.error("[REDIS_PUBLISH_FAIL]", r);
    return { ok: false, code: r.code };
  }
  console.log("[DURABLE_EVENT]", { kind: "redis_publish", channel: CHANNEL, type: t });
  return { ok: true };
}
