"use client";

import { BackofficeWorkspaceFooterApps } from "@/components/backoffice/BackofficeWorkspaceFooterApps";

/** Seksjons-/oversikts-footer. På `/backoffice/content/[id]` brukes `ContentDetailDocumentPrimaryBar` i dokument-grid i stedet. */
export function WorkspaceFooter() {
  return <BackofficeWorkspaceFooterApps />;
}
