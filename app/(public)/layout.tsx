import type { ReactNode } from "react";
import { headers } from "next/headers";

import AppFooter from "@/components/AppFooter";
import HeaderShell from "@/components/nav/HeaderShell";
import { marketingHeaderInnerGridClass } from "@/lib/cms/design/designContract";
import { getDesignSettings } from "@/lib/cms/design/getDesignSettings";
import { getPublicLayoutExperimentAssignment } from "@/lib/experiments/publicLayoutExperiment";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import { TrackPageView } from "@/lib/public/analytics/TrackPageView";
import { CtaClickTracker } from "@/lib/public/analytics/CtaClickTracker";

const PUBLIC_ENV: "prod" | "staging" =
  typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? "staging"
    : "prod";

function parseVariantAssignmentHeader(raw: string | null): { experimentId: string; variantId: string } | null {
  if (raw == null || !String(raw).trim()) return null;
  try {
    const j = JSON.parse(String(raw)) as { experimentId?: unknown; variantId?: unknown };
    const experimentId = typeof j.experimentId === "string" ? j.experimentId.trim() : "";
    const variantId = typeof j.variantId === "string" ? j.variantId.trim() : "";
    if (!experimentId || !variantId) return null;
    return { experimentId, variantId };
  } catch {
    return null;
  }
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const localRuntime = getCmsRuntimeStatus().mode !== "remote_backend";
  const designSettings = await getDesignSettings();
  const headerInnerGridClass = marketingHeaderInnerGridClass(designSettings);
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "/";
  const variantRaw = h.get("x-variant-assignment");
  const fromHeader = parseVariantAssignmentHeader(variantRaw);
  const variantAssignment =
    localRuntime ? null : fromHeader ?? (await getPublicLayoutExperimentAssignment(pathname));
  const variantJson = JSON.stringify(variantAssignment ?? null);
  const bootstrapScript = `(function(){try{var v=${variantJson};window.__LP_VARIANT__=v;if(v&&v.experimentId&&v.variantId){document.cookie="lp_exp="+encodeURIComponent(JSON.stringify(v))+"; Path=/; Max-Age=604800; SameSite=Lax";}}catch(e){}})();`;
  const variantRawTrim = variantRaw != null ? String(variantRaw).trim() : "";
  const headerResyncScript =
    variantRawTrim.length > 0
      ? `(function(){try{window.__LP_VARIANT__=JSON.parse(${JSON.stringify(variantRawTrim)});}catch(e){window.__LP_VARIANT__=null}})();`
      : null;

  return (
    <div className="lp-page">
      {!localRuntime ? (
        <script
          // eslint-disable-next-line react/no-danger -- growth bootstrap: assigns window.__LP_VARIANT__ + lp_exp cookie (JSON from server only)
          dangerouslySetInnerHTML={{ __html: bootstrapScript }}
        />
      ) : null}
      {!localRuntime ? (
        <TrackPageView environment={PUBLIC_ENV} locale="nb" pageId={null} variantId={null} />
      ) : null}
      {!localRuntime ? <CtaClickTracker /> : null}
      <HeaderShell innerGridClassName={headerInnerGridClass} />

      <main className="lp-main">
        <div className="w-full">{children}</div>
      </main>

      <AppFooter containerMode="full" designSettings={designSettings} />
      {!localRuntime && headerResyncScript ? (
        <script
          // eslint-disable-next-line react/no-danger -- growth: x-variant-assignment JSON → window (try/catch, no crash)
          dangerouslySetInnerHTML={{ __html: headerResyncScript }}
        />
      ) : null}
    </div>
  );
}
