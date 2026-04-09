// STATUS: KEEP
// Server-side broker: publish Sanity draft menuContent → published (same action as Studio).
// Employee runtime reads published perspective via existing GROQ (lib/sanity/queries + lib/cms/menuContent).

import "server-only";

import { requireSanityWrite } from "@/lib/sanity/client";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function stripDraftsPrefix(draftId: string): string {
  return draftId.startsWith("drafts.") ? draftId.slice("drafts.".length) : draftId;
}

export type PublishMenuContentDraftResult =
  | { ok: true; publishedId: string; draftId: string }
  | { ok: true; noop: true; reason: "no_draft_to_publish" }
  | { ok: false; error: "invalid_date" | "not_found" | "sanity_action_failed"; detail?: string };

/**
 * Publishes the draft `menuContent` for a calendar date, if a draft exists.
 * Uses Sanity Actions API (`sanity.action.document.publish`) — same semantic as Studio publish.
 * Fail-closed: requires SANITY_WRITE_TOKEN; does not create alternate truth in Supabase.
 */
export async function publishMenuContentDraftForDate(date: string): Promise<PublishMenuContentDraftResult> {
  if (!ISO_DATE.test(String(date ?? "").trim())) {
    return { ok: false, error: "invalid_date" };
  }

  const client = requireSanityWrite().withConfig({ apiVersion: "2025-02-19" });

  const draftId = await client.fetch<string | null>(
    `*[_type == "menuContent" && date == $date && _id in path("drafts.**")][0]._id`,
    { date }
  );

  if (!draftId || typeof draftId !== "string") {
    const anyDoc = await client.fetch<{ _id: string } | null>(
      `*[_type == "menuContent" && date == $date][0]{ _id }`,
      { date }
    );
    if (!anyDoc?._id) return { ok: false, error: "not_found" };
    return { ok: true, noop: true, reason: "no_draft_to_publish" };
  }

  const publishedId = stripDraftsPrefix(draftId);

  try {
    await client.action({
      actionType: "sanity.action.document.publish",
      publishedId,
      draftId,
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, error: "sanity_action_failed", detail };
  }

  return { ok: true, publishedId, draftId };
}
