import "server-only";
import type { Scope } from "./types";
import { opsLog } from "./log";

export async function audit(event: string, scope: Scope, meta?: Record<string, unknown>) {
  // Plug-in punkt: skriv til audit_events (Supabase) hvis ønskelig
  opsLog("audit", { event, rid: scope.rid, userId: scope.userId, role: scope.role, companyId: scope.companyId, ...meta });
}
