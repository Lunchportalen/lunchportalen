export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
import Link from "next/link";

import { BackofficeWorkspaceSurface } from "@/components/backoffice/BackofficeWorkspaceSurface";
import { CmsGrowthModuleCallout } from "@/components/cms/control-plane/CmsGrowthModuleCallout";

import SeoGrowthRuntimeClient from "./SeoGrowthRuntimeClient";

export default function BackofficeSeoGrowthPage() {
  return (
    <BackofficeWorkspaceSurface
      layout="fullBleed"
      workspaceId="seo-growth"
      title="SEO"
      lead="Analyse, forslag og lagring av SEO-metadata i eksisterende CMS-flyt. Ingen automatisk publisering — review først."
      contextSummary={
        <>
          Endrer <strong className="font-medium text-slate-900">SEO-metadata</strong> koblet til innhold — ikke operativ
          meny eller ordre. Publisering av selve sidene skjer i Content-workspace.
        </>
      }
      statusChips={[
        { label: "Review før publisering", tone: "warning" },
        { label: "Modulposture: se strip", tone: "muted" },
      ]}
      footerApps={
        <>
          <strong className="font-medium text-slate-900">Footer:</strong> når metadata er lagret, må innhold fortsatt
          publiseres via{" "}
          <Link className="font-medium text-slate-900 underline underline-offset-2" href="/backoffice/content">
            Content
          </Link>{" "}
          der det er relevant.
        </>
      }
    >
      <CmsGrowthModuleCallout moduleId="seo" />
      <Suspense fallback={<p className="p-6 text-sm text-[rgb(var(--lp-muted))]">Laster SEO…</p>}>
        <SeoGrowthRuntimeClient />
      </Suspense>
    </BackofficeWorkspaceSurface>
  );
}
