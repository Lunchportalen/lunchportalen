// STATUS: KEEP

// lib/pdf/generateAgreementPdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
export type PlanTier = "BASIS" | "LUXUS";

export type DayPlan = {
  enabled: boolean;
  tier: PlanTier;
  priceExVat: number;
};

export type AgreementPdfInput = {
  companyName: string;
  orgnr: string;

  adminName?: string | null;
  adminEmail?: string | null;
  adminPhone?: string | null;

  locationName: string;
  address: string;
  postalCode: string;
  city: string;

  delivery: {
    where: string;
    whenNote: string;
    contactName: string;
    contactPhone: string;
    windowFrom: string;
    windowTo: string;
  };

  days: Record<DayKey, DayPlan>;

  terms: {
    version: string;
    updatedAt: string;

    accepted: boolean;
    acceptedAt: string;

    creditConsent: boolean;
    creditConsentAt: string;

    creditCheckSystem: string;
    billingPricesIncludeVat: boolean;
    bindingMonths: number;
    noticeMonths: number;
  };
};

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function moneyNOKExVat(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  return `${n.toFixed(0)} kr eks. mva`;
}

function dayLabelNO(k: DayKey) {
  switch (k) {
    case "mon":
      return "Mandag";
    case "tue":
      return "Tirsdag";
    case "wed":
      return "Onsdag";
    case "thu":
      return "Torsdag";
    case "fri":
      return "Fredag";
  }
}

function safeISODateTime(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toISOString();
}

type Cursor = { x: number; y: number };

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const t = (text ?? "").toString().replace(/\r/g, "");
  if (!t.trim()) return ["—"];

  const paragraphs = t.split("\n").map((p) => p.trim());
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para) {
      lines.push("");
      continue;
    }

    const words = para.split(/\s+/);
    let line = "";

    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      const width = font.widthOfTextAtSize(candidate, fontSize);

      if (width <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);

        // hard-wrap hvis ordet er for langt
        let chunk = w;
        while (font.widthOfTextAtSize(chunk, fontSize) > maxWidth && chunk.length > 4) {
          chunk = chunk.slice(0, -1);
        }
        lines.push(chunk);

        const rest = w.slice(chunk.length);
        line = rest ? rest : "";
      }
    }

    if (line) lines.push(line);
  }

  return lines.length ? lines : ["—"];
}

function ensureSpace(cursor: Cursor, minY: number) {
  // MVP: én side. Vi klamper for å unngå krasj ved for mye tekst.
  if (cursor.y < minY) cursor.y = minY;
}

export async function generateAgreementPdf(input: AgreementPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  // A4
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const contentWidth = width - margin * 2;

  const cursor: Cursor = { x: margin, y: height - margin };

  const colors = {
    text: rgb(0.1, 0.1, 0.1),
    muted: rgb(0.35, 0.35, 0.35),
    line: rgb(0.85, 0.85, 0.85),
    chip: rgb(0.95, 0.95, 0.95),
  };

  const H1 = 18;
  const H2 = 12.5;
  const P = 11;
  const SM = 9.5;

  function hr() {
    cursor.y -= 8;
    page.drawLine({
      start: { x: margin, y: cursor.y },
      end: { x: width - margin, y: cursor.y },
      thickness: 1,
      color: colors.line,
    });
    cursor.y -= 12;
  }

  function drawTextLine(text: string, size: number, isBold = false, color = colors.text) {
    ensureSpace(cursor, margin + 40);
    page.drawText(text, {
      x: cursor.x,
      y: cursor.y,
      size,
      font: isBold ? bold : font,
      color,
    });
    cursor.y -= size + 6;
  }

  function drawWrapped(text: string, size = P, isBold = false, color = colors.text) {
    const lines = wrapText(text, isBold ? bold : font, size, contentWidth);
    for (const ln of lines) drawTextLine(ln, size, isBold, color);
  }

  function drawKeyValueRow(k: string, v: string) {
    const kW = 150;
    const vX = margin + kW + 10;
    const vW = width - margin - vX;

    ensureSpace(cursor, margin + 40);

    page.drawText(k, {
      x: margin,
      y: cursor.y,
      size: P,
      font: bold,
      color: colors.text,
    });

    const vLines = wrapText(v || "—", font, P, vW);
    let yy = cursor.y;

    for (const ln of vLines) {
      page.drawText(ln, {
        x: vX,
        y: yy,
        size: P,
        font,
        color: colors.text,
      });
      yy -= P + 4;
    }

    cursor.y = Math.min(cursor.y - (P + 6), yy - 2);
  }

  function drawDaysTable(days: Record<DayKey, DayPlan>) {
    const cols = [
      { label: "Dag", w: 140 },
      { label: "Aktiv", w: 60 },
      { label: "Nivå", w: 90 },
      { label: "Pris", w: contentWidth - (140 + 60 + 90) },
    ];

    const rowH = 22;
    const startY = cursor.y;

    // header bg
    page.drawRectangle({
      x: margin,
      y: startY - rowH + 6,
      width: contentWidth,
      height: rowH,
      color: colors.chip,
      borderColor: colors.line,
      borderWidth: 1,
    });

    // header text
    let x = margin;
    for (const c of cols) {
      page.drawText(c.label, {
        x: x + 6,
        y: startY - rowH + 12,
        size: SM,
        font: bold,
        color: colors.muted,
      });
      x += c.w;
    }

    cursor.y = startY - rowH - 6;

    const order: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

    for (const dk of order) {
      ensureSpace(cursor, margin + 60);

      const plan = days[dk];
      const enabled = !!plan?.enabled;

      page.drawRectangle({
        x: margin,
        y: cursor.y - rowH + 6,
        width: contentWidth,
        height: rowH,
        borderColor: colors.line,
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      const values = [
        dayLabelNO(dk),
        enabled ? "Ja" : "Nei",
        enabled ? plan.tier : "—",
        enabled ? moneyNOKExVat(plan.priceExVat) : "—",
      ];

      x = margin;
      for (let i = 0; i < cols.length; i++) {
        page.drawText(values[i], {
          x: x + 6,
          y: cursor.y - rowH + 12,
          size: P,
          font,
          color: colors.text,
        });
        x += cols[i].w;
      }

      cursor.y -= rowH;
    }

    cursor.y -= 8;
  }

  // =========================
  // HEADER
  // =========================
  drawTextLine("Avtale – Lunchportalen", H1, true);
  drawTextLine(
    `Versjon: ${s(input.terms.version) || "—"}  •  Oppdatert: ${s(input.terms.updatedAt) || "—"}`,
    SM,
    false,
    colors.muted
  );
  hr();

  // =========================
  // COMPANY
  // =========================
  drawTextLine("Firmainformasjon", H2, true);
  drawKeyValueRow("Firmanavn", s(input.companyName) || "—");
  drawKeyValueRow("Org.nr", s(input.orgnr) || "—");
  cursor.y -= 4;

  drawTextLine("Firma-admin", H2, true);
  drawKeyValueRow("Navn", s(input.adminName) || "—");
  drawKeyValueRow("E-post", s(input.adminEmail) || "—");
  drawKeyValueRow("Telefon", s(input.adminPhone) || "—");
  hr();

  // =========================
  // LOCATION + DELIVERY
  // =========================
  drawTextLine("Leveringslokasjon", H2, true);
  drawKeyValueRow("Lokasjon", s(input.locationName) || "—");
  drawKeyValueRow("Adresse", s(input.address) || "—");
  drawKeyValueRow("Poststed", `${s(input.postalCode) || "—"} ${s(input.city) || ""}`.trim());
  cursor.y -= 4;

  drawTextLine("Leveringsdetaljer", H2, true);
  drawKeyValueRow("Leveres til", s(input.delivery.where) || "—");
  drawKeyValueRow("Instruksjon", s(input.delivery.whenNote) || "—");
  drawKeyValueRow("Kontakt", s(input.delivery.contactName) || "—");
  drawKeyValueRow("Kontakt tlf", s(input.delivery.contactPhone) || "—");
  drawKeyValueRow("Vindu", `${s(input.delivery.windowFrom) || "—"}–${s(input.delivery.windowTo) || "—"}`);
  hr();

  // =========================
  // AGREEMENT DAYS
  // =========================
  drawTextLine("Avtale – dager og nivå", H2, true);
  drawWrapped("Dette styrer hvilke dager som leveres og hvilket nivå som gjelder per dag.", SM, false, colors.muted);
  cursor.y -= 6;
  drawDaysTable(input.days);
  hr();

  // =========================
  // TERMS SUMMARY
  // =========================
  drawTextLine("Vilkår (oppsummering)", H2, true);
  drawKeyValueRow("Bindingstid", `${input.terms.bindingMonths} mnd`);
  drawKeyValueRow("Oppsigelse", `${input.terms.noticeMonths} mnd`);
  drawKeyValueRow("Priser inkluderer mva", input.terms.billingPricesIncludeVat ? "Ja" : "Nei");
  drawKeyValueRow("Kredittvurdering", input.terms.creditConsent ? "Samtykket" : "Ikke samtykket");
  drawKeyValueRow("System", s(input.terms.creditCheckSystem) || "—");
  cursor.y -= 4;

  drawTextLine("Signering", H2, true);
  drawKeyValueRow("Vilkår akseptert", input.terms.accepted ? "Ja" : "Nei");
  drawKeyValueRow("Akseptert tidspunkt", safeISODateTime(input.terms.acceptedAt));
  drawKeyValueRow("Kredittsamtykke tidspunkt", safeISODateTime(input.terms.creditConsentAt));

  cursor.y -= 10;

  drawWrapped(
    "Denne PDF-en er generert automatisk ved fullføring av onboarding i Lunchportalen og lagret i systemets avtale-arkiv.",
    SM,
    false,
    colors.muted
  );

  return pdf.save();
}
