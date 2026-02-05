// lib/ops/log.ts
import "server-only";

export type OpsLogPayload = Record<string, any>;

export function opsLog(scope: string, payload: OpsLogPayload) {
  const row = {
    ts: new Date().toISOString(),
    scope,
    ...payload,
  };
  console.log(JSON.stringify(row));
}
