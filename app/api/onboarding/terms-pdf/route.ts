// app/api/onboarding/terms-pdf/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";

type Body = {
  title?: string;
  version?: string;
  updatedAt?: string;
  bullets?: string[];
};

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    const title = safeStr(body?.title) || "Vilkår for Lunchportalen";
    const version = safeStr(body?.version) || "ukjent";
    const updatedAt = safeStr(body?.updatedAt) || "ukjent";
    const bullets = Array.isArray(body?.bullets) ? body!.bullets!.filter(Boolean) : [];

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    let y = 800;

    const draw = (text: string, size = 12, isBold = false) => {
      page.drawText(text, {
        x: margin,
        y,
        size,
        font: isBold ? bold : font,
      });
      y -= size + 8;
    };

    draw(title, 18, true);
    draw(`Versjon: ${version}`, 12, false);
    draw(`Oppdatert: ${updatedAt}`, 12, false);
    y -= 10;

    if (bullets.length) {
      draw("Hovedpunkter:", 13, true);
      for (const b of bullets) {
        const line = `• ${String(b).replace(/\r?\n/g, " ").trim()}`;
        draw(line, 11, false);
      }
    } else {
      draw("Dokumentet er generert uten punktliste (ingen bullets sendt inn).", 11, false);
    }

    const pdfBytes = await pdf.save(); // Uint8Array

    // ✅ FIKS: Buffer.from(pdfBytes) gir korrekt BodyInit i Node runtime
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="terms.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
