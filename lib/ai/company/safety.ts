/**
 * STEP 7 — Safety composition: halt autopilot on critical anomalies; rollback guidance is policy-side elsewhere.
 */

import type { CompanyAnomaly } from "./anomaly";
import type { CompanyExecutionMode } from "./types";

export type CompanySafetyVerdict = {
  autopilotAllowed: boolean;
  alertLevel: "none" | "warn" | "critical";
  messages: string[];
};

export function evaluateCompanySafety(params: {
  mode: CompanyExecutionMode;
  anomalies: CompanyAnomaly[];
}): CompanySafetyVerdict {
  const critical = params.anomalies.filter((a) => a.severity === "critical");
  const warn = params.anomalies.filter((a) => a.severity === "warn");
  const messages = params.anomalies.map((a) => `[${a.kind}] ${a.message}`);

  if (critical.length > 0) {
    return {
      autopilotAllowed: false,
      alertLevel: "critical",
      messages,
    };
  }

  if (params.mode === "auto" && warn.length > 0) {
    return {
      autopilotAllowed: false,
      alertLevel: "warn",
      messages: [...messages, "Auto-modus stoppet: åpne varsler krever menneskelig vurdering."],
    };
  }

  if (warn.length > 0) {
    return {
      autopilotAllowed: params.mode !== "auto",
      alertLevel: "warn",
      messages,
    };
  }

  return { autopilotAllowed: true, alertLevel: "none", messages: [] };
}
