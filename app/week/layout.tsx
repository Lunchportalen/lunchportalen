// app/week/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

function normalizeRole(v: unknown): Role {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  return "employee";
}

function computeRoleNoDb(user: any): Role {
  const emailRole = roleByEmail(user?.email);
  if (emailRole) return emailRole;

  const appRole = normalizeRole(user?.app_metadata?.role);
  if (appRole !== "employee") return appRole;

  const metaRole = normalizeRole(user?.user_metadata?.role);
  return metaRole;
}

function homeForRole(role: Role) {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  return "/week";
}

async function currentPathFromHeaders(fallback: string) {
  try {
    const h = await headers();
    const url = h.get("x-url") || h.get("referer") || "";
    if (url) {
      const u = new URL(url);
      return u.pathname + (u.search || "");
    }
  } catch {}
  return fallback;
}

export default async function WeekLayout({ children }: { children: ReactNode }) {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    const next = encodeURIComponent(await currentPathFromHeaders("/week"));
    redirect(`/login?next=${next}`);
  }

  const role = computeRoleNoDb(user);

  // Kjøkken/driver skal ikke bruke week-UI
  if (role === "kitchen" || role === "driver") {
    redirect(homeForRole(role));
  }

  // Employee + company_admin + superadmin får tilgang
  // (company_admin må kunne bestille lunsj)
  return <>{children}</>;
}
