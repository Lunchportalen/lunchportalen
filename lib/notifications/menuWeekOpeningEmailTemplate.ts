/**
 * Branded HTML e-post for uke-åpning (designsystem: varm krem, gull CTA, grønn accent).
 */

const CREAM = "#faf8f4";
const GOLD = "#f5c518";
const GREEN = "#1f7a4c";
const TEXT = "#1a1a1a";
const TEXT_SOFT = "#5c5c5c";

export function buildMenuWeekOpeningEmail(params: {
  weekRangeLabel: string;
  menuTitle: string;
  weekUrl: string;
  logoUrl: string;
}): { subject: string; text: string; html: string } {
  const menuTitle = params.menuTitle.trim() || "Nye lunchvalg";
  const subject = `Menyen for ${params.weekRangeLabel} er klar — bestill uka`;

  const text = [
    `Hei!`,
    ``,
    `Menyen for ${params.weekRangeLabel} er nå åpen.`,
    `Høydepunkt: ${menuTitle}`,
    ``,
    `Bestill uka: ${params.weekUrl}`,
    ``,
    `Lunchportalen`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="no">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CREAM};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e8e4dc;">
          <tr>
            <td style="padding:28px 28px 12px;text-align:center;">
              <img src="${params.logoUrl}" alt="Lunchportalen" width="160" style="max-width:160px;height:auto;display:block;margin:0 auto 20px;" />
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${GREEN};letter-spacing:0.04em;text-transform:uppercase;">Uke åpnet</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:${TEXT};">Menyen for ${params.weekRangeLabel}</h1>
              <p style="margin:0;font-size:16px;line-height:1.5;color:${TEXT_SOFT};">Du kan nå bestille lunch for den nye uken.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 20px;">
              <div style="padding:16px 18px;border-radius:12px;background:${CREAM};border:1px solid #ece8e0;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${TEXT_SOFT};">Høydepunkt denne uken</p>
                <p style="margin:0;font-size:18px;font-weight:600;color:${TEXT};">${menuTitle}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 32px;text-align:center;">
              <a href="${params.weekUrl}" style="display:inline-block;min-height:44px;padding:14px 28px;border-radius:999px;background:${GOLD};color:${TEXT};font-size:16px;font-weight:700;text-decoration:none;line-height:1.2;">Bestill uka</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${TEXT_SOFT};">Du kan slå av disse e-postene under «Varsler» på ukesiden.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
