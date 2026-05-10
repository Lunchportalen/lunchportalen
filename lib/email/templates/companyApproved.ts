export function buildCompanyApprovedEmail(params: {
  contactName: string;
  companyName: string;
  activateUrl: string;
}): { subject: string; html: string; text: string } {
  const { contactName, companyName, activateUrl } = params;

  const subject = "Velkommen til Lunchportalen \u2013 aktiver din konto";

  const html = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#1a1714;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">

<!-- OUTER WRAPPER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background-color:#1a1714;min-height:100vh;">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <!-- CARD -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;background-color:#242019;border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.5);">

        <!-- HEADER -->
        <tr>
          <td style="background-color:#1a1714;padding:28px 40px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="font-size:20px;font-weight:800;color:#f5c842;letter-spacing:-0.02em;text-decoration:none;">
                    Lunchportalen
                  </span>
                </td>
                <td align="right">
                  <span style="font-size:12px;font-weight:600;color:rgba(245,200,66,0.5);letter-spacing:0.12em;text-transform:uppercase;">
                    Firmalunsj
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ACCENT LINE -->
        <tr>
          <td style="padding:0;">
            <div style="height:3px;background:linear-gradient(90deg,#f5c842 0%,rgba(245,200,66,0.3) 60%,transparent 100%);"></div>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:48px 40px 40px;">

            <!-- WELCOME BADGE -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td style="background-color:rgba(245,200,66,0.12);border:1px solid rgba(245,200,66,0.25);border-radius:999px;padding:8px 16px;">
                  <span style="font-size:12px;font-weight:700;color:#f5c842;letter-spacing:0.1em;text-transform:uppercase;">
                    &#10003; Avtale godkjent
                  </span>
                </td>
              </tr>
            </table>

            <!-- TITLE -->
            <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.15;letter-spacing:-0.03em;">
              Velkommen til<br>Lunchportalen
            </h1>

            <!-- INTRO -->
            <p style="margin:0 0 24px;font-size:16px;color:#c8b99a;line-height:1.65;">
              Hei ${contactName},
            </p>
            <p style="margin:0 0 32px;font-size:16px;color:#c8b99a;line-height:1.65;">
              Vi er glade for å informere deg om at avtalen for
              <strong style="color:#ffffff;font-weight:700;">${companyName}</strong>
              er godkjent og klar til å aktiveres.
            </p>
            <p style="margin:0 0 32px;font-size:16px;color:#c8b99a;line-height:1.65;">
              Klikk på knappen nedenfor for \u00e5 opprette din innlogging og komme i gang:
            </p>

            <!-- CTA BUTTON -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="margin-bottom:32px;">
              <tr>
                <td align="center">
                  <a href="${activateUrl}"
                    style="display:inline-block;background-color:#f5c842;color:#1a1714;font-size:16px;font-weight:800;text-decoration:none;padding:18px 40px;border-radius:999px;letter-spacing:-0.01em;box-shadow:0 12px 30px rgba(245,200,66,0.4);">
                    Aktiver konto
                  </a>
                </td>
              </tr>
            </table>

            <!-- INFO BOX -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="margin-bottom:32px;">
              <tr>
                <td style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="20" valign="top"
                        style="font-size:14px;color:#f5c842;padding-right:10px;padding-top:1px;">
                        &#9432;
                      </td>
                      <td>
                        <p style="margin:0 0 6px;font-size:14px;color:#c8b99a;line-height:1.55;">
                          <strong style="color:#ffffff;">Lenken er gyldig i 7 dager.</strong>
                        </p>
                        <p style="margin:0;font-size:13px;color:#6b5f4a;line-height:1.5;">
                          Dersom lenken utl\u00f8per kan du kontakte oss for \u00e5 f\u00e5 en ny.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- DIVIDER -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="margin-bottom:28px;">
              <tr>
                <td style="border-top:1px solid rgba(255,255,255,0.06);font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>

            <!-- SIGN OFF -->
            <p style="margin:0;font-size:15px;color:#c8b99a;line-height:1.6;">
              Med vennlig hilsen,<br>
              <strong style="color:#ffffff;">Lunchportalen-teamet</strong>
            </p>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:#1a1714;padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0 0 6px;font-size:13px;color:#6b5f4a;line-height:1.5;">
                    \u00a9 2026 Lunchportalen &middot; Sluppenvegen 25, 7037 Trondheim
                  </p>
                  <p style="margin:0;font-size:12px;color:rgba(107,95,74,0.6);line-height:1.5;">
                    Har du sp\u00f8rsm\u00e5l? Svar p\u00e5 denne e-posten s\u00e5 hjelper vi deg.
                  </p>
                </td>
                <td align="right" valign="middle">
                  <span style="font-size:16px;font-weight:800;color:rgba(245,200,66,0.35);letter-spacing:-0.02em;">
                    LP
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- END CARD -->

    </td>
  </tr>
</table>

</body>
</html>`;

  const text = `Velkommen til Lunchportalen – aktiver din konto

Hei ${contactName},

Vi er glade for å informere deg om at avtalen for ${companyName} er godkjent!

For å komme i gang, aktiver kontoen din her:
${activateUrl}

Lenken er gyldig i 7 dager.

Har du spørsmål? Svar på denne e-posten så hjelper vi deg.

Med vennlig hilsen,
Lunchportalen-teamet
© 2026 Lunchportalen · Sluppenvegen 25, 7037 Trondheim`;

  return { subject, html, text };
}
