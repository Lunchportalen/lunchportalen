import "server-only";

import { withAiDecisionEntrypoint } from "@/lib/ai/decisionEngine";
import { observeResponse } from "@/lib/observability/eventLogger";
import { recordAiApiEntrypointWrap } from "@/lib/system/controlPlaneMetrics";

/**
 * Wrap an App Router handler body so AI work is attributed to the HTTP route (control plane).
 */
export async function withApiAiEntrypoint<T>(req: Request, method: string, fn: () => Promise<T>): Promise<T> {
  let surface = "/api";
  try {
    surface = new URL(req.url).pathname;
  } catch {
    /* ignore */
  }
  return observeResponse(
    {
      type: "api.ai.entrypoint",
      source: surface,
      metadata: { method },
    },
    () =>
      withAiDecisionEntrypoint({ surface, operation: method }, async () => {
        recordAiApiEntrypointWrap(surface, method);
        return fn();
      }),
  );
}
