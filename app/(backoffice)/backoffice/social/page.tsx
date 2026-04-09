export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { BackofficeWorkspaceSurface } from "@/components/backoffice/BackofficeWorkspaceSurface";
import { CmsGrowthModuleCallout } from "@/components/cms/control-plane/CmsGrowthModuleCallout";

import SocialCalendarRuntimeClient from "./SocialCalendarRuntimeClient";

export default function BackofficeSocialCalendarPage() {
  return (
    <BackofficeWorkspaceSurface
      layout="fullBleed"
      workspaceId="social"
      title="Social"
      lead={
        <>
          Lunchportalen sine egne kanaler — utkast, gjennomgang, planlegging og kontrollert publisering. Ingen kundekanaler.
          <span className="mt-2 block text-xs leading-relaxed text-slate-600">
            Ekstern publisering (for eksempel Meta) kan være <strong>dry-run</strong> eller deaktivert inntil nøkler er konfigurert — les
            alltid API-svar når du bruker «Publiser».
          </span>
        </>
      }
      contextSummary={
        <>
          Objekt: <strong className="font-medium text-slate-900">planlagte / utkast til innlegg</strong> i egen kalender —
          ikke ordre eller menypublisering.
        </>
      }
      statusChips={[
        { label: "Review / kontrollert publish", tone: "warning" },
        { label: "Ekstern kanal kan være DRY_RUN", tone: "muted" },
      ]}
      footerApps={
        <>
          <strong className="font-medium text-slate-900">Footer:</strong> sjekk modulposture i strip over. Ved tvil: les
          API-respons og logg — ingen skjult publisering.
        </>
      }
    >
      <CmsGrowthModuleCallout moduleId="social" />
      <SocialCalendarRuntimeClient />
    </BackofficeWorkspaceSurface>
  );
}
