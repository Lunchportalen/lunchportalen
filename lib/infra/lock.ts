import "server-only";

let LOCK = false;

export async function acquireLock(): Promise<boolean> {
  if (LOCK) return false;
  LOCK = true;
  return true;
}

export function releaseLock(): void {
  LOCK = false;
}
