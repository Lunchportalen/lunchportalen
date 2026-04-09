import type { NextRequest } from "next/server";

import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { publishGlobal } from "@/lib/cms/publishGlobal";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, type ScopeOr401Result } from "@/lib/http/routeGuard";
import { getLocalCmsPublishedGlobal } from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function denyResponse(s: ScopeOr401Result | null | undefined): Response {
  if (s != null && s.ok === false) return s.res ?? s.response;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

type FooterLink = { label: string; href: string };

type FooterConfigPayload = {
  footerLinks: FooterLink[];
  footerText: string;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function cloneData(data: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeFooterLinks(raw: unknown): FooterLink[] {
  if (!Array.isArray(raw)) return [];
  const out: FooterLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const href = typeof o.href === "string" ? o.href.trim() : "";
    if (!label || !href) continue;
    out.push({ label, href });
  }
  return out;
}

/** API view: derived from stored `links` / `bottomText` (canonical for live footer). */
function footerDataToApiPayload(data: Record<string, unknown>): FooterConfigPayload {
  const footerLinks = normalizeFooterLinks(data.links ?? data.footerLinks);
  const footerText =
    typeof data.bottomText === "string"
      ? data.bottomText
      : typeof data.footerText === "string"
        ? data.footerText
        : "";
  return { footerLinks, footerText };
}

async function loadFooterDocumentForEditor(): Promise<Record<string, unknown>> {
  const runtime = getCmsRuntimeStatus();
  if (runtime.mode !== "remote_backend") {
    return cloneData(getLocalCmsPublishedGlobal("footer").data);
  }

  const supabase = supabaseAdmin();
  const { data: draft } = await supabase
    .from("global_content")
    .select("data")
    .eq("key", "footer")
    .eq("status", "draft")
    .maybeSingle();

  if (draft?.data && isPlainObject(draft.data)) {
    return cloneData(draft.data as Record<string, unknown>);
  }

  const { data: published } = await supabase
    .from("global_content")
    .select("data")
    .eq("key", "footer")
    .eq("status", "published")
    .maybeSingle();

  if (published?.data && isPlainObject(published.data)) {
    return cloneData(published.data as Record<string, unknown>);
  }

  return {};
}

async function loadBaseFooterDocument(): Promise<Record<string, unknown>> {
  return loadFooterDocumentForEditor();
}

function parsePatchPayload(body: unknown): { ok: true; partial: Partial<FooterConfigPayload> } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Ugyldig JSON." };
  }
  const o = body as Record<string, unknown>;
  const partial: Partial<FooterConfigPayload> = {};
  if ("footerLinks" in o) {
    partial.footerLinks = normalizeFooterLinks(o.footerLinks);
  }
  if ("footerText" in o) {
    partial.footerText = typeof o.footerText === "string" ? o.footerText : "";
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, message: "Mangler footerLinks eller footerText." };
  }
  return { ok: true, partial };
}

export async function GET(request: NextRequest): Promise<Response> {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const { rid } = s.ctx;
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const doc = await loadFooterDocumentForEditor();
  const data = footerDataToApiPayload(doc);
  return jsonOk(rid, data);
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const { rid } = s.ctx;
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  return withCmsPageDocumentGate("api/backoffice/content/footer-config/PATCH", async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
    }

    const parsed = parsePatchPayload(body);
    if (parsed.ok === false) {
      return jsonErr(rid, parsed.message, 422, "VALIDATION_ERROR");
    }

    const runtime = getCmsRuntimeStatus();
    if (runtime.mode === "reserve") {
      return jsonErr(
        rid,
        "Reserve-modus er skrivebeskyttet.",
        503,
        "LOCAL_DEV_CONTENT_RESERVE_READONLY",
      );
    }

    const base = await loadBaseFooterDocument();
    const links =
      parsed.partial.footerLinks !== undefined
        ? parsed.partial.footerLinks
        : normalizeFooterLinks(base.links ?? base.footerLinks);
    const bottomText =
      parsed.partial.footerText !== undefined
        ? parsed.partial.footerText
        : typeof base.bottomText === "string"
          ? base.bottomText
          : typeof base.footerText === "string"
            ? base.footerText
            : "";

    /** Canonical keys for live `footerShellViewModelFromCmsJson` — columns preserved. */
    const nextDoc: Record<string, unknown> = {
      ...base,
      links,
      bottomText,
    };
    delete nextDoc.footerLinks;
    delete nextDoc.footerText;

    const saved = await saveGlobalDraft("footer", nextDoc);
    if (saved.ok === false) {
      return jsonErr(rid, saved.message, 500, "SAVE_FAILED");
    }

    const published = await publishGlobal("footer");
    if (published.ok === false) {
      return jsonErr(rid, published.message, 500, "PUBLISH_FAILED");
    }

    const out = footerDataToApiPayload(published.data);
    return jsonOk(rid, out);
  });
}
