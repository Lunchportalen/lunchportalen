export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { BackofficeWorkspaceSurface } from "@/components/backoffice/BackofficeWorkspaceSurface";
import { CmsGrowthModuleCallout } from "@/components/cms/control-plane/CmsGrowthModuleCallout";

import EsgRuntimeClient from "./EsgRuntimeClient";

export default function BackofficeEsgPage() {
  return (
    <BackofficeWorkspaceSurface
      layout="fullBleed"
      workspaceId="esg"
      title="ESG"
      lead="Lesende oversikt fra eksisterende ESG-snapshots og rullering. Ingen nye tall opprettes her — kun visning av det som allerede er beregnet og lagret."
      contextSummary={
        <>
          <strong className="font-medium text-slate-900">Read-only</strong> visning av lagrede ESG-aggregater — ikke kilde
          for faktura eller ordre.
        </>
      }
      statusChips={[
        { label: "Lesing", tone: "muted" },
        { label: "Runtime rapportering ellers", tone: "neutral" },
      ]}
      footerApps={
        <>
          <strong className="font-medium text-slate-900">Footer:</strong> trenger du redaksjonell kontekst på sider, bruk{" "}
          <Link className="font-medium text-slate-900 underline underline-offset-2" href="/backoffice/content">
            Content
          </Link>
          .
        </>
      }
    >
      <CmsGrowthModuleCallout moduleId="esg" />
      <EsgRuntimeClient />
    </BackofficeWorkspaceSurface>
  );
}
