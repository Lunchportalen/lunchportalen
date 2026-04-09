import "server-only";

let shuttingDown = false;

export function markShutdown(): void {
  shuttingDown = true;
  console.log("[K8S_SHUTDOWN]", { ts: Date.now(), shuttingDown: true });
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}
