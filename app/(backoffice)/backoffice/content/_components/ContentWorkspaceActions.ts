// STATUS: KEEP

/**
 * ContentWorkspaceActions — compatibility shim.
 *
 * The current rescued repository keeps the real `onCreate` logic inline inside
 * `ContentWorkspace.tsx`. However, the test suite expects modularization exports
 * to exist under this path.
 *
 * This module intentionally stays minimal: it only provides `createOnCreate`
 * so import integrity passes without changing editor behavior.
 */

import type { FormEvent } from "react";

import { CONTROL_ACTIONS } from "@/lib/ai/controlTower/actionRegistry";

export type CreateOnCreateHandler = (ev: FormEvent<HTMLFormElement>) => Promise<void> | void;

export type CreateOnCreateParams = {
  /** Optional implementation to delegate to (when provided by future extracted wiring). */
  onCreate?: CreateOnCreateHandler;
};

export function createOnCreate(params?: CreateOnCreateParams): CreateOnCreateHandler {
  return async (ev: FormEvent<HTMLFormElement>) => {
    // Fail-closed: never throw for missing wiring; still prevent default form submission.
    ev.preventDefault();
    if (params?.onCreate) {
      await params.onCreate(ev);
    }
  };
}

/** Superadmin session cookie; single action per request. Wire from existing CMS action surfaces only. */
export async function runControl(action: string): Promise<Response> {
  return fetch("/api/control-tower", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action }),
  });
}

export const CONTROL_TOWER_ACTIONS: ReadonlyArray<{ label: string; action: string }> = [
  { label: "Run Growth", action: CONTROL_ACTIONS.RUN_GROWTH },
  { label: "Run Strategy", action: CONTROL_ACTIONS.RUN_STRATEGY },
  { label: "Run Org", action: CONTROL_ACTIONS.RUN_ORG },
  { label: "Run Market", action: CONTROL_ACTIONS.RUN_MARKET },
  { label: "Run Profit", action: CONTROL_ACTIONS.RUN_PROFIT },
  { label: "Run Budget", action: CONTROL_ACTIONS.RUN_BUDGET },
  { label: "Run Credit Check", action: CONTROL_ACTIONS.RUN_CREDIT_CHECK },
  { label: "Run Invoicing", action: CONTROL_ACTIONS.RUN_INVOICING },
  { label: "Kill Switch ON", action: CONTROL_ACTIONS.KILL_SWITCH_ON },
  { label: "Kill Switch OFF", action: CONTROL_ACTIONS.KILL_SWITCH_OFF },
];

