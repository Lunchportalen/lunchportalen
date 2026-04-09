/** In-process throttle (5 min per anomaly key). Resets on cold start — acceptable for burst control. */
const memory = new Map<string, number>();

const WINDOW_MS = 300_000;

export function shouldSendAlert(key: string): boolean {
  const now = Date.now();
  const last = memory.get(key) ?? 0;
  if (now - last < WINDOW_MS) {
    return false;
  }
  memory.set(key, now);
  return true;
}
