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
  if (posture === "LIVE") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (posture === "LIMITED") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-alt))] text-[rgb(var(--lp-muted))]";
}

function extensionKindLabel(kind: "workspace" | "surface" | "tool"): string {
  if (kind === "workspace") return "Workspace";
  if (kind === "surface") return "Surface";
  return "Verktøy";
}

function postureLabel(posture: string): string {
  if (posture === "LIVE") return "Live";
  if (posture === "LIMITED") return "Begrenset";
  if (posture === "DRY_RUN") return "Test";
  if (posture === "STUB") return "Ikke aktiv";
  return posture;
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
      className="shrink-0 rounded-2xl border border-[rgb(var(--lp-border))]/75 bg-[rgba(var(--lp-surface-rgb),0.78)] px-4 py-2 text-[11px] leading-snug text-[rgb(var(--lp-muted))] shadow-[var(--lp-shadow-sm)] backdrop-blur-sm"
      role="region"
      aria-label="Workspace-kontekst"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="min-w-0 shrink font-semibold text-[rgb(var(--lp-text))]">
          {ext.label}
          <span className="font-normal text-[rgb(var(--lp-muted))]"> · {section.label}</span>
        </span>
        <span className="lp-chip lp-chip-neutral text-[10px]">
          {section.plane === "management" ? "Styringsplan" : "Leveranseflate"}
        </span>
        <span className="lp-chip lp-chip-neutral text-[10px]">
          {extensionKindLabel(ext.kind)}
        </span>
        {posture ? (
          <span className={`rounded-full border px-2 py-0.5 font-semibold ${postureTone(posture.posture)}`} title={posture.note}>
            {postureLabel(posture.posture)}
          </span>
        ) : null}
        <span className="min-w-0 max-w-[min(100%,28rem)] truncate text-[rgb(var(--lp-muted))]" title={section.description}>
          {section.description}
        </span>
        {domain ? (
          <span className="min-w-0 max-w-[min(100%,36rem)] truncate text-[rgb(var(--lp-muted))]" title={domain.sourceOfTruth}>
            <span className="font-medium text-[rgb(var(--lp-text))]">Styring:</span>{" "}
            {domain.mutationPosture === "read_only" ? "Lesing" : domain.mutationPosture === "review" ? "Review" : "Runtime-ruting"}
          </span>
        ) : null}
        {domain?.actions?.[0] ? (
          <Link
            className="lp-link shrink-0 px-2 py-1 text-[11px]"
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
