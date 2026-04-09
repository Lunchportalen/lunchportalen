import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { recordCmsGateEnter } from "@/lib/system/controlPlaneMetrics";
import { isStrictCms } from "@/lib/system/controlStrict";

const cmsPageDocStorage = new AsyncLocalStorage<{ source: string }>();

export function isWithinCmsPageDocumentGate(): boolean {
  return cmsPageDocStorage.getStore() != null;
}

export async function withCmsPageDocumentGate<T>(source: string, fn: () => Promise<T>): Promise<T> {
  return cmsPageDocStorage.run({ source }, async () => {
    recordCmsGateEnter(source);
    return fn();
  });
}

/** Page document mutations should run inside {@link withCmsPageDocumentGate} or strict mode throws. */
export function warnCmsPageDocumentBypass(where: string): void {
  if (isWithinCmsPageDocumentGate()) return;
  if (isStrictCms()) {
    throw new Error(
      `CMS_STRICT_BYPASS: ${where}. Mutations must run inside withCmsPageDocumentGate. STRICT_MODE / LP_STRICT_CMS / LP_STRICT_CONTROL is enabled.`,
    );
  }
  if (process.env.NODE_ENV === "production") return;
  console.warn(
    `[CMS] Page document mutation outside canonical gate (${where}). Editor saves use PATCH /api/backoffice/content/pages/[id] from ContentWorkspace.`,
  );
}
