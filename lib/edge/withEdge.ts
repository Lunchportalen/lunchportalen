import "server-only";

import { getEdge, setEdge } from "@/lib/edge/cache";

export async function withEdge<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const k = String(key ?? "").trim();
  if (!k) {
    return fn();
  }

  const cached = getEdge(k);
  if (cached !== undefined) {
    return cached as T;
  }

  const data = await fn();
  setEdge(k, data);
  return data;
}
