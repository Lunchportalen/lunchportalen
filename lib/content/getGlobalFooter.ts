import "server-only";

import { getPublishedGlobal } from "@/lib/cms/readGlobal";

/**
 * Reads the published global footer document without a local self-fetch hop.
 */
export async function getGlobalFooter(): Promise<unknown | null> {
  try {
    const row = await getPublishedGlobal("footer");
    return {
      ok: true,
      rid: "local_footer_read",
      data: row?.data ?? {},
    };
  } catch {
    return null;
  }
}
