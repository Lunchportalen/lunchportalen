// STATUS: KEEP

// lib/orderBackup/emailContent.ts
import "server-only";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
export function isoToDDMMYYYY(iso: string) {
  if (!isISODate(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !safeStr(v)) throw new Error(`Missing env: ${name}`);
  return safeStr(v);
}

export function receiptLinkForISODate(dateISO: string) {
  const base = requireEnv("APP_BASE_URL").replace(/\/+$/, "");
  const dd = isoToDDMMYYYY(dateISO);
  return `${base}/system/kvittering?date=${encodeURIComponent(dd)}`;
}

export type OrderMailKind = "confirmed" | "canceled";

export function buildOrderMail(opts: {
  kind: OrderMailKind;
  rid: string;
  orderId: string;
  dateISO: string; // YYYY-MM-DD
  companyName?: string | null;
  locationName?: string | null;
  employeeName?: string | null;
  department?: string | null;
  note?: string | null;
  status?: string | null;
}) {
  const kindLabel = opts.kind === "confirmed" ? "Registrert" : "Avbestilt";
  const dateDD = isoToDDMMYYYY(opts.dateISO);
  const link = receiptLinkForISODate(opts.dateISO);

  const company = safeStr(opts.companyName) || "—";
  const location = safeStr(opts.locationName) || "—";
  const employee = safeStr(opts.employeeName) || "—";
  const dept = safeStr(opts.department) || "—";
  const note = safeStr(opts.note) || "—";
  const status = safeStr(opts.status) || "—";

  const subject = `Ordre ${kindLabel} – ${dateDD} – ${company}`;

  const bodyText =
`Ordre-backup (drift)

Type: ${kindLabel}
Dato: ${dateDD}
Firma: ${company}
Lokasjon: ${location}
Ansatt: ${employee}
Avdeling: ${dept}
Status: ${status}
Notat: ${note}

OrderId: ${opts.orderId}
RID: ${opts.rid}

Kvittering:
${link}
`;

  const bodyHtml =
`<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
  <h2 style="margin:0 0 10px 0">Ordre-backup (drift)</h2>
  <table style="border-collapse:collapse">
    <tr><td style="padding:4px 10px 4px 0;color:#555">Type</td><td><b>${kindLabel}</b></td></tr>
    <tr><td style="padding:4px 10px 4px 0;color:#555">Dato</td><td>${dateDD}</td></tr>
    <tr><td style="padding:4px 10px 4px 0;color:#555">Firma</td><td>${company}</td></tr>
    <tr><td style="padding:4px 10px 4px 0;color:#555">Lokasjon</td><td>${location}</td></tr>
    <tr><td style="padding:4px 10px 4px 0;color:#555">Ansatt</td><td>${employee}</td></tr>
    <tr><td style="padding:4px 10px 4px 0;color:#555">Avdeling</td><td>${dept}</td></tr>
    <tr><td style="padding:4px 10px 4px 0;color:#555">Status</td><td>${status}</td></tr>
    <tr><td style="padding:4px 10px 4px 0;color:#555">Notat</td><td>${note}</td></tr>
  </table>

  <div style="margin-top:12px;color:#555;font-size:12px">
    OrderId: ${opts.orderId}<br/>
    RID: ${opts.rid}
  </div>

  <div style="margin-top:14px">
    <a href="${link}" style="display:inline-block;padding:10px 14px;border:1px solid #ddd;border-radius:12px;text-decoration:none;color:#111">
      Åpne kvittering
    </a>
  </div>
</div>`;

  return { subject, bodyText, bodyHtml };
}
