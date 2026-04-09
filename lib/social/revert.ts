/**
 * Best-effort tilbakerulling av autonome kalenderendringer (ingen ekstern publisering).
 */

import "server-only";

import type { Decision } from "@/lib/social/decisionEngine";
import { parseCalendar, serializeCalendar } from "@/lib/social/calendar";

export type RevertResult = { ok: true; postsJson: string } | { ok: false; error: string };

function isScheduleLike(t: Decision["type"]): boolean {
  return t === "schedule_post" || t === "schedule" || t === "adjust_timing";
}

function isPromoteLike(t: Decision["type"]): boolean {
  return t === "promote_product" || t === "promote" || t === "boost_existing";
}

export function revertDecision(decision: Decision, postsJson: string): RevertResult {
  const snap = decision.data.revertSnapshot;
  if (typeof snap === "string" && snap.trim().length > 0 && isScheduleLike(decision.type)) {
    return { ok: true, postsJson: snap };
  }

  if (isPromoteLike(decision.type)) {
    const postId = String(decision.data.postId ?? "").trim();
    if (!postId) return { ok: false, error: "missing_postId" };
    const posts = parseCalendar(postsJson);
    const next = posts.map((p) =>
      p.id === postId ? { ...p, autonomyPriority: false as const } : p,
    );
    return { ok: true, postsJson: serializeCalendar(next) };
  }

  if (decision.type === "deprioritize") {
    const postId = String(decision.data.postId ?? "").trim();
    if (!postId) return { ok: false, error: "missing_postId" };
    const posts = parseCalendar(postsJson);
    const next = posts.map((p) =>
      p.id === postId ? { ...p, reinforcementDeprioritized: false as const } : p,
    );
    return { ok: true, postsJson: serializeCalendar(next) };
  }

  if (decision.type === "generate_post" || decision.type === "generate") {
    return { ok: false, error: "generate_not_reversible" };
  }

  if (decision.type === "publish") {
    return { ok: false, error: "publish_never_executed" };
  }

  return { ok: false, error: "not_reversible" };
}
