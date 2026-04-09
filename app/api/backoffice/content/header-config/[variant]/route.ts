import type { NextRequest } from "next/server";

import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { publishGlobal } from "@/lib/cms/publishGlobal";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, type ScopeOr401Result } from "@/lib/http/routeGuard";
import {
  getLocalCmsHeaderVariantConfig,
  isLocalCmsRuntimeError,
  saveLocalCmsHeaderVariantConfig,
} from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function denyResponse(s: ScopeOr401Result | null | undefined): Response {
  if (s != null && s.ok === false) return s.res ?? s.response;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

type NavItem = { label: string; href: string; exact?: boolean };

type HeaderVariantPayload = {
  title: string;
  nav: NavItem[];
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

function normalizeNav(raw: unknown): NavItem[] {
  if (!Array.isArray(raw)) return [];
  const out: NavItem[] = [];
  for (const x of raw) {
    if (!isPlainObject(x)) continue;
    const label = typeof x.label === "string" ? x.label : "";
    const href = typeof x.href === "string" ? x.href : "";
    const exact = x.exact === true;
    if (label.trim() && href.trim()) out.push({ label, href, ...(exact ? { exact: true } : {}) });
  }
  return out;
}

/**
 * Read per-variant header editor payload from `global_content.data` (key header).
 * Primary: `headerNavByVariant[variant]`. Legacy: `headerNavByRole`, `variants`.
 */
function extractVariantFromHeaderData(data: unknown, variant: string): HeaderVariantPayload | null {
  if (!isPlainObject(data)) return null;

  const byVariant = data.headerNavByVariant;
  if (isPlainObject(byVariant) && variant in byVariant) {
    const block = (byVariant as Record<string, unknown>)[variant];
    if (isPlainObject(block)) {
      const title = typeof block.title === "string" ? block.title : "";
      const nav = normalizeNav(block.nav);
      return { title, nav };
    }
  }

  const byRole = data.headerNavByRole;
  if (isPlainObject(byRole) && variant in byRole) {
    const block = (byRole as Record<string, unknown>)[variant];
    if (isPlainObject(block)) {
      const title = typeof block.title === "string" ? block.title : "";
      const nav = normalizeNav(block.nav);
      return { title, nav };
    }
  }

  const variants = data.variants;
  if (isPlainObject(variants) && variant in variants) {
    const block = (variants as Record<string, unknown>)[variant];
    if (isPlainObject(block)) {
      const title = typeof block.title === "string" ? block.title : "";
      const nav = normalizeNav(block.nav);
      return { title, nav };
    }
  }

  return null;
}

async function loadHeaderVariantConfig(variant: string): Promise<HeaderVariantPayload | null> {
  try {
    const supabase = supabaseAdmin();
    const { data: draft } = await supabase
      .from("global_content")
      .select("data")
      .eq("key", "header")
      .eq("status", "draft")
      .maybeSingle();

    const fromDraft = extractVariantFromHeaderData(draft?.data, variant);
    if (fromDraft) return fromDraft;

    const { data: published } = await supabase
      .from("global_content")
      .select("data")
      .eq("key", "header")
      .eq("status", "published")
      .maybeSingle();

    return extractVariantFromHeaderData(published?.data, variant);
  } catch {
    return null;
  }
}

/** Base document for draft merge: prefer draft row, else published, else {}. */
async function loadBaseHeaderDocument(): Promise<Record<string, unknown>> {
  const supabase = supabaseAdmin();
  const { data: draft } = await supabase
    .from("global_content")
    .select("data")
    .eq("key", "header")
    .eq("status", "draft")
    .maybeSingle();

  if (draft?.data && isPlainObject(draft.data)) {
    return cloneData(draft.data as Record<string, unknown>);
  }

  const { data: published } = await supabase
    .from("global_content")
    .select("data")
    .eq("key", "header")
    .eq("status", "published")
    .maybeSingle();

  if (published?.data && isPlainObject(published.data)) {
    return cloneData(published.data as Record<string, unknown>);
  }

  return {};
}

function parsePatchPayload(body: unknown): { ok: true; payload: HeaderVariantPayload } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Ugyldig JSON." };
  }
  const o = body as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : "";
  const nav = normalizeNav(o.nav);
  return { ok: true, payload: { title, nav } };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ variant: string }> }
): Promise<Response> {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const { rid } = s.ctx;
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const { variant: raw } = await context.params;
  const variant = decodeURIComponent(String(raw ?? "").trim());
  if (!variant) {
    return jsonErr(rid, "Mangler variant.", 400, "BAD_REQUEST");
  }

  const runtime = getCmsRuntimeStatus();
  if (runtime.mode !== "remote_backend") {
    try {
      const data = getLocalCmsHeaderVariantConfig(variant);
      return jsonOk(rid, data);
    } catch (error) {
      if (isLocalCmsRuntimeError(error)) {
        return jsonErr(rid, error.message, error.status, error.code, error.detail);
      }
      const message = error instanceof Error ? error.message : "Kunne ikke hente header-konfig.";
      return jsonErr(rid, message, 500, "SERVER_ERROR", { detail: String(error) });
    }
  }

  const data = await loadHeaderVariantConfig(variant);
  return jsonOk(rid, data);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ variant: string }> }
): Promise<Response> {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const { rid } = s.ctx;
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const { variant: raw } = await context.params;
  const variant = decodeURIComponent(String(raw ?? "").trim());
  if (!variant) {
    return jsonErr(rid, "Mangler variant.", 400, "BAD_REQUEST");
  }

  return withCmsPageDocumentGate("api/backoffice/content/header-config/[variant]/PATCH", async () => {
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
    if (runtime.mode === "local_provider") {
      try {
        const out = saveLocalCmsHeaderVariantConfig(variant, parsed.payload);
        return jsonOk(rid, out);
      } catch (error) {
        if (isLocalCmsRuntimeError(error)) {
          return jsonErr(rid, error.message, error.status, error.code, error.detail);
        }
        const message = error instanceof Error ? error.message : "Kunne ikke lagre header-konfig.";
        return jsonErr(rid, message, 500, "SERVER_ERROR", { detail: String(error) });
      }
    }

    if (runtime.mode === "reserve") {
      return jsonErr(
        rid,
        "Reserve-modus er skrivebeskyttet.",
        503,
        "LOCAL_DEV_CONTENT_RESERVE_READONLY",
      );
    }

    const base = await loadBaseHeaderDocument();
    const prevByVariant = isPlainObject(base.headerNavByVariant)
      ? ({ ...(base.headerNavByVariant as Record<string, unknown>) } as Record<string, unknown>)
      : {};

    prevByVariant[variant] = {
      title: parsed.payload.title,
      nav: parsed.payload.nav,
    };

    const nextDoc: Record<string, unknown> = {
      ...base,
      headerNavByVariant: prevByVariant,
    };

    const saved = await saveGlobalDraft("header", nextDoc);
    if (saved.ok === false) {
      return jsonErr(rid, saved.message, 500, "SAVE_FAILED");
    }

    const published = await publishGlobal("header");
    if (published.ok === false) {
      return jsonErr(rid, published.message, 500, "PUBLISH_FAILED");
    }

    const out =
      extractVariantFromHeaderData(published.data, variant) ?? {
        title: parsed.payload.title,
        nav: parsed.payload.nav,
      };
    return jsonOk(rid, out);
  });
}
