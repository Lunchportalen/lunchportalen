import "server-only";

import { loadCompanyRunnerGovernance, loadPlatformRunnerGovernance } from "@/lib/ai/runnerGovernance";
import type { CompanyRunnerGovernance, PlatformRunnerGovernance } from "@/lib/ai/runnerGovernance";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AiRecommendationApplyAction =
  | "downgrade_company_model_tier"
  | "restore_company_model_tier"
  | "block_tool"
  | "unblock_tool"
  | "throttle_tool_platform"
  | "unthrottle_tool_platform"
  | "set_company_billing_flag"
  | "clear_company_billing_flag"
  | "set_company_policy_note"
  | "set_platform_policy_note";

export const GOVERNANCE_SNAPSHOT_VERSION = 1 as const;

export type CompanyGovernanceSlice = {
  ai_runner_governance: CompanyRunnerGovernance;
  ai_billing_flagged: boolean;
  ai_billing_flag_reason: string | null;
};

export type GovernanceSnapshotV1 = {
  version: typeof GOVERNANCE_SNAPSHOT_VERSION;
  companies?: Record<string, CompanyGovernanceSlice>;
  platform?: PlatformRunnerGovernance | null;
};

export function emptySnapshot(): GovernanceSnapshotV1 {
  return { version: GOVERNANCE_SNAPSHOT_VERSION };
}

export async function readCompanySlice(companyId: string): Promise<CompanyGovernanceSlice> {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  const gov = await loadCompanyRunnerGovernance(id);
  if (!id) {
    return {
      ai_runner_governance: gov,
      ai_billing_flagged: false,
      ai_billing_flag_reason: null,
    };
  }
  const { data, error } = await supabaseAdmin()
    .from("companies")
    .select("ai_billing_flagged, ai_billing_flag_reason")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return {
      ai_runner_governance: gov,
      ai_billing_flagged: false,
      ai_billing_flag_reason: null,
    };
  }
  return {
    ai_runner_governance: gov,
    ai_billing_flagged: Boolean(data.ai_billing_flagged),
    ai_billing_flag_reason:
      typeof data.ai_billing_flag_reason === "string" ? data.ai_billing_flag_reason : null,
  };
}

export async function readPlatformSlice(): Promise<PlatformRunnerGovernance> {
  return loadPlatformRunnerGovernance();
}

export function requiresConfirmationForAction(
  action: AiRecommendationApplyAction | "rollback_governance_apply",
): boolean {
  if (
    action === "set_company_policy_note" ||
    action === "set_platform_policy_note" ||
    action === "throttle_tool_platform" ||
    action === "unthrottle_tool_platform"
  ) {
    return false;
  }
  return true;
}

export type InverseSpec = {
  action: AiRecommendationApplyAction;
  payload: Record<string, unknown>;
};

export function computeInverse(
  action: AiRecommendationApplyAction,
  payload: Record<string, unknown>,
  before: GovernanceSnapshotV1,
): InverseSpec | null {
  switch (action) {
    case "downgrade_company_model_tier": {
      const id = typeof payload.company_id === "string" ? payload.company_id : "";
      if (!id) return null;
      return { action: "restore_company_model_tier", payload: { company_id: id } };
    }
    case "restore_company_model_tier": {
      const id = typeof payload.company_id === "string" ? payload.company_id : "";
      if (!id) return null;
      const slice = before.companies?.[id];
      if (slice?.ai_runner_governance.model_tier === "economy") {
        return { action: "downgrade_company_model_tier", payload: { company_id: id } };
      }
      return null;
    }
    case "block_tool": {
      const tool = typeof payload.tool === "string" ? payload.tool : "";
      const scope = payload.scope === "company" ? "company" : "platform";
      if (!tool) return null;
      if (scope === "platform") {
        return { action: "unblock_tool", payload: { tool, scope: "platform" } };
      }
      const companyId = typeof payload.company_id === "string" ? payload.company_id : "";
      if (!companyId) return null;
      return { action: "unblock_tool", payload: { tool, scope: "company", company_id: companyId } };
    }
    case "unblock_tool": {
      const tool = typeof payload.tool === "string" ? payload.tool : "";
      const scope = payload.scope === "company" ? "company" : "platform";
      if (!tool) return null;
      if (scope === "platform") {
        return { action: "block_tool", payload: { tool, scope: "platform" } };
      }
      const companyId = typeof payload.company_id === "string" ? payload.company_id : "";
      if (!companyId) return null;
      return { action: "block_tool", payload: { tool, scope: "company", company_id: companyId } };
    }
    case "throttle_tool_platform": {
      const tool = typeof payload.tool === "string" ? payload.tool.trim() : "";
      if (!tool) return null;
      return { action: "unthrottle_tool_platform", payload: { tool } };
    }
    case "unthrottle_tool_platform": {
      const tool = typeof payload.tool === "string" ? payload.tool.trim() : "";
      if (!tool) return null;
      const ent = before.platform?.throttled_tools?.find((e) => e.tool === tool);
      if (!ent) return null;
      const ms = Date.parse(ent.until) - Date.now();
      const hours = Math.max(1, Math.min(168, Math.ceil(ms / 3_600_000)));
      return { action: "throttle_tool_platform", payload: { tool, duration_hours: hours } };
    }
    case "set_company_billing_flag": {
      const id = typeof payload.company_id === "string" ? payload.company_id : "";
      if (!id) return null;
      return { action: "clear_company_billing_flag", payload: { company_id: id } };
    }
    case "clear_company_billing_flag": {
      const id = typeof payload.company_id === "string" ? payload.company_id : "";
      if (!id) return null;
      const slice = before.companies?.[id];
      if (!slice) return null;
      return {
        action: "set_company_billing_flag",
        payload: {
          company_id: id,
          reason: slice.ai_billing_flag_reason ?? "RESTORED_AFTER_ROLLBACK",
        },
      };
    }
    case "set_company_policy_note": {
      const id = typeof payload.company_id === "string" ? payload.company_id : "";
      if (!id) return null;
      const prev = before.companies?.[id]?.ai_runner_governance.policy_notes;
      return {
        action: "set_company_policy_note",
        payload: { company_id: id, note: prev ?? "" },
      };
    }
    case "set_platform_policy_note": {
      const prev = before.platform?.policy_notes ?? "";
      return {
        action: "set_platform_policy_note",
        payload: { note: prev ?? "" },
      };
    }
    default:
      return null;
  }
}

export async function restoreSnapshot(snap: GovernanceSnapshotV1): Promise<void> {
  if (snap.version !== GOVERNANCE_SNAPSHOT_VERSION) {
    throw new Error("SNAPSHOT_VERSION_UNSUPPORTED");
  }
  if (snap.platform) {
    const { error } = await supabaseAdmin()
      .from("ai_platform_governance")
      .upsert(
        {
          id: 1,
          data: snap.platform as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    if (error) throw new Error(`PLATFORM_RESTORE_FAILED: ${error.message}`);
  }
  const companies = snap.companies;
  if (!companies) return;
  for (const [companyId, slice] of Object.entries(companies)) {
    const { error } = await supabaseAdmin()
      .from("companies")
      .update({
        ai_runner_governance: slice.ai_runner_governance as unknown as Record<string, unknown>,
        ai_billing_flagged: slice.ai_billing_flagged,
        ai_billing_flag_reason: slice.ai_billing_flag_reason,
        ai_billing_evaluated_at: new Date().toISOString(),
      })
      .eq("id", companyId);
    if (error) throw new Error(`COMPANY_RESTORE_FAILED: ${error.message}`);
  }
}

export async function captureRelevantState(
  action: AiRecommendationApplyAction,
  payload: Record<string, unknown>,
): Promise<GovernanceSnapshotV1> {
  const snap: GovernanceSnapshotV1 = { version: GOVERNANCE_SNAPSHOT_VERSION, companies: {} };

  const companyId =
    typeof payload.company_id === "string" ? payload.company_id.trim() : "";

  const validCompany = (): string | null => {
    if (!companyId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) {
      return null;
    }
    return companyId;
  };

  switch (action) {
    case "downgrade_company_model_tier":
    case "restore_company_model_tier":
    case "set_company_policy_note": {
      const id = validCompany();
      if (id) snap.companies![id] = await readCompanySlice(id);
      break;
    }
    case "block_tool":
    case "unblock_tool": {
      if (payload.scope === "company") {
        const id = validCompany();
        if (id) snap.companies![id] = await readCompanySlice(id);
      } else {
        snap.platform = await readPlatformSlice();
      }
      break;
    }
    case "set_company_billing_flag":
    case "clear_company_billing_flag": {
      const id = validCompany();
      if (id) snap.companies![id] = await readCompanySlice(id);
      break;
    }
    case "set_platform_policy_note":
    case "throttle_tool_platform":
    case "unthrottle_tool_platform": {
      snap.platform = await readPlatformSlice();
      break;
    }
    default:
      break;
  }

  if (snap.companies && Object.keys(snap.companies).length === 0) {
    delete snap.companies;
  }
  return snap;
}
