import "server-only";

import { subscribe } from "@/lib/eventBus/bus";

const g = globalThis as unknown as { __lp_event_handlers_registered?: boolean };

if (!g.__lp_event_handlers_registered) {
  g.__lp_event_handlers_registered = true;

  subscribe("order_created", (payload) => {
    console.log("[EVENT] order_created", payload);
  });

  subscribe("ai_run", (payload) => {
    console.log("[EVENT] ai_run", payload);
  });
}
