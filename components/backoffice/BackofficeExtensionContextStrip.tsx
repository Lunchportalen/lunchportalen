"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  findBackofficeExtensionForPathname,
  getBackofficeSectionById,
} from "@/lib/cms/backofficeExtensionRegistry";
import { getDomainActionSurfaceById } from "@/lib/cms/controlPlaneDomainActionSurfaces";
import { getModuleLivePostureEntry } from "@/lib/cms/moduleLivePosture";

function postureTone(posture: string): string {
  if (posture === "LIVE") return "text-emerald-800";
  if (posture === "LIMITED") return "text-amber-900";
  return "text-slate-700";
}

function extensionKindLabel(kind: "workspace" | "surface" | "tool"): string {
  if (kind === "workspace") return "Workspace";
  if (kind === "surface") return "Surface";
  return "Verktøy";
}

/**
 * U17 — Workspace-/extension-kontekst (Umbraco workspace context-lignende, read-only).
 * Viser seksjon, modulposture og kort styringssignal fra eksisterende domain-surface — ingen ny sannhet.
 */
export function BackofficeExtensionContextStrip() {
  const pathname = usePathname() ?? "";
  const ext = findBackofficeExtensionForPathname(pathname);
  if (!ext) return null;

  const section = getBackofficeSectionById(ext.sectionId);
  const posture = ext.modulePostureId ? getModuleLivePostureEntry(ext.modulePostureId) : undefined;
  const domain = ext.domainSurfaceId ? getDomainActionSurfaceById(ext.domainSurfaceId) : undefined;

  return (
    <div
      className="shrink-0 border-b border-slate-200/80 bg-white/85 px-4 py-1 text-[10px] leading-snug text-slate-600 backdrop-blur-sm sm:px-6"
      role="region"
      aria-label="Workspace-kontekst"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="min-w-0 shrink font-semibold text-slate-900">
          {ext.label}
          <span className="font-normal text-slate-500"> · {section.label}</span>
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
          {section.plane === "management" ? "Styringsplan" : "Leveranseflate"}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700">
          {extensionKindLabel(ext.kind)}
        </span>
        {posture ? (
          <span className={`max-w-[min(100%,28rem)] truncate font-medium ${postureTone(posture.posture)}`} title={posture.note}>
            {posture.posture}
          </span>
        ) : null}
        <span className="min-w-0 max-w-[min(100%,28rem)] truncate text-slate-500" title={section.description}>
          {section.description}
        </span>
        {domain ? (
          <span className="min-w-0 max-w-[min(100%,36rem)] truncate text-slate-600" title={domain.sourceOfTruth}>
            <span className="font-medium text-slate-800">Styring:</span>{" "}
            {domain.mutationPosture === "read_only" ? "Lesing" : domain.mutationPosture === "review" ? "Review" : "Runtime-ruting"}
          </span>
        ) : null}
        {domain?.actions?.[0] ? (
          <Link
            className="shrink-0 font-semibold text-slate-900 underline underline-offset-2"
            href={domain.actions[0].href}
            {...(domain.actions[0].external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {domain.actions[0].label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
