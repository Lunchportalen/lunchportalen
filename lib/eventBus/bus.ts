import "server-only";

export type BusEvent = {
  type: string;
  payload?: unknown;
};

type Subscriber = (payload: unknown) => void;

const subscribers: Record<string, Subscriber[]> = {};

export function publish(event: BusEvent): void {
  const t = String(event?.type ?? "").trim();
  if (!t) {
    console.error("[EVENT_BUS]", { err: "missing_type" });
    return;
  }

  console.log("[EVENT_BUS]", { type: t, hasPayload: event.payload !== undefined });

  const subs = subscribers[t] ?? [];
  for (const fn of subs) {
    try {
      fn(event.payload);
    } catch (e) {
      console.error("[EVENT_FAIL]", { type: t, err: e });
    }
  }
}

export function subscribe(type: string, fn: Subscriber): void {
  const t = String(type ?? "").trim();
  if (!t) return;
  if (!subscribers[t]) subscribers[t] = [];
  subscribers[t].push(fn);
}
