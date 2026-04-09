import "server-only";

import { opsLog } from "@/lib/ops/log";

/** Server-side sporbarhet for CEO-laget (kun logging — ingen sideeffekter). */
export function logCEO(event: Record<string, unknown>) {
  opsLog("ceo_layer", event);
}
