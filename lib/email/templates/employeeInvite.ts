import {
  EMPLOYEE_ACTIVATION_CTA_EMAIL,
  EMPLOYEE_ACTIVATION_EMAIL_HERO,
  EMPLOYEE_ACTIVATION_EXPIRY_NOTE,
  EMPLOYEE_ACTIVATION_LEAD,
  EMPLOYEE_ACTIVATION_NEXT_STEPS,
  EMPLOYEE_ACTIVATION_ROLE_LABEL,
  EMPLOYEE_ACTIVATION_SECURITY_NOTE,
  EMPLOYEE_ACTIVATION_STATUS_BADGE,
  EMPLOYEE_ACTIVATION_STATUS_LABEL,
  EMPLOYEE_ACTIVATION_SUPPORT_NOTE,
  EMPLOYEE_ACTIVATION_UNEXPECTED_NOTE,
  employeeActivationEmailSubject,
  employeeActivationHeroSubtitle,
  employeeActivationStatusSub,
} from "@/lib/onboarding/employeeActivationCopy";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function summaryRow(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:#8f7f66;letter-spacing:0.08em;text-transform:uppercase;width:38%;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:15px;color:#ffffff;font-weight:600;vertical-align:top;">${value}</td>
  </tr>`;
}

export function buildEmployeeInviteEmail(params: {
  companyName: string;
  inviteUrl: string;
  providerName?: string | null;
  locationName?: string | null;
}): { subject: string; html: string; text: string } {
  const companyName = String(params.companyName ?? "").trim();
  const inviteUrl = String(params.inviteUrl ?? "").trim();
  const providerName = String(params.providerName ?? "").trim();
  const locationName = String(params.locationName ?? "").trim();
  const subject = employeeActivationEmailSubject(companyName);
  const heroSubtitle = employeeActivationHeroSubtitle(companyName);
  const statusSub = employeeActivationStatusSub(companyName);

  const summaryRows = [
    companyName ? summaryRow("Bedrift", escapeHtml(companyName)) : "",
    summaryRow("Rolle", escapeHtml(EMPLOYEE_ACTIVATION_ROLE_LABEL)),
    providerName ? summaryRow("Leverandør", escapeHtml(providerName)) : "",
    locationName ? summaryRow("Lokasjon", escapeHtml(locationName)) : "",
    summaryRow("Neste steg", "Opprett konto"),
  ]
    .filter(Boolean)
    .join("");

  const nextStepsHtml = EMPLOYEE_ACTIVATION_NEXT_STEPS.map(
    (step, index) =>
      `<tr>
        <td width="28" valign="top" style="padding:0 0 14px;font-size:14px;color:#f5c842;font-weight:800;">${index + 1}.</td>
        <td valign="top" style="padding:0 0 14px;font-size:15px;color:#d8c8a8;line-height:1.55;">${escapeHtml(step)}</td>
      </tr>`,
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#1a1714;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1714;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background-color:#242019;border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.5);">
        <tr>
          <td style="background-color:#1a1714;padding:28px 36px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><span style="font-size:20px;font-weight:800;color:#f5c842;letter-spacing:-0.02em;">Lunchportalen</span></td>
                <td align="right"><span style="font-size:12px;font-weight:600;color:rgba(245,200,66,0.5);letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(EMPLOYEE_ACTIVATION_STATUS_LABEL)}</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,#f5c842 0%,rgba(245,200,66,0.3) 60%,transparent 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:34px 36px 12px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:rgba(245,200,66,0.08);border:1px solid rgba(245,200,66,0.18);border-radius:14px;">
              <tr>
                <td style="padding:16px 18px;">
                  <span style="display:inline-block;font-size:11px;font-weight:800;color:#f5c842;letter-spacing:0.12em;text-transform:uppercase;">&#10003; ${escapeHtml(EMPLOYEE_ACTIVATION_STATUS_BADGE)}</span>
                  <span style="display:inline-block;margin-left:12px;font-size:13px;color:#c8b99a;">${escapeHtml(statusSub)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 36px 0;">
            <h1 style="margin:0 0 14px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.15;letter-spacing:-0.03em;">${escapeHtml(EMPLOYEE_ACTIVATION_EMAIL_HERO)}</h1>
            <p style="margin:0 0 10px;font-size:16px;color:#ffffff;line-height:1.55;font-weight:600;">${escapeHtml(heroSubtitle)}</p>
            <p style="margin:0 0 28px;font-size:16px;color:#c8b99a;line-height:1.65;">${escapeHtml(EMPLOYEE_ACTIVATION_LEAD)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;">
              <tr><td style="padding:18px 20px 8px;font-size:12px;font-weight:700;color:#f5c842;letter-spacing:0.1em;text-transform:uppercase;">Oppsummering</td></tr>
              <tr><td style="padding:0 20px 18px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${summaryRows}</table></td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 36px 10px;">
            <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background-color:#f5c842;color:#1a1714;font-size:16px;font-weight:800;text-decoration:none;padding:18px 36px;border-radius:999px;letter-spacing:-0.01em;box-shadow:0 12px 30px rgba(245,200,66,0.35);">${escapeHtml(EMPLOYEE_ACTIVATION_CTA_EMAIL)}</a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 36px 28px;font-size:13px;color:#8f7f66;line-height:1.5;">${escapeHtml(EMPLOYEE_ACTIVATION_SECURITY_NOTE)}</td>
        </tr>
        <tr>
          <td style="padding:0 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;">
              <tr><td style="padding:18px 20px 8px;font-size:12px;font-weight:700;color:#f5c842;letter-spacing:0.1em;text-transform:uppercase;">Dette skjer videre</td></tr>
              <tr><td style="padding:0 20px 18px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${nextStepsHtml}</table></td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0 0 8px;font-size:14px;color:#ffffff;line-height:1.55;"><strong>${escapeHtml(EMPLOYEE_ACTIVATION_EXPIRY_NOTE.split(".")[0])}.</strong></p>
                  <p style="margin:0;font-size:13px;color:#8f7f66;line-height:1.5;">Hvis lenken er utløpt, kan administrator sende deg en ny invitasjon.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 30px;font-size:14px;color:#c8b99a;line-height:1.6;">${escapeHtml(EMPLOYEE_ACTIVATION_UNEXPECTED_NOTE)}</td>
        </tr>
        <tr>
          <td style="background-color:#1a1714;padding:24px 36px;border-top:1px solid rgba(255,255,255,0.06);">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0 0 6px;font-size:13px;color:#8f7f66;line-height:1.5;">Lunchportalen · Sluppenvegen 25, 7037 Trondheim</p>
                  <p style="margin:0 0 6px;font-size:12px;color:rgba(143,127,102,0.75);line-height:1.5;">Systemmail · ansattinvitasjon</p>
                  <p style="margin:0;font-size:12px;color:rgba(143,127,102,0.75);line-height:1.5;">${escapeHtml(EMPLOYEE_ACTIVATION_SUPPORT_NOTE)}</p>
                </td>
                <td align="right" valign="middle"><span style="font-size:16px;font-weight:800;color:rgba(245,200,66,0.35);letter-spacing:-0.02em;">LP</span></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = `${EMPLOYEE_ACTIVATION_EMAIL_HERO}

${EMPLOYEE_ACTIVATION_STATUS_BADGE} · ${statusSub}

${heroSubtitle}

${EMPLOYEE_ACTIVATION_LEAD}

${companyName ? `Bedrift: ${companyName}\n` : ""}Rolle: ${EMPLOYEE_ACTIVATION_ROLE_LABEL}
${providerName ? `Leverandør: ${providerName}\n` : ""}${locationName ? `Lokasjon: ${locationName}\n` : ""}Neste steg: Opprett konto

${EMPLOYEE_ACTIVATION_CTA_EMAIL}:
${inviteUrl}

${EMPLOYEE_ACTIVATION_SECURITY_NOTE}

Dette skjer videre:
1. ${EMPLOYEE_ACTIVATION_NEXT_STEPS[0]}
2. ${EMPLOYEE_ACTIVATION_NEXT_STEPS[1]}
3. ${EMPLOYEE_ACTIVATION_NEXT_STEPS[2]}

${EMPLOYEE_ACTIVATION_EXPIRY_NOTE}

${EMPLOYEE_ACTIVATION_UNEXPECTED_NOTE}

${EMPLOYEE_ACTIVATION_SUPPORT_NOTE}

Lunchportalen · Sluppenvegen 25, 7037 Trondheim
Systemmail · ansattinvitasjon`;

  return { subject, html, text };
}
