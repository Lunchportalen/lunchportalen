export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { trackCampaignEvent } from "@/lib/campaign/track";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { recordLiveClick } from "@/lib/live/campaignStats";
import { opsLog } from "@/lib/ops/log";

if (false) {
  void jsonOk(makeRid("_"), {}, 200);
  void jsonErr(makeRid("_"), "x", 400, "x");
}

function allowedRedirectHosts(): Set<string> {
  const s = new Set<string>();
  for (const h of String(process.env.LP_TRACK_CLICK_ALLOW_HOSTS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)) {
    s.add(h.toLowerCase());
  }
  const site = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (site) {
    try {
      s.add(new URL(site).hostname.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  s.add("lunchportalen.no");
  return s;
}

function isSafeHttpsUrl(raw: string): { ok: true; url: URL } | { ok: false } {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return { ok: false };
    const host = u.hostname.toLowerCase();
    if (!allowedRedirectHosts().has(host)) return { ok: false };
    return { ok: true, url: u };
  } catch {
    return { ok: false };
  }
}

/**
 * Klikk-sporingsredirect — logger, teller, redirect til tillatt vert (open-redirect beskyttet).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("track_click");
  const url = new URL(req.url);
  const target = url.searchParams.get("to");
  const campaign = url.searchParams.get("c") ?? "";

  if (!target) {
    return jsonErr(rid, "Parameter «to» er påkrevd.", 422, "MISSING_TO");
  }

  const check = isSafeHttpsUrl(target);
  if (!check.ok) {
    opsLog("track_click_rejected", { rid, reason: "unsafe_or_disallowed_host", campaign });
    return jsonErr(rid, "Ugyldig eller ikke tillatt mål-URL.", 400, "INVALID_TO");
  }

  recordLiveClick(1);
  trackCampaignEvent({ name: "click_redirect", campaign, toHost: check.url.hostname });
  opsLog("track_click", { rid, campaign, toHost: check.url.hostname });

  return Response.redirect(check.url.toString(), 302);
}
