import { getTranslations } from "next-intl/server";

import type { Provider } from "@/lib/providers/types";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Shown when provider is PAUSED or SUSPENDED (layout gate).
 */
export default async function SuspendedBanner({ provider }: { provider: Provider }) {
  const status = provider.status;
  if (status !== "PAUSED" && status !== "SUSPENDED") return null;

  const t = await getTranslations("provider.banner");
  const isPaused = status === "PAUSED";

  const reason = isPaused
    ? safeStr(provider.pausedReason) || t("paused.defaultReason")
    : safeStr(provider.suspendedReason) || t("suspended.defaultReason");

  const title = isPaused ? t("paused.title") : t("suspended.title");

  return (
    <section
      className={`ds-cta-band ds-cta-band--theme-dark${isPaused ? " ds-cta-band--color-green" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="ds-cta-band__content">
        <p className="ds-eyebrow">{title}</p>
        <h2 className="ds-h2">{provider.name}</h2>
        <p className="ds-body">{reason}</p>
        <p className="ds-body">
          {t("contactPrefix")}{" "}
          <a className="ds-btn ds-btn--secondary" href={`mailto:${provider.contactEmail}`}>
            {provider.contactEmail}
          </a>{" "}
          {t("contactSuffix")}
        </p>
      </div>
    </section>
  );
}
