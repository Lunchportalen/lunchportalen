import type { Provider } from "@/lib/providers/types";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Shown when provider is PAUSED or SUSPENDED (layout gate).
 */
export default function SuspendedBanner({ provider }: { provider: Provider }) {
  const status = provider.status;
  if (status !== "PAUSED" && status !== "SUSPENDED") return null;

  const reason =
    status === "PAUSED"
      ? safeStr(provider.pausedReason) || "Midlertidig pause"
      : safeStr(provider.suspendedReason) || "Suspendert";

  const title = status === "PAUSED" ? "Leverandøren er pauset" : "Leverandøren er suspendert";

  return (
    <section
      className={`ds-cta-band ds-cta-band--theme-dark${status === "PAUSED" ? " ds-cta-band--color-green" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="ds-cta-band__content">
        <p className="ds-eyebrow">{title}</p>
        <h2 className="ds-h2">{provider.name}</h2>
        <p className="ds-body">{reason}</p>
        <p className="ds-body">
          Kontakt{" "}
          <a className="ds-btn ds-btn--secondary" href={`mailto:${provider.contactEmail}`}>
            {provider.contactEmail}
          </a>{" "}
          for å løse opp.
        </p>
      </div>
    </section>
  );
}
