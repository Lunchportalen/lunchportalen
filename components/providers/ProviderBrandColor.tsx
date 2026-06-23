"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { DEFAULT_BRAND_ACCENT, normalizeBrandHex } from "@/lib/providers/brandColor";
import { saveProviderBrandColor } from "@/lib/providers/saveProviderLogo";
import { resolveProviderSettingsBrandError } from "@/lib/providers/providerSettingsActionErrors";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; label: string }
  | { kind: "error"; label: string };

export type ProviderBrandColorProps = {
  providerId: string;
  primaryColor: string | null;
};

export default function ProviderBrandColor({ providerId, primaryColor }: ProviderBrandColorProps) {
  const t = useTranslations("provider.settings.brand");
  const tErrors = useTranslations("provider.settings.brand.errors");
  const [value, setValue] = useState(primaryColor ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const busy = pending || status.kind === "loading";
  const previewHex = useMemo(() => normalizeBrandHex(value) ?? DEFAULT_BRAND_ACCENT, [value]);

  function onSave() {
    if (busy) return;
    const trimmed = value.trim();
    if (trimmed && !normalizeBrandHex(trimmed)) {
      setStatus({ kind: "error", label: tErrors("invalidHex") });
      return;
    }

    setStatus({ kind: "loading" });
    startTransition(async () => {
      const res = await saveProviderBrandColor(providerId, trimmed || null);
      if (res.ok) {
        setValue(res.primaryColor ?? "");
        setStatus({ kind: "success", label: res.primaryColor ? t("saved") : t("restoredDefault") });
        return;
      }
      if (res.ok === false) {
        setStatus({ kind: "error", label: resolveProviderSettingsBrandError((key) => tErrors(key), res) });
        return;
      }
    });
  }

  return (
    <div className="ds-provider-brand-color">
      <div className="ds-provider-brand-color__row">
        <span className="ds-provider-brand-color__swatch" style={{ background: previewHex }} aria-hidden="true" />
        <label className="ds-provider-brand-color__field" htmlFor="provider-brand-color">
          <span className="ds-provider-brand-color__label">{t("hexLabel")}</span>
          <input
            id="provider-brand-color"
            name="brandColor"
            value={value}
            placeholder={DEFAULT_BRAND_ACCENT}
            autoComplete="off"
            spellCheck={false}
            maxLength={7}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
          />
        </label>
        <button type="button" className="ds-btn ds-btn--secondary" onClick={onSave} disabled={busy}>
          {busy ? t("saving") : t("save")}
        </button>
      </div>

      <p className="ds-provider-brand-color__sample" aria-hidden="true">
        <span className="ds-provider-brand-color__sample-line" style={{ background: previewHex }} />
        {t("sampleHint")}
      </p>

      <p className="ds-provider-logo__hint">{t("formatHint")}</p>

      <p
        className={`ds-provider-logo__status${status.kind === "success" ? " is-success" : ""}${status.kind === "error" ? " is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {status.kind === "success" || status.kind === "error" ? status.label : ""}
      </p>
    </div>
  );
}
