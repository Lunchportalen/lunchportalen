type AgentEvent = {
  type: string;
  marketId?: string;
  agent?: string;
  payload?: unknown;
};

type Handler = (event: AgentEvent) => void;

const listeners = new Map<string, Set<Handler>>();

/**
 * Enkel prosess-lokal buss (deterministisk rekkefølge; ingen nettverk).
 */
export const AgentBus = {
  publish(event: AgentEvent): void {
    // eslint-disable-next-line no-console
    console.log("[AGENT_EVENT]", event);
    const set = listeners.get(event.type);
    if (!set) return;
    for (const h of set) {
      try {
        h(event);
      } catch {
        /* ikke stopp andre abonnenter */
      }
    }
  },

  subscribe(type: string, handler: Handler): () => void {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(handler);
    return () => {
      listeners.get(type)?.delete(handler);
    };
  },
};
