"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BackofficeCommandPalette } from "@/components/backoffice/BackofficeCommandPalette";
import { BackofficeExtensionContextStrip } from "@/components/backoffice/BackofficeExtensionContextStrip";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
import TopBar from "./TopBar";

type BackofficeShellProps = {
  children: ReactNode;
  /** Server component (f.eks. runtime-statusstrip) injisert fra layout */
  statusStrip?: ReactNode;
  /** CP12 — ærlig historikk-/discovery-lenker (UX, ingen ny motor) */
  historyStrip?: ReactNode;
};

export default function BackofficeShell({ children, statusStrip, historyStrip }: BackofficeShellProps) {
  const pathname = usePathname() ?? "";
  const contentRoute = resolveBackofficeContentRoute(pathname);
  const isContentDetailEditor = contentRoute.kind === "detail";

  return (
    <div className="flex h-screen flex-col bg-[rgb(var(--lp-bg))]">
      <TopBar />
      {isContentDetailEditor ? (
        /* Ingen beige «shelf» under TopBar — Cmd+K-palett monteres fortsatt (åpen state er egen overlay). */
        <BackofficeCommandPalette />
      ) : (
        <div className="shrink-0 space-y-2 border-b border-[rgb(var(--lp-border))]/60 bg-[rgb(var(--lp-bg))]/92 px-3 py-3 backdrop-blur-sm sm:px-4">
          <BackofficeExtensionContextStrip />
          <BackofficeCommandPalette />
          {statusStrip}
          {historyStrip}
        </div>
      )}
      <div
        className={
          isContentDetailEditor
            ? "flex min-h-0 flex-1 px-0 pb-0 pt-0"
            : "flex min-h-0 flex-1 px-3 pb-3 pt-3 sm:px-4"
        }
      >
        <div
          className={
            isContentDetailEditor
              ? "min-h-0 flex-1 overflow-hidden bg-[rgb(var(--lp-bg))]"
              : "min-h-0 flex-1 overflow-hidden rounded-[26px] bg-white/55 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
