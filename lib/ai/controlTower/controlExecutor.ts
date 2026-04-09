import "server-only";

import { CONTROL_ACTIONS, type ControlActionValue, isRegisteredControlAction } from "./actionRegistry";
import { opsLog } from "@/lib/ops/log";

export type ControlExecutorResult = {
  ok: boolean;
  action: string;
  detail?: string;
  httpStatus?: number;
  path?: string;
};

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

function resolveCronBaseUrl(): string {
  const site = safeTrim(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");
  const baseUrl = safeTrim(process.env.NEXT_PUBLIC_BASE_URL).replace(/\/$/, "");
  const vercel = safeTrim(process.env.VERCEL_URL).replace(/^https?:\/\//, "");
  if (site) return site;
  if (baseUrl) return baseUrl;
  if (vercel) return `https://${vercel}`;
  return "";
}

const CRON_PATHS: Partial<Record<ControlActionValue, string>> = {
  [CONTROL_ACTIONS.RUN_GROWTH]: "/api/cron/singularity",
  [CONTROL_ACTIONS.RUN_STRATEGY]: "/api/cron/strategy",
  [CONTROL_ACTIONS.RUN_ORG]: "/api/cron/org",
  [CONTROL_ACTIONS.RUN_MARKET]: "/api/cron/market",
  [CONTROL_ACTIONS.RUN_MONOPOLY]: "/api/cron/monopoly",
  [CONTROL_ACTIONS.RUN_REALITY]: "/api/cron/reality",
  [CONTROL_ACTIONS.RUN_PROFIT]: "/api/cron/profit",
  [CONTROL_ACTIONS.RUN_CAPITAL]: "/api/cron/capital-allocation",
  [CONTROL_ACTIONS.RUN_BUDGET]: "/api/cron/budget-execution",
  [CONTROL_ACTIONS.RUN_RESOURCES]: "/api/cron/budget-execution",
  [CONTROL_ACTIONS.RUN_CREDIT_CHECK]: "/api/cron/credit-check",
  [CONTROL_ACTIONS.RUN_INVOICING]: "/api/cron/invoice-companies",
};

/**
 * Invokes at most one control action per call. Crons use SYSTEM_MOTOR_SECRET (Bearer).
 * Kill-switch toggles only affect this Node process; set platform env for fleet-wide persistence.
 */
export async function executeControlAction(action: string): Promise<ControlExecutorResult> {
  const key = safeTrim(action);
  if (!isRegisteredControlAction(key)) {
    opsLog("control_tower_action", { action: key, ok: false, reason: "unknown_action" });
    opsLog("control_tower_run", { action: key, ok: false, phase: "reject" });
    return { ok: false, action: key, detail: "unknown_action" };
  }

  if (key === CONTROL_ACTIONS.KILL_SWITCH_ON) {
    process.env.AI_GLOBAL_KILL_SWITCH = "true";
    opsLog("control_tower_action", { action: key, ok: true, effect: "kill_switch_true_process_scope" });
    opsLog("control_tower_run", { action: key, ok: true, phase: "kill_switch" });
    return { ok: true, action: key, detail: "kill_switch_on_process_scope" };
  }
  if (key === CONTROL_ACTIONS.KILL_SWITCH_OFF) {
    process.env.AI_GLOBAL_KILL_SWITCH = "false";
    opsLog("control_tower_action", { action: key, ok: true, effect: "kill_switch_false_process_scope" });
    opsLog("control_tower_run", { action: key, ok: true, phase: "kill_switch" });
    return { ok: true, action: key, detail: "kill_switch_off_process_scope" };
  }

  const path = CRON_PATHS[key];
  if (!path) {
    opsLog("control_tower_action", { action: key, ok: false, reason: "no_cron_path" });
    opsLog("control_tower_run", { action: key, ok: false, phase: "no_path" });
    return { ok: false, action: key, detail: "no_cron_path" };
  }

  const base = resolveCronBaseUrl();
  const secret = safeTrim(process.env.SYSTEM_MOTOR_SECRET);
  if (!base || !secret) {
    opsLog("control_tower_action", { action: key, ok: false, reason: "missing_base_or_secret" });
    opsLog("control_tower_run", { action: key, ok: false, phase: "misconfigured", path });
    return { ok: false, action: key, detail: "missing_base_or_secret", path };
  }

  const url = `${base}${path}`;
  let httpStatus = 0;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    httpStatus = res.status;
    const ok = res.ok;
    opsLog("control_tower_action", { action: key, ok, httpStatus, path });
    opsLog("control_tower_run", { action: key, ok, httpStatus, path, phase: "cron_fetch" });
    return {
      ok,
      action: key,
      httpStatus,
      path,
      detail: ok ? undefined : `http_${httpStatus}`,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("control_tower_action", { action: key, ok: false, path, error: message });
    opsLog("control_tower_run", { action: key, ok: false, path, phase: "fetch_error", error: message });
    return { ok: false, action: key, path, detail: message };
  }
}
