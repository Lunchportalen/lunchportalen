// lib/esg/pdf-technical.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { signatureLines, type EsgSignature } from "@/lib/esg/pdf-signature";

export type BuildTechnicalPdfInput = {
  companyName?: string | null;
  companyId?: string | null;
  year: number;
  generatedAtISO: string;
  computedVersion?: string;

  // slik at appendix kan referere til faktiske tall (valgfritt)
  orderedCount?: number | null;
  cancelledInTimeCount?: number | null;
  wasteMeals?: number | null;
  wasteKg?: number | null;
  wasteCo2eKg?: number | null;

  // (valgfritt) hvis dere har locking/hash i 8A
  lockedAt?: string | null;
  lockHash?: string | null;
  lockVersion?: string | null;
};

function safeText(v: any) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function fmtNum(n: any, digits = 0) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: digits }).format(v);
}

export async function buildTechnicalAppendixPdf(input: BuildTechnicalPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Optional metadata
  try {
    pdf.setTitle("Technical & Security Appendix – ESG");
    pdf.setSubject(`ESG – Datagrunnlag og beregninger (År ${input.year})`);
    pdf.setCreator("Lunchportalen");
    pdf.setProducer("Lunchportalen");
  } catch {
    // ignore
  }

  const A4: [number, number] = [595.28, 841.89];
  const margin = 48;

  const addPage = (pageNo: number, totalPagesHint = 2) => {
    const p = pdf.addPage(A4);
    const { width, height } = p.getSize();
    let y = height - margin;

    const ensure = (needed: number) => {
      if (y - needed >= margin + 40) return;
      // Fixed-length appendix (2 pages). If it grows later, we can expand to more pages.
      y = margin + 40 + needed;
    };

    const text = (t: string, size = 11, isBold = false, x = margin) => {
      ensure(size + 8);
      p.drawText(safeText(t), { x, y, size, font: isBold ? bold : font });
      y -= size + 6;
    };

    const line = (gap = 10) => {
      y -= gap;
      p.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 1,
        color: rgb(0, 0, 0),
        opacity: 0.15,
      });
      y -= gap;
    };

    const footer = () => {
      p.drawText(`Side ${pageNo}/${totalPagesHint}`, { x: width - margin - 60, y: margin - 10, size: 9, font });
    };

    return { p, width, text, line, footer };
  };

  const company =
    safeText(input.companyName || "") || (input.companyId ? `Firma-ID: ${safeText(input.companyId)}` : "Firma");

  const signature: EsgSignature = {
    lockedAt: input.lockedAt ?? null,
    lockHash: input.lockHash ?? null,
    lockVersion: input.lockVersion ?? null,
  };

  // =========================
  // Page 1
  // =========================
  {
    const { text, line, footer } = addPage(1, 2);

    text("Technical & Security Appendix", 18, true);
    text(`ESG – Datagrunnlag og beregninger (År ${input.year})`, 12, true);
    text(company, 10, false);
    text(`Generert: ${new Date(input.generatedAtISO).toLocaleString("nb-NO")}`, 9, false);
    if (input.computedVersion) text(`Snapshot-versjon: ${safeText(input.computedVersion)}`, 9, false);

    // ESG-signatur (status + hash hvis låst)
    const sigLines = signatureLines({
      productName: "Lunchportalen",
      signature,
      generatedAtISO: input.generatedAtISO,
    });
    for (const l of sigLines) text(l, 9, false);

    line(8);

    text("1. Datakilder", 12, true);
    text("• orders: bestillinger, status, dato (Oslo), created_at/updated_at", 10, false);
    text("• esg_daily: daglige facts (idempotent upsert)", 10, false);
    text("• esg_monthly_snapshots / esg_yearly_snapshots: rapportgrunnlag (snapshot)", 10, false);

    line(6);

    text("2. Definisjoner", 12, true);
    text("• Cut-off: kl. 08:00 Europe/Oslo (servervalidering, DST-korrekt).", 10, false);
    text("• Avbestilt i tide: CANCELLED med statusendring <= cut-off.", 10, false);
    text("• Sen avbestilling: CANCELLED med statusendring > cut-off (hvis relevant).", 10, false);
    text("• No-show: NO_SHOW (hvis brukt) – regnes som svinn iht. faktor.", 10, false);

    line(6);

    text("3. Beregninger (faste regler)", 12, true);
    text("• waste_meals = round(cancelled_late * late_cancel_waste_ratio + no_show * no_show_waste_ratio)", 10, false);
    text("• waste_kg = waste_meals * meal_kg", 10, false);
    text("• waste_co2e_kg = waste_kg * co2e_per_kg_food", 10, false);
    text("• cost_saved_nok = cancelled_in_time * meal_price_nok", 10, false);
    text("• cost_waste_nok = waste_meals * meal_price_nok", 10, false);

    line(6);

    text("4. Dataintegritet (kort)", 12, true);
    text("• Beregninger kjøres som DB-funksjoner (RPC) for konsistente regler og tidsone-håndtering.", 10, false);
    text("• Snapshots kan låses (immutable) og signeres med SHA-256 hash.", 10, false);

    footer();
  }

  // =========================
  // Page 2
  // =========================
  {
    const { text, line, footer } = addPage(2, 2);

    text("5. Faktorer og versjonering", 12, true);
    text("• Faktorer lagres i esg_factors (meal_kg, co2e_per_kg_food, ratios).", 10, false);
    text("• Snapshots har computed_version og computed_at for revisjon.", 10, false);
    text("• Endringer i beregningsmodell skjer ved ny computed_version (ikke ved å endre låste rader).", 10, false);

    line(6);

    text("6. Tilgang og sikkerhet", 12, true);
    text("• Ansatte: ingen tilgang til ESG-tabeller.", 10, false);
    text("• Firma-admin: kun eget company_id (RLS).", 10, false);
    text("• Superadmin: full tilgang (RLS).", 10, false);
    text("• Skriving: kun service role/cron – ingen klient-write policies.", 10, false);

    line(6);

    text("7. Integritet og idempotens", 12, true);
    text("• esg_build_daily(date): UPSERT på (company_id, location_id, date, slot).", 10, false);
    text("• esg_build_monthly(month): UPSERT på (company_id, location_id, month).", 10, false);
    text("• esg_build_yearly(year): UPSERT på (company_id, location_id, year).", 10, false);

    line(6);

    text("8. Språklig oppsummering", 12, true);
    text("• Executive Overview inneholder en deterministisk oppsummering generert direkte fra snapshot-tall.", 10, false);
    text("• Ingen anbefalinger eller automatiske beslutninger – kun tallbasert tekst.", 10, false);

    line(6);

    text("9. Tall (valgfritt utsnitt)", 12, true);
    text("• (Dersom tall injiseres) Utsnittet under er hentet direkte fra årssnapshot:", 10, false);

    const oc = input.orderedCount ?? null;
    if (!oc) {
      text("• Ingen tall injisert i appendix (valgfritt).", 10, false);
    } else {
      text(`• Bestillinger: ${fmtNum(oc)}`, 10, false);
      text(`• Avbestilt i tide: ${fmtNum(input.cancelledInTimeCount ?? 0)}`, 10, false);
      text(`• Svinn (målt i kuverter): ${fmtNum(input.wasteMeals ?? 0)}`, 10, false);
      text(`• Svinn (kg): ${fmtNum(input.wasteKg ?? 0, 1)}`, 10, false);
      text(`• CO₂e (kg): ${fmtNum(input.wasteCo2eKg ?? 0, 1)}`, 10, false);
    }

    line(8);

    text("10. ESG-signatur (referanse)", 12, true);
    text("• Dersom snapshot er låst: SHA-256 hash kan brukes til verifikasjon mot database.", 10, false);
    text("• Dersom ikke låst: rapporten viser status «Ikke låst» og har ingen hash.", 10, false);

    footer();
  }

  return await pdf.save();
}
