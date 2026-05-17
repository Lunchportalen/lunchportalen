import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { landingForRole, normalizeRole } from "@/lib/auth/role";

const MARKETING_SITE_ROOT = "https://lunchportalen.no/";

export default async function AppRoot() {
  let role: string | null = null;
  try {
    const auth = await getAuthContext();
    role = auth?.role ?? null;
  } catch {
    role = null;
  }

  if (role) {
    const normalized = normalizeRole(role);
    if (normalized) {
      const dest = landingForRole(normalized);
      if (dest && dest.startsWith("/")) {
        redirect(dest);
      }
    }
  }

  redirect(MARKETING_SITE_ROOT);
}
