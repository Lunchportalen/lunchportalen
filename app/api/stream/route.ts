export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";

const TICK_MS = 2000;

/**
 * SSE med operasjonelle ticks (kun superadmin). Stenger interval ved cancel.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.stream.GET", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  traceRequest(rid, "/api/stream");
  structuredLog({ type: "sse_open", source: "api", rid, payload: { route: "/api/stream" } });

  if (req.nextUrl.searchParams.get("probe") === "1") {
    return jsonOk(
      rid,
      { mode: "sse" as const, tickMs: TICK_MS, hint: "Fjern probe=1 for faktisk EventSource-strøm." },
      200,
    );
  }

  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;

  try {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = () => {
          try {
            const payload = JSON.stringify({
              ts: Date.now(),
              rid,
              tick: "ops",
            });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            console.log("[SSE_TICK]", { rid, ts: Date.now() });
          } catch (e) {
            console.error("[SSE_TICK_ERR]", { rid, err: e });
          }
        };
        send();
        interval = setInterval(send, TICK_MS);
      },
      cancel() {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
        structuredLog({ type: "sse_close", source: "api", rid, payload: { route: "/api/stream" } });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Connection: "keep-alive",
        "x-rid": rid,
      },
    });
  } catch (e) {
    return jsonErr(rid, "Kunne ikke åpne SSE-strøm.", 500, "SSE_FAILED", e);
  }
}
