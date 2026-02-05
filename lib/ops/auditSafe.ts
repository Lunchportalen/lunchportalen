// lib/ops/auditSafe.ts
import "server-only";

export async function auditSafe(fn: () => Promise<unknown>, rid: string) {
  try {
    await fn();
  } catch (e: any) {
    const message = e?.message ?? String(e ?? "unknown");
    console.warn("audit failed", { rid, error: message });
  }
}
