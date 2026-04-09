import type { FormEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import { serializeBodyEnvelope } from "./_stubs";
import { parseJsonSafe, readApiError } from "./contentWorkspace.api";
import type { CreateData } from "./ContentWorkspaceState";
import { normalizeSlug, safeStr } from "./contentWorkspacePresentationSelectors";

export type SubmitCreateContentPageDeps = {
  creating: boolean;
  createTitle: string;
  createSlug: string;
  createDocumentTypeAlias: string | null;
  setCreating: Dispatch<SetStateAction<boolean>>;
  setCreateError: Dispatch<SetStateAction<string | null>>;
  setCreateTitle: Dispatch<SetStateAction<string>>;
  setCreateSlug: Dispatch<SetStateAction<string>>;
  setCreateSlugTouched: Dispatch<SetStateAction<boolean>>;
  setCreateDocumentTypeAlias: Dispatch<SetStateAction<string | null>>;
  setListReloadKey: Dispatch<SetStateAction<number>>;
  setCreatePanelOpen: Dispatch<SetStateAction<boolean>>;
  setCreatePanelMode: Dispatch<SetStateAction<"choose" | "form">>;
  guardPush: (href: string) => void;
};

/**
 * Opprett side via POST /api/backoffice/content/pages — samme logikk som tidligere inline i `ContentWorkspace.tsx`.
 * Ingen ny forretningslogikk; kun flyttet for linjebudsjett (FASE 32).
 */
export async function submitCreateContentPageFromForm(
  ev: FormEvent<HTMLFormElement>,
  deps: SubmitCreateContentPageDeps
): Promise<void> {
  ev.preventDefault();
  if (deps.creating) return;

  const nextTitle = safeStr(deps.createTitle);
  const nextSlug = normalizeSlug(deps.createSlug);

  if (!nextTitle || !nextSlug) {
    deps.setCreateError("Title og slug er paakrevd.");
    return;
  }

  deps.setCreating(true);
  deps.setCreateError(null);

  try {
    const initialBody =
      deps.createDocumentTypeAlias && deps.createDocumentTypeAlias.trim() !== ""
        ? serializeBodyEnvelope({
          documentType: deps.createDocumentTypeAlias,
          fields: {},
          blocksBody: { version: 1, blocks: [] },
        })
        : undefined;
    const res = await fetch("/api/backoffice/content/pages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        initialBody != null ? { title: nextTitle, slug: nextSlug, body: initialBody } : { title: nextTitle, slug: nextSlug }
      ),
    });
    const payload = await parseJsonSafe<CreateData>(res);

    if (!res.ok || !payload || (payload as { ok?: boolean }).ok !== true) {
      throw new Error(readApiError(res.status, payload, "Kunne ikke opprette side."));
    }

    const created =
      (payload as { data?: { page?: { id?: string; slug?: string } } })?.data?.page ??
      (payload as { page?: { id?: string; slug?: string } })?.page ??
      (payload as { item?: { id?: string; slug?: string } })?.item;
    const nextId = safeStr(created?.id);
    if (!nextId) throw new Error("Mangler side-id fra API.");

    deps.setCreateTitle("");
    deps.setCreateSlug("");
    deps.setCreateSlugTouched(false);
    deps.setCreateDocumentTypeAlias(null);
    deps.setListReloadKey((v) => v + 1);
    deps.setCreatePanelOpen(false);
    deps.setCreatePanelMode("choose");
    deps.guardPush(`/backoffice/content/${nextId}`);
  } catch (err) {
    const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke opprette side.";
    deps.setCreateError(message || "Kunne ikke opprette side.");
  } finally {
    deps.setCreating(false);
  }
}
