import * as React from "react";

export type AgreementStatus =
  | "DRAFT"
  | "PENDING_SUPERADMIN"
  | "ACTIVE"
  | "REJECTED"
  | "PAUSED"
  | "EXPIRED"
  | "MISSING"
  | string;

type Props = {
  status?: AgreementStatus | null;
  compact?: boolean;
  className?: string;
  title?: string; // optional override tooltip
};

function norm(s: Props["status"]) {
  return String(s ?? "MISSING").trim().toUpperCase();
}

function mapStatus(statusRaw: string) {
  // Web-safe, no theme dependency. Uses “calm SaaS” palette.
  // Adjust tokens later if you have central CSS variables.
  switch (statusRaw) {
    case "ACTIVE":
      return {
        label: "ACTIVE",
        hint: "Avtale aktiv",
        fg: "#1B5E20",
        bg: "#f2fbf4",
        bd: "#1B5E20",
      };
    case "PENDING_SUPERADMIN":
      return {
        label: "PENDING",
        hint: "Venter på superadmin",
        fg: "#C77700",
        bg: "#fff7ec",
        bd: "#C77700",
      };
    case "DRAFT":
      return {
        label: "DRAFT",
        hint: "Ikke sendt",
        fg: "#4B5563",
        bg: "#FFFFFF",
        bd: "#E5E7EB",
      };
    case "REJECTED":
      return {
        label: "REJECTED",
        hint: "Avvist",
        fg: "#B00020",
        bg: "#fff1f1",
        bd: "#B00020",
      };
    case "PAUSED":
      return {
        label: "PAUSED",
        hint: "Midlertidig stoppet",
        fg: "#C77700",
        bg: "#fff7ec",
        bd: "#C77700",
      };
    case "EXPIRED":
      return {
        label: "EXPIRED",
        hint: "Utløpt",
        fg: "#B00020",
        bg: "#fff1f1",
        bd: "#B00020",
      };
    case "MISSING":
      return {
        label: "MISSING",
        hint: "Ingen avtale",
        fg: "#4B5563",
        bg: "#FFFFFF",
        bd: "#E5E7EB",
      };
    default:
      return {
        label: statusRaw || "UNKNOWN",
        hint: "Ukjent status",
        fg: "#4B5563",
        bg: "#FFFFFF",
        bd: "#E5E7EB",
      };
  }
}

export function AgreementStatusBadge({ status, compact = false, className, title }: Props) {
  const s = React.useMemo(() => norm(status), [status]);
  const m = React.useMemo(() => mapStatus(s), [s]);

  return (
    <span
      className={className}
      title={title ?? m.hint}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 0 : 6,
        padding: compact ? "4px 10px" : "6px 10px",
        borderRadius: 999,
        border: `1px solid ${m.bd}`,
        background: m.bg,
        color: m.fg,
        lineHeight: 1,
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6 }}>{m.label}</span>
      {!compact ? (
        <span style={{ fontSize: 12, fontWeight: 400, color: "rgba(17,17,17,0.55)" }}>{m.hint}</span>
      ) : null}
    </span>
  );
}
