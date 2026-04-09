import "server-only";

/**
 * In-memory queue (én Node-prosess). Ikke varig ved serverless scale-out — bruk for kontrollert staging/operatørflyt.
 */

export type ExecutionAction = {
  id: string;
  type: string;
  payload?: unknown;
  status: "pending" | "approved" | "executed";
};

const queue: ExecutionAction[] = [];
const MAX_QUEUE = 500;

export function addAction(action: ExecutionAction): { ok: true } | { ok: false; reason: string } {
  const id = String(action.id ?? "").trim();
  const type = String(action.type ?? "").trim();
  if (!id || !type) return { ok: false, reason: "INVALID_ACTION" };
  if (queue.length >= MAX_QUEUE) return { ok: false, reason: "QUEUE_FULL" };
  if (queue.some((a) => a.id === id)) return { ok: false, reason: "DUPLICATE_ID" };

  const st = action.status;
  const status: ExecutionAction["status"] =
    st === "approved" || st === "executed" || st === "pending" ? st : "pending";

  queue.push({
    id,
    type,
    payload: action.payload,
    status,
  });
  return { ok: true };
}

export function getQueue(): ExecutionAction[] {
  return queue.map((a) => ({
    id: a.id,
    type: a.type,
    payload: a.payload,
    status: a.status,
  }));
}

export function updateAction(id: string, update: Partial<ExecutionAction>): boolean {
  const item = queue.find((a) => a.id === id);
  if (!item) return false;
  if (typeof update.status === "string") {
    const s = update.status;
    if (s !== "pending" && s !== "approved" && s !== "executed") return false;
    item.status = s;
  }
  if ("type" in update && typeof update.type === "string") item.type = update.type;
  if ("payload" in update) item.payload = update.payload;
  return true;
}

export function getActionById(id: string): ExecutionAction | undefined {
  const item = queue.find((a) => a.id === id);
  if (!item) return undefined;
  return { ...item, payload: item.payload };
}
