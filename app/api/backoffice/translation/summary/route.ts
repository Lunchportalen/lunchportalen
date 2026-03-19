import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

function deny(s: { response?: Response; res?: Response; ctx?: { rid: string } }) {
  if (s?.response) return s.response;
  if (s?.res) return s.res;
  return jsonErr(s?.ctx?.rid ?? "rid_missing", "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return deny(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("content_page_variants")
      .select("id, page_id, locale, environment")
      .order("locale", { ascending: true })
      .order("environment", { ascending: true });

    if (error) {
      const msg = typeof (error as any)?.message === "string" ? (error as any).message : "Kunne ikke hente lokaler.";
      return jsonErr(ctx.rid, msg, 500, "TRANSLATION_SUMMARY_FAILED");
    }

    const rows = Array.isArray(data)
      ? (data as { id: string; page_id: string; locale: string; environment: string }[])
      : [];

    type VariantInfo = { id: string; page_id: string; environment: string };
    type PageGroup = {
      page_id: string;
      environments: Record<string, VariantInfo[]>;
    };

    const locales: Record<
      string,
      {
        total: number;
        pages: Record<string, PageGroup>;
      }
    > = {};

    for (const row of rows) {
      const locale = (row.locale || "nb").trim();
      const env = (row.environment || "prod").trim();
      const pageId = row.page_id;

      if (!locales[locale]) {
        locales[locale] = { total: 0, pages: {} };
      }
      const locEntry = locales[locale];
      locEntry.total += 1;

      if (!locEntry.pages[pageId]) {
        locEntry.pages[pageId] = { page_id: pageId, environments: {} };
      }
      const pageEntry = locEntry.pages[pageId];
      if (!pageEntry.environments[env]) {
        pageEntry.environments[env] = [];
      }
      pageEntry.environments[env].push({ id: row.id, page_id: pageId, environment: env });
    }

    const summary = Object.entries(locales).map(([locale, value]) => {
      const pageList = Object.values(value.pages);
      const pageCount = pageList.length;
      const envStats: Record<string, { pages: number; variants: number }> = {};

      for (const pg of pageList) {
        for (const [env, vars] of Object.entries(pg.environments)) {
          if (!envStats[env]) {
            envStats[env] = { pages: 0, variants: 0 };
          }
          envStats[env].pages += 1;
          envStats[env].variants += vars.length;
        }
      }

      return {
        locale,
        totalVariants: value.total,
        pageCount,
        environments: envStats,
      };
    });

    return jsonOk(ctx.rid, { summary }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kunne ikke hente oversettelsesstatus.";
    return jsonErr(ctx.rid, msg, 500, "TRANSLATION_SUMMARY_FAILED");
  }
}

