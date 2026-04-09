export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import BackofficeShell from "./_shell/BackofficeShell";
import { CmsHistoryDiscoveryStrip } from "@/components/cms/control-plane/CmsHistoryDiscoveryStrip";
import CmsRuntimeStatusStrip from "./_shell/CmsRuntimeStatusStrip";
import BlockedAccess from "@/components/auth/BlockedAccess";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { roleHome } from "@/lib/auth/roleHome";

async function currentPathFromHeaders(fallback: string) {
  try {
    const h = await headers();
    const url = h.get("x-url") || h.get("next-url") || h.get("referer") || "";
    if (url) {
      const u = new URL(url, "http://local");
      const path = (u.pathname || fallback) + (u.search || "");
      return path.startsWith("/backoffice") ? path : fallback;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export default async function BackofficeLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      const next = encodeURIComponent(await currentPathFromHeaders("/backoffice/content"));
      redirect(`/login?next=${next}`);
    }
    const reason = auth.reason ?? "ERROR";
    return <BlockedAccess reason={reason} />;
  }

  if (auth.role !== "superadmin") {
    redirect(roleHome(auth.role));
  }

  return (
    <BackofficeShell
      statusStrip={<CmsRuntimeStatusStrip />}
      historyStrip={<CmsHistoryDiscoveryStrip />}
    >
      {children}
    </BackofficeShell>
  );
}
