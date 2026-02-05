// lib/esg/pdf-executive.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildEsgNarrativeYear } from "@/lib/esg/narrative";
import { signatureLines, type EsgSignature } from "@/lib/esg/pdf-signature";
import { formatDateTimeNO, formatMonthYearShortNO } from "@/lib/date/format";

type MonthRow = {
  month: string;
  ordered_count: number;
  cancelled_in_time_count: number;
  waste_meals: number;
  waste_kg: number;
  waste_co2e_kg: number;
  cost_saved_nok: number;
  cost_waste_nok: number;
  cost_net_nok: number;
  stability_score: string | null;
};

type YearRow = {
  year: number;
  ordered_count: number;
  cancelled_in_time_count: number;
  waste_meals: number;
  waste_kg: number;
  waste_co2e_kg: number;
  cost_saved_nok: number;
  cost_waste_nok: number;
  cost_net_nok: number;
  stability_score: string | null;
  computed_version?: string | null;
};

export type BuildExecutivePdfInput = {
  companyName?: string | null;
  companyId?: string | null;

  year: number;
  yearly: YearRow | null;
  months: MonthRow[];

  generatedAtISO: string;
  computedVersion?: string; // v1

  // ESG-signatur (fra locked snapshot, hvis tilgjengelig)
  signature?: EsgSignature | null;
};

/* =========================
   Formatting helpers
========================= */
function fmtNok(n: any) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(v);
}
function fmtNum(n: any, digits = 0) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: digits }).format(v);
}
function fmtKg(n: any) {
  return `${fmtNum(n, 1)} kg`;
}
function fmtCo2e(n: any) {
  return `${fmtNum(n, 1)} kg CO₂e`;
}
function safeText(v: any) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}
function safeName(s: string) {
  return safeText(s);
}
function fmtMonthShort(isoMonth01: string) {
  return formatMonthYearShortNO(isoMonth01);
}

/* =========================
   PDF builder
========================= */
export async function buildExecutiveOnePagerPdf(input: BuildExecutivePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Optional metadata
  try {
    pdf.setTitle("Executive Overview – ESG");
    pdf.setSubject(`ESG – Matsvinn & økonomi (År ${input.year})`);
    pdf.setCreator("Lunchportalen");
    pdf.setProducer("Lunchportalen");
  } catch {
    // ignore
  }

  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 48;

  let y = height - margin;

  const ensure = (needed: number) => {
    // One pager: keep everything on one page (best-effort)
    if (y - needed < margin + 40) y = margin + 40 + needed;
  };

  const text = (t: string, size = 11, isBold = false, x = margin) => {
    ensure(size + 8);
    page.drawText(safeText(t), { x, y, size, font: isBold ? bold : font });
    y -= size + 6;
  };

  const line = (gap = 10) => {
    y -= gap;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0, 0, 0),
      opacity: 0.15,
    });
    y -= gap;
  };

  const company =
    safeName(input.companyName || "") || (input.companyId ? `Firma-ID: ${safeText(input.companyId)}` : "Firma");

  // Header
  text("Executive Overview", 18, true);
  text(`ESG – Matsvinn & økonomi (År ${input.year})`, 12, true);
  text(company, 10, false);
  text(`Generert: ${formatDateTimeNO(input.generatedAtISO)}`, 9, false);
  if (input.computedVersion) text(`Snapshot-versjon: ${safeText(input.computedVersion)}`, 9, false);

  line(8);

  const yr = input.yearly;

  // Hero metrics
  text("Nøkkeltall", 13, true);

  if (!yr) {
    text("Ingen årssnapshot funnet for valgt år. Kjør yearly-cron for å bygge årstall.", 11, false);
    line(8);
  } else {
    const wasteRate = yr.ordered_count > 0 ? yr.waste_meals / yr.ordered_count : null;

    // 3 “hero”-linjer, uten bokser
    text(`• Spart kostnad via avbestilling i tide: ${fmtNok(yr.cost_saved_nok)}`, 12, true);
    text(`• Dokumentert matsvinn: ${fmtKg(yr.waste_kg)}  (${fmtCo2e(yr.waste_co2e_kg)})`, 12, true);
    text(
      `• Stabilitet: ${yr.stability_score ?? "—"}${wasteRate === null ? "" : `  ·  Svinnrate: ${fmtNum(wasteRate * 100, 1)} %`}`,
      12,
      true
    );

    y -= 6;
    text(
      `Faktagrunnlag: ${fmtNum(yr.ordered_count)} bestillinger · ${fmtNum(yr.cancelled_in_time_count)} avbestilt i tide · Svinnkost: ${fmtNok(
        yr.cost_waste_nok
      )}`,
      10,
      false
    );

    line(8);

    // ESG Narrative (deterministisk, tallbasert)
    text("ESG-oppsummering", 12, true);
    const narrative = buildEsgNarrativeYear({ current: yr, previous: null, year: input.year });
    for (const lineText of narrative.lines) text(`• ${lineText}`, 10, false);

    line(8);
  }

  // Trend (last 6 months)
  text("Trend (siste 6 måneder)", 13, true);

  const last6 = (input.months || []).slice(-6);
  if (last6.length === 0) {
    text("Ingen månedssnapshots tilgjengelig ennå.", 11, false);
  } else {
    const col = {
      m: margin,
      saved: margin + 220,
      waste: margin + 340,
      score: width - margin - 30,
    };

    page.drawText("Måned", { x: col.m, y, size: 10, font: bold });
    page.drawText("Spart", { x: col.saved, y, size: 10, font: bold });
    page.drawText("Svinn kg", { x: col.waste, y, size: 10, font: bold });
    page.drawText("S", { x: col.score, y, size: 10, font: bold });
    y -= 16;

    for (const r of last6) {
      ensure(16);

      page.drawText(fmtMonthShort(r.month), { x: col.m, y, size: 10, font });
      page.drawText(fmtNok(r.cost_saved_nok), { x: col.saved, y, size: 10, font });
      page.drawText(fmtKg(r.waste_kg), { x: col.waste, y, size: 10, font });
      page.drawText((r.stability_score ?? "—").toString(), { x: col.score, y, size: 10, font: bold });

      y -= 14;
    }
  }

  line(10);

  // Datagrunnlag (tørt)
  text("Datagrunnlag", 12, true);
  text("• Snapshot-basert fra esg_daily → esg_monthly_snapshots / esg_yearly_snapshots.", 10, false);
  text("• Tall og tekst er deterministisk generert fra faktiske bestillinger/avbestillinger (cut-off 08:00 Europe/Oslo).", 10, false);

  // ESG-signatur
  const sigLines = signatureLines({
    productName: "Lunchportalen",
    signature: input.signature ?? undefined,
    generatedAtISO: input.generatedAtISO,
  });

  text("ESG-signatur", 12, true);
  for (const l of sigLines) text(`• ${l}`, 10, false);

  // Footer
  page.drawText("Side 1/1", { x: width - margin - 60, y: margin - 10, size: 9, font });

  return await pdf.save();
}
