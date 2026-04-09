import { parseTreeFetchEnvelope, type TreeFetchEnvelope } from "./mapTreeApiRoots";

export type FetchContentTreeResult =
  | { ok: true; envelope: TreeFetchEnvelope }
  | { ok: false; kind: "auth" | "forbidden" | "network" | "http"; message?: string };

/**
 * Single source for GET /api/backoffice/content/tree parsing (ContentTree load + post-create reveal).
 */
export async function fetchContentTreeEnvelope(): Promise<FetchContentTreeResult> {
  try {
    const res = await fetch("/api/backoffice/content/tree", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;

    if (res.status === 401) {
      return { ok: false, kind: "auth", message: "Du er ikke innlogget. Oppdater siden eller logg inn på nytt." };
    }
    if (res.status === 403) {
      return {
        ok: false,
        kind: "forbidden",
        message:
          "Innholdstreet krever superadmin-tilgang. API-et er begrenset til superadmin — kontakt plattformadministrator hvis du trenger tilgang.",
      };
    }
    if (!res.ok || json?.ok === false) {
      return {
        ok: false,
        kind: "http",
        message: json?.message ?? json?.error ?? `Kunne ikke laste tre (HTTP ${res.status}).`,
      };
    }
    return { ok: true, envelope: parseTreeFetchEnvelope(json) };
  } catch {
    return { ok: false, kind: "network", message: "Nettverksfeil ved lasting av tre." };
  }
}
