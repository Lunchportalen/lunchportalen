"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { removeProviderLogo, saveProviderLogo } from "@/lib/providers/saveProviderLogo";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/png,image/webp";
const ALLOWED_TYPES = new Set(["image/png", "image/webp"]);

type Status =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "success"; label: string }
  | { kind: "error"; label: string };

export type ProviderLogoUploaderProps = {
  providerId: string;
  providerName: string;
  logoUrl: string | null;
};

export default function ProviderLogoUploader({ providerId, providerName, logoUrl }: ProviderLogoUploaderProps) {
  const t = useTranslations("provider.settings.logo");
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentLogo, setCurrentLogo] = useState<string | null>(logoUrl);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const busy = pending || status.kind === "loading";
  const initials = providerName.slice(0, 2).toUpperCase();

  function onPickFile() {
    if (busy) return;
    inputRef.current?.click();
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setStatus({ kind: "error", label: t("invalidType") });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setStatus({ kind: "error", label: t("tooLarge") });
      return;
    }

    const fd = new FormData();
    fd.set("providerId", providerId);
    fd.set("file", file);

    setStatus({ kind: "loading", label: t("uploading") });
    startTransition(async () => {
      const res = await saveProviderLogo(fd);
      if (res.ok) {
        setCurrentLogo(res.logoUrl);
        setStatus({ kind: "success", label: t("updated") });
        return;
      }
      setStatus({ kind: "error", label: "error" in res ? res.error : t("uploadFailed") });
    });
  }

  function onRemove() {
    if (busy) return;
    setStatus({ kind: "loading", label: t("removing") });
    startTransition(async () => {
      const res = await removeProviderLogo(providerId);
      if (res.ok) {
        setCurrentLogo(null);
        setStatus({ kind: "success", label: t("removed") });
        return;
      }
      setStatus({ kind: "error", label: "error" in res ? res.error : t("removeFailed") });
    });
  }

  return (
    <div className="ds-provider-logo">
      <div className="ds-provider-logo__preview" aria-hidden={currentLogo ? undefined : "true"}>
        {currentLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentLogo} alt={t("altWithProvider", { providerName })} />
        ) : (
          <span className="ds-provider-logo__initials" aria-hidden="true">
            {initials}
          </span>
        )}
      </div>

      <div className="ds-provider-logo__body">
        <p className="ds-provider-logo__hint">{t("hint")}</p>
        <div className="ds-provider-logo__actions">
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            onClick={onPickFile}
            disabled={busy}
          >
            {busy && status.kind === "loading" && status.label === t("uploading")
              ? t("uploading")
              : currentLogo
                ? t("replace")
                : t("upload")}
          </button>
          {currentLogo ? (
            <button type="button" className="ds-provider-logo__remove" onClick={onRemove} disabled={busy}>
              {t("remove")}
            </button>
          ) : null}
        </div>
        <p
          className={`ds-provider-logo__status${status.kind === "success" ? " is-success" : ""}${status.kind === "error" ? " is-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {status.kind === "idle" ? "" : status.label}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="ds-provider-logo__input"
        onChange={onFileChange}
        aria-label={t("pickFile")}
        tabIndex={-1}
      />
    </div>
  );
}
