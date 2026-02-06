// app/api/auth/post-login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";

type Role = "superadmin" | "company_admin" | "employee" | "driver" | "kitchen";

function pathForRole(role: Role): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "employee") return "/orders";
  if (role === "driver") return "/driver";
  if (role === "kitchen") return "/kitchen";
  return "/orders";
}

function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const n = String(next).trim();
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
  if (n.startsWith("/api/")) return null;
  if (
    n === "/login" ||
    n.startsWith("/login/") ||
    n === "/register" ||
    n.startsWith("/register/") ||
    n === "/registrering" ||
    n.startsWith("/registrering/") ||
    n === "/forgot-password" ||
    n.startsWith("/forgot-password/") ||
    n === "/reset-password" ||
    n.startsWith("/reset-password/")
  ) {
    return null;
  }
  return n;
}

function allowNextForRole(role: Role, nextPath: string | null): string | null {
  if (!nextPath) return null;
  if (role === "superadmin") return nextPath.startsWith("/superadmin") ? nextPath : null;
  if (role === "company_admin") return nextPath.startsWith("/admin") ? nextPath : null;
  if (role === "driver") return nextPath.startsWith("/driver") ? nextPath : null;
  if (role === "kitchen") return nextPath.startsWith("/kitchen") ? nextPath : null;
  // employee
  if (
    nextPath.startsWith("/orders") ||
    nextPath.startsWith("/week") ||
    nextPath.startsWith("/min-side")
  ) {
    return nextPath;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const rid = makeRid();

  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    const url = new URL(req.url);
    const nextRaw = url.searchParams.get("next");
    const nextSafe = safeNextPath(nextRaw);

    if (error || !user) {
      const to = new URL("/login", req.nextUrl.origin);
      if (nextSafe) to.searchParams.set("next", nextSafe);
      to.searchParams.set("e", "no_session");
      const res = jsonOk(rid, { ok: true, target: to.toString() }, 303);
      res.headers.set("Location", to.toString());
      return res;
    }

    const role = await getRoleForUser(user.id);
    if (!role) {
      const to = new URL("/orders", req.nextUrl.origin);
      to.searchParams.set("e", "missing_role");
      const res = jsonOk(rid, { ok: true, target: to.toString() }, 303);
      res.headers.set("Location", to.toString());
      return res;
    }

    const allowedNext = allowNextForRole(role as Role, nextSafe);
    const targetPath = allowedNext ?? pathForRole(role as Role);

    const to = new URL(targetPath, req.nextUrl.origin);
    const res = jsonOk(rid, { ok: true, target: to.toString() }, 303);
    res.headers.set("Location", to.toString());
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e ?? "Ukjent feil");
    return jsonErr(rid, "Kunne ikke fullfÃ¸re redirect.", 500, {
      code: "POST_LOGIN_FAILED",
      detail: { message },
    });
  }
}
