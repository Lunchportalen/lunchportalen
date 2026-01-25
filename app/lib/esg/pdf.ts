// lib/esg/pdf.ts
import { PDFDocument, StandardFonts, type PDFPage, rgb } from "pdf-lib";
import { buildEsgNarrativeYear } from "@/lib/esg/narrative";
import { signatureLines, type EsgSignature } from "@/lib/esg/pdf-signature";

export type EsgMonthRow = {
  month: string; // YYYY-MM-01
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

export type EsgYearRow = {
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
  computed_at?: string | null;
  computed_version?: string | null;
};

export type BuildEsgPdfInput = {
  title: string; // "ESG-rapport"
  companyName?: string | null;
  companyId?: string | null;

  periodLabel: string; // "År 2026" / "Januar 2026"
  year?: number;

  yearly: EsgYearRow | null;
  months: EsgMonthRow[];

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
function fmtMonthLabel(isoMonth01: string) {
  try {
    const d = new Date(isoMonth01 + "T00:00:00Z");
    return d.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
  } catch {
    return isoMonth01;
  }
}
function safeText(v: any) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

/* =========================
   PDF layout helpers
========================= */
const A4: [number, number] = [595.28, 841.89];

type Ctx = {
  pdf: PDFDocument;
  page: PDFPage;
  width: number;
  height: number;
  margin: number;
  y: number;
  font: any;
  fontBold: any;
  pageNo: number;
};

function newPage(ctx: Omit<Ctx, "page" | "width" | "height" | "y" | "pageNo"> & { pageNo: number }): Ctx {
  const page = ctx.pdf.addPage(A4);
  const { width, height } = page.getSize();
  return { ...ctx, page, width, height, y: height - ctx.margin, pageNo: ctx.pageNo };
}

function ensureSpace(ctx: Ctx, needed: number): Ctx {
  if (ctx.y - needed >= ctx.margin + 40) return ctx;
  return newPage({ ...ctx, pageNo: ctx.pageNo + 1 });
}

function drawText(ctx: Ctx, text: string, size = 11, bold = false, x?: number): Ctx {
  const xx = x ?? ctx.margin;
  const t = safeText(text);
  ctx.page.drawText(t, { x: xx, y: ctx.y, size, font: bold ? ctx.fontBold : ctx.font });
  return { ...ctx, y: ctx.y - (size + 6) };
}

function drawHR(ctx: Ctx, gap = 10): Ctx {
  let next = { ...ctx, y: ctx.y - gap };
  next.page.drawLine({
    start: { x: next.margin, y: next.y },
    end: { x: next.width - next.margin, y: next.y },
    thickness: 1,
    color: rgb(0, 0, 0),
    opacity: 0.15,
  });
  next = { ...next, y: next.y - gap };
  return next;
}

function drawBulletLines(ctx: Ctx, title: string, lines: string[], size = 10): Ctx {
  let next = ensureSpace(ctx, 60);
  next = drawText(next, title, 13, true);
  for (const line of lines) {
    next = ensureSpace(next, 16);
    next = drawText(next, `• ${line}`, size, false);
  }
  return next;
}

/* =========================
   Public API
========================= */
export async function buildEsgPdf(input: BuildEsgPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Optional PDF metadata (useful for archiving)
  try {
    pdf.setTitle(safeText(input.title));
    pdf.setSubject(`ESG report ${safeText(input.periodLabel)}`);
    pdf.setCreator("Lunchportalen");
    pdf.setProducer("Lunchportalen");
  } catch {
    // ignore
  }

  const base = { pdf, margin: 48, font, fontBold };

  let ctx: Ctx = newPage({ ...base, pageNo: 1 });

  // Header
  ctx = drawText(ctx, input.title, 20, true);
  ctx = drawText(ctx, input.periodLabel, 12, true);
  ctx = { ...ctx, y: ctx.y - 4 };

  const metaLeft = [
    input.companyName ? `Firma: ${safeText(input.companyName)}` : input.companyId ? `Firma-ID: ${safeText(input.companyId)}` : null,
    `Generert: ${new Date(input.generatedAtISO).toLocaleString("nb-NO")}`,
    input.computedVersion ? `Snapshot-versjon: ${safeText(input.computedVersion)}` : null,
  ].filter(Boolean) as string[];

  for (const t of metaLeft) ctx = drawText(ctx, t, 10, false);
  ctx = drawHR(ctx, 8);

  // Summary (yearly)
  if (input.yearly) {
    const yr = input.yearly;
    const wasteRate = yr.ordered_count > 0 ? yr.waste_meals / yr.ordered_count : null;

    ctx = drawText(ctx, "Oppsummering", 13, true);
    ctx = drawText(
      ctx,
      `Bestillinger: ${fmtNum(yr.ordered_count)}  ·  Avbestilt i tide: ${fmtNum(yr.cancelled_in_time_count)}`,
      11,
      false
    );
    ctx = drawText(
      ctx,
      `Spart: ${fmtNok(yr.cost_saved_nok)}  ·  Svinn: ${fmtKg(yr.waste_kg)}  ·  CO₂e: ${fmtCo2e(yr.waste_co2e_kg)}`,
      11,
      false
    );
    ctx = drawText(
      ctx,
      `Svinnkost: ${fmtNok(yr.cost_waste_nok)}  ·  Netto: ${fmtNok(yr.cost_net_nok)}  ·  Stabilitet: ${yr.stability_score ?? "—"}` +
        (wasteRate === null ? "" : `  ·  Svinnrate: ${fmtNum(wasteRate * 100, 1)} %`),
      11,
      false
    );

    ctx = drawHR(ctx, 8);

    // Narrative (deterministisk)
    const narrative = buildEsgNarrativeYear({ current: yr, previous: null, year: yr.year });
    ctx = drawBulletLines(ctx, "ESG-oppsummering (faktabasert)", narrative.lines, 10);

    ctx = drawHR(ctx, 8);
  } else {
    ctx = drawText(ctx, "Oppsummering", 13, true);
    ctx = drawText(ctx, "Ingen årssnapshot funnet for valgt periode. (Kjør yearly-cron for året.)", 11, false);
    ctx = drawHR(ctx, 8);
  }

  // Months table title
  ctx = ensureSpace(ctx, 120);
  ctx = drawText(ctx, "Måned for måned (siste 12)", 13, true);

  const colX = {
    month: ctx.margin,
    ordered: ctx.margin + 170,
    saved: ctx.margin + 260,
    wasteKg: ctx.margin + 360,
    co2e: ctx.margin + 450,
    score: ctx.width - ctx.margin - 30,
  };

  // Header row
  ctx = ensureSpace(ctx, 24);
  const headerY = ctx.y;
  ctx.page.drawText("Måned", { x: colX.month, y: headerY, size: 10, font: ctx.fontBold });
  ctx.page.drawText("Best.", { x: colX.ordered, y: headerY, size: 10, font: ctx.fontBold });
  ctx.page.drawText("Spart", { x: colX.saved, y: headerY, size: 10, font: ctx.fontBold });
  ctx.page.drawText("Svinn kg", { x: colX.wasteKg, y: headerY, size: 10, font: ctx.fontBold });
  ctx.page.drawText("CO₂e", { x: colX.co2e, y: headerY, size: 10, font: ctx.fontBold });
  ctx.page.drawText("S", { x: colX.score, y: headerY, size: 10, font: ctx.fontBold });
  ctx = { ...ctx, y: ctx.y - 16 };

  // Rows
  for (const r of input.months ?? []) {
    ctx = ensureSpace(ctx, 18);
    ctx.page.drawText(fmtMonthLabel(r.month), { x: colX.month, y: ctx.y, size: 10, font: ctx.font });
    ctx.page.drawText(fmtNum(r.ordered_count), { x: colX.ordered, y: ctx.y, size: 10, font: ctx.font });
    ctx.page.drawText(fmtNok(r.cost_saved_nok), { x: colX.saved, y: ctx.y, size: 10, font: ctx.font });
    ctx.page.drawText(fmtKg(r.waste_kg), { x: colX.wasteKg, y: ctx.y, size: 10, font: ctx.font });
    ctx.page.drawText(fmtCo2e(r.waste_co2e_kg), { x: colX.co2e, y: ctx.y, size: 10, font: ctx.font });
    ctx.page.drawText((r.stability_score ?? "—").toString(), { x: colX.score, y: ctx.y, size: 10, font: ctx.fontBold });
    ctx = { ...ctx, y: ctx.y - 14 };
  }

  ctx = drawHR(ctx, 10);

  // Audit
  ctx = drawText(ctx, "Datagrunnlag og revisjon", 12, true);
  ctx = drawText(ctx, "• Grunnlag: esg_daily → esg_monthly_snapshots / esg_yearly_snapshots (snapshot-basert)", 10, false);
  ctx = drawText(ctx, "• Kilder: orders (bestilt/avbestilt/no-show), cut-off 08:00 Europe/Oslo (server), faste faktorer", 10, false);
  ctx = drawText(ctx, "• Rapporten inneholder tall og faktabasert oppsummering. Ingen automatiske beslutninger.", 10, false);

  ctx = drawHR(ctx, 8);

  // ESG-signatur (basert på locked snapshot hvis tilgjengelig)
  const sig = signatureLines({
    productName: "Lunchportalen",
    signature: input.signature ?? undefined,
    generatedAtISO: input.generatedAtISO,
  });
  ctx = drawBulletLines(ctx, "ESG-signatur", sig, 10);

  // Page numbering
  const pages = pdf.getPages();
  const total = pages.length;
  for (let i = 0; i < total; i++) {
    const p = pages[i];
    p.drawText(`Side ${i + 1}/${total}`, { x: A4[0] - 48 - 60, y: 48 - 10, size: 9, font });
  }

  return await pdf.save();
}
