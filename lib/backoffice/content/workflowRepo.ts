/**
 * Phase 19: Workflow state repo (server-only). Deterministic transitions + audit.
 */

export type WorkflowState = "draft" | "review" | "approved" | "rejected";
export type WorkflowAction = "submit_review" | "approve" | "reject" | "reset_to_draft";

const TRANSITIONS: Record<WorkflowState, Partial<Record<WorkflowAction, WorkflowState>>> = {
  draft: { submit_review: "review" },
  review: { approve: "approved", reject: "rejected" },
  approved: { reset_to_draft: "draft" },
  rejected: { reset_to_draft: "draft" },
};

export type WorkflowRow = {
  id: string;
  page_id: string;
  variant_id: string;
  environment: string;
  locale: string;
  state: WorkflowState;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

const DEFAULT_STATE: WorkflowState = "draft";

export async function getWorkflow(
  supabase: { from: (t: string) => { select: (c: string) => { eq: (a: string, v: string) => any } } },
  variantId: string,
  environment: string,
  locale: string
): Promise<{ state: WorkflowState; updated_at?: string; updated_by?: string | null }> {
  const { data, error } = await supabase
    .from("content_workflow_state")
    .select("state, updated_at, updated_by")
    .eq("variant_id", variantId)
    .eq("environment", environment)
    .eq("locale", locale)
    .maybeSingle();
  if (error || !data) return { state: DEFAULT_STATE };
  return {
    state: (data.state as WorkflowState) ?? DEFAULT_STATE,
    updated_at: data.updated_at,
    updated_by: data.updated_by ?? null,
  };
}

export async function setWorkflow(
  supabase: any,
  variantId: string,
  pageId: string,
  environment: string,
  locale: string,
  nextState: WorkflowState,
  actorEmail: string | null,
  fromState: WorkflowState,
  action: WorkflowAction
): Promise<WorkflowRow> {
  const now = new Date().toISOString();
  const { data: upserted, error: upsertError } = await supabase
    .from("content_workflow_state")
    .upsert(
      {
        page_id: pageId,
        variant_id: variantId,
        environment,
        locale,
        state: nextState,
        updated_by: actorEmail,
        updated_at: now,
      },
      { onConflict: "variant_id,environment,locale" }
    )
    .select()
    .single();
  if (upsertError) throw new Error(upsertError.message);
  await supabase.from("content_audit_log").insert({
    page_id: pageId,
    variant_id: variantId,
    environment,
    locale,
    action: "workflow_change",
    actor_email: actorEmail,
    metadata: { from: fromState, to: nextState, action },
  });
  return upserted as WorkflowRow;
}

export function getNextState(
  current: WorkflowState,
  action: WorkflowAction
): { ok: true; next: WorkflowState } | { ok: false; code: "workflow_invalid_transition" } {
  const next = TRANSITIONS[current]?.[action];
  if (next === undefined) return { ok: false, code: "workflow_invalid_transition" };
  return { ok: true, next };
}
/** After successful prod publish: set workflow back to draft and audit (requires re-approval for next publish). */
export async function resetToDraftAfterPublish(
  supabase: any,
  variantId: string,
  pageId: string,
  environment: string,
  locale: string,
  actorEmail: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("content_workflow_state")
    .upsert(
      {
        page_id: pageId,
        variant_id: variantId,
        environment,
        locale,
        state: "draft",
        updated_by: actorEmail,
        updated_at: now,
      },
      { onConflict: "variant_id,environment,locale" }
    );
  await supabase.from("content_audit_log").insert({
    page_id: pageId,
    variant_id: variantId,
    environment,
    locale,
    action: "workflow_change",
    actor_email: actorEmail,
    metadata: { from: "approved", to: "draft", action: "post_publish_reset" },
  });
}
