export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { guardConcurrency } from "@/lib/infra/concurrency";
import { isShuttingDown } from "@/lib/infra/shutdown";
import { supabaseServer } from "@/lib/supabase/server";

function isPodOverload(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "POD_OVERLOAD";
}

/**
 * Kubernetes readiness — kan ta trafikk (lett DB-sjekk via eksisterende tabell).
 */
export async function GET(): Promise<Response> {
  const rid = makeRid("k8s_ready");
  try {
    return await guardConcurrency(async () => {
      if (isShuttingDown()) {
        return jsonErr(rid, "Pod stenger.", 503, "NOT_READY", "SHUTTING_DOWN");
      }

      try {
        const sb = await supabaseServer();
        const { error } = await sb.from("system_settings").select("id").limit(1);

        if (error) {
          console.log("[K8S_READY]", { ok: false, rid, error: error.message });
          return jsonErr(rid, "Database ikke klar.", 503, "NOT_READY", error.message);
        }

        console.log("[K8S_READY]", { ok: true, rid });
        return jsonOk(rid, { status: "READY" as const, ts: Date.now() }, 200);
      } catch (e) {
        console.log("[K8S_READY]", { ok: false, rid, err: e });
        return jsonErr(rid, "Database ikke klar.", 503, "NOT_READY", e);
      }
    });
  } catch (e) {
    if (isPodOverload(e)) {
      return jsonErr(rid, "Pod overbelastet.", 503, "POD_OVERLOAD", e);
    }
    return jsonErr(rid, "Readiness feilet.", 500, "READY_PROBE_FAILED", e);
  }
}
