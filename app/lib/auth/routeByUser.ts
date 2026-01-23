// lib/auth/routeByUser.ts
export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

export function destinationForUser(user: {
  email?: string | null;
  user_metadata?: any;
}): { role: Role; path: string } {
  const email = normEmail(user.email);

  // 1) HARD e-post override (systemkontoer)
  if (email === "superadmin@lunchportalen.no") return { role: "superadmin", path: "/superadmin" };
  if (email === "kjokken@lunchportalen.no") return { role: "kitchen", path: "/kitchen" };
  if (email === "driver@lunchportalen.no") return { role: "driver", path: "/driver" };

  // 2) Kundekontoer: rolle fra metadata/profil (fallback)
  const roleRaw = String(user.user_metadata?.role ?? "employee").toLowerCase();
  const role: Role =
    roleRaw === "company_admin"
      ? "company_admin"
      : roleRaw === "superadmin"
      ? "superadmin"
      : roleRaw === "kitchen"
      ? "kitchen"
      : roleRaw === "driver"
      ? "driver"
      : "employee";

  // 3) Standard destinasjon per rolle
  if (role === "superadmin") return { role, path: "/superadmin" };
  if (role === "company_admin") return { role, path: "/admin" };
  if (role === "kitchen") return { role, path: "/kitchen" };
  if (role === "driver") return { role, path: "/driver" };
  return { role: "employee", path: "/week" };
}
