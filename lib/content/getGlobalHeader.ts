import "server-only";

import { getPublishedGlobal } from "@/lib/cms/readGlobal";

/**
 * Reads the published global header document without a local self-fetch hop.
 */
export async function getGlobalHeader(): Promise<unknown | null> {
  try {
    const row = await getPublishedGlobal("header");
    return {
      ok: true,
      rid: "local_header_read",
      data: row?.data ?? {},
    };
  } catch {
    return null;
  }
}
