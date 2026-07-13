// app/api/onboarding/terms-pdf/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { jsonErr, makeRid } from "@/lib/http/respond";
import { rateLimit } from "@/lib/security/rateLimit";

type Body = {
  title?: string;
  version?: string;
  updatedAt?: string;
  bullets?: string[];
};

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function clientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const rid = makeRid();
  try {
    // Public onboarding endpoint: per-IP rate limit + strict input caps so the
    // PDF generator cannot be used as an anonymous CPU/content injection target.
    if (!rateLimit(`onboarding:terms-pdf:${clientIp(req)}`, 10)) {
      return jsonErr(rid, "For mange forespørsler. Prøv igjen om litt.", 429, "RATE_LIMITED");
    }

    const body = (await req.json().catch(() => null)) as Body | null;

    const title = (safeStr(body?.title) || "Vilkår for Lunchportalen").slice(0, 120);
    const version = (safeStr(body?.version) || "ukjent").slice(0, 40);
    const updatedAt = (safeStr(body?.updatedAt) || "ukjent").slice(0, 40);
    const bullets = (Array.isArray(body?.bullets) ? body!.bullets!.filter(Boolean) : [])
      .slice(0, 30)
      .map((b) => String(b).slice(0, 300));

    const { PDFDocument, StandardFonts } = await import("pdf-lib");
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
        "x-lp-rid": rid,
      },
    });
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke generere PDF.", 500, { code: "SERVER_ERROR", detail: String(e?.message ?? e) });
  }
}
