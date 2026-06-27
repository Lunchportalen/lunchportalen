"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import type { ProviderMenuRuntimeMappingProposal } from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";
import { buildRuntimeMappingDraftSaveRequestBody } from "@/lib/provider-menu/providerMenuRuntimeMappingDraftSavePayload";

type DraftRecord = {
  draftStatus: "draft" | "reviewed" | "archived";
};

type Props = {
  proposal: ProviderMenuRuntimeMappingProposal;
  canSaveDraft: boolean;
};

type LoadState = "idle" | "loading" | "loaded" | "error";

const DRAFT_API = "/api/provider/menu-profile/mapping-draft";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function ProviderMenuRuntimeMappingDraftSaveControls({
  proposal,
  canSaveDraft,
}: Props) {
  const t = useTranslations("provider.menu.runtimeMappingProposal.draftSave");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [draft, setDraft] = useState<DraftRecord | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const loadDraft = useCallback(async () => {
    setLoadState("loading");
    setFeedback(null);
    try {
      const res = await fetch(
        `${DRAFT_API}?menuProfileId=${encodeURIComponent(proposal.profileId)}`,
        { method: "GET", credentials: "same-origin" },
      );
      if (res.status === 404) {
        setDraft(null);
        setLoadState("loaded");
        return;
      }
      const json = await readJson(res);
      if (!res.ok || json.ok !== true) {
        setLoadState("error");
        return;
      }
      const data = json.data as { draft?: DraftRecord | null } | undefined;
      setDraft(data?.draft ?? null);
      setLoadState("loaded");
    } catch {
      setLoadState("error");
    }
  }, [proposal.profileId]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  const statusLabel = (() => {
    if (justSaved) return t("statusDraftSaved");
    if (!draft) return t("statusNotSaved");
    if (draft.draftStatus === "reviewed") return t("statusReviewed");
    if (draft.draftStatus === "archived") return t("statusArchived");
    return t("statusDraftSaved");
  })();

  const statusHelp = (() => {
    if (justSaved || draft?.draftStatus === "draft") return t("statusDraftSavedHelp");
    if (!draft) return t("statusNotSavedHelp");
    if (draft.draftStatus === "reviewed") return t("statusDraftSavedHelp");
    if (draft.draftStatus === "archived") return t("statusArchivedHelp");
    return t("statusNotSavedHelp");
  })();

  function handleSave() {
    if (!canSaveDraft || pending) return;
    setFeedback(null);
    setJustSaved(false);

    startTransition(async () => {
      try {
        const body = buildRuntimeMappingDraftSaveRequestBody(proposal);
        const res = await fetch(DRAFT_API, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await readJson(res);

        if (res.status === 403) {
          setFeedback({ kind: "error", message: t("permissionError") });
          return;
        }
        if (res.status === 400) {
          setFeedback({ kind: "error", message: t("validationError") });
          return;
        }
        if (!res.ok || json.ok !== true) {
          setFeedback({ kind: "error", message: t("genericError") });
          return;
        }

        const data = json.data as { draft?: DraftRecord } | undefined;
        setDraft(data?.draft ?? { draftStatus: "draft" });
        setJustSaved(true);
        setFeedback({ kind: "success", message: t("saveSuccess") });
      } catch {
        setFeedback({ kind: "error", message: t("genericError") });
      }
    });
  }

  return (
    <section
      className="lp-editor-runtime-mapping-proposal__draft-save"
      data-testid="provider-menu-runtime-mapping-draft-save"
      aria-labelledby="lp-editor-runtime-mapping-draft-save-title"
    >
      <h4 id="lp-editor-runtime-mapping-draft-save-title" className="lp-editor-runtime-mapping-proposal__section-title">
        {t("sectionTitle")}
      </h4>
      <p className="lp-editor-runtime-mapping-proposal__draft-status" data-testid="runtime-mapping-draft-status">
        <strong>{statusLabel}</strong>
      </p>
      <p className="lp-editor-runtime-mapping-proposal__draft-help">{statusHelp}</p>
      <p className="lp-editor-runtime-mapping-proposal__draft-warning">{t("activationWarning")}</p>

      {canSaveDraft ? (
        <button
          type="button"
          className="lp-editor-runtime-mapping-proposal__draft-save-btn"
          data-testid="runtime-mapping-draft-save-button"
          onClick={handleSave}
          disabled={pending || loadState === "loading"}
        >
          {t("saveButton")}
        </button>
      ) : (
        <p className="lp-editor-runtime-mapping-proposal__draft-viewer-note">{t("viewerNoSave")}</p>
      )}

      {feedback ? (
        <p
          className={
            feedback.kind === "success"
              ? "lp-editor-runtime-mapping-proposal__draft-feedback lp-editor-runtime-mapping-proposal__draft-feedback--success"
              : "lp-editor-runtime-mapping-proposal__draft-feedback lp-editor-runtime-mapping-proposal__draft-feedback--error"
          }
          role={feedback.kind === "error" ? "alert" : "status"}
          data-testid="runtime-mapping-draft-feedback"
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}
