// STATUS: KEEP

import * as React from "react";

type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN" | string;
type AgreementStatus = "ACTIVE" | "PENDING_SUPERADMIN" | "DRAFT" | "REJECTED" | "PAUSED" | "EXPIRED" | "MISSING" | string;

type Props = {
  companyName: string;
  locationLabel?: string | null;
  planLabel?: string | null;

  companyStatus?: CompanyStatus | null;
  agreementStatus?: AgreementStatus | null;

  cutoffLabel?: string | null;     // "08:00 (Oslo)"
  systemTimeLabel?: string | null; // "15:01 (Oslo)" (optional)

  weekLabel?: string | null;       // "Uke 11 (10.–14. feb)"
  weekRuleText?: string | null;    // "Neste uke åpner torsdag kl. 08:00 (Oslo)."

  className?: string;
};

function pill(status: string) {
  const s = (status || "UNKNOWN").toUpperCase();
  if (s === "ACTIVE") return { fg: "#1B5E20", bg: "#f2fbf4", bd: "#1B5E20", label: "ACTIVE" };
  if (s === "PAUSED") return { fg: "#C77700", bg: "#fff7ec", bd: "#C77700", label: "PAUSED" };
  if (s === "CLOSED") return { fg: "#B00020", bg: "#fff1f1", bd: "#B00020", label: "CLOSED" };
  if (s === "PENDING") return { fg: "#C77700", bg: "#fff7ec", bd: "#C77700", label: "PENDING" };
  return { fg: "#4B5563", bg: "#fff", bd: "#E5E7EB", label: s };
}

function kv(label: string, value?: string | null) {
  if (!value) return null;
  return (
    <span style={{ display: "inline-flex", gap: 6, whiteSpace: "nowrap" }}>
      <span style={{ color: "rgba(17,17,17,0.55)" }}>{label}:</span>
      <span style={{ color: "rgba(17,17,17,0.85)", fontWeight: 500 }}>{value}</span>
    </span>
  );
}

export function SystemContextHeader({
  companyName,
  locationLabel,
  planLabel,
  companyStatus,
  agreementStatus,
  cutoffLabel,
  systemTimeLabel,
  weekLabel,
  weekRuleText,
  className,
}: Props) {
  const p = pill(String(companyStatus ?? "UNKNOWN"));

  return (
    <div
      className={className}
      style={{
        background: "#F7F6F3",
        padding: "20px 24px 16px",
        borderBottom: "1px solid #E5E7EB",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111111", lineHeight: 1.2 }}>
            {companyName}
          </div>

          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12 }}>
            {kv("Lokasjon", locationLabel)}
            {kv("Plan", planLabel)}
            {kv("Avtale", agreementStatus ? String(agreementStatus).toUpperCase() : null)}
          </div>

          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12 }}>
            {kv("Cutoff", cutoffLabel ?? "08:00 (Oslo)")}
            {kv("Systemtid", systemTimeLabel)}
          </div>
        </div>

        <span
          title="Firmastatus"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 10px",
            borderRadius: 999,
            border: `1px solid ${p.bd}`,
            background: p.bg,
            color: p.fg,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.6,
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          {p.label}
        </span>
      </div>

      {(weekLabel || weekRuleText) ? (
        <div style={{ marginTop: 12 }}>
          {weekLabel ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(17,17,17,0.9)" }}>
              {weekLabel}
            </div>
          ) : null}
          {weekRuleText ? (
            <div style={{ fontSize: 12, color: "rgba(17,17,17,0.55)", marginTop: 2 }}>
              {weekRuleText}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
