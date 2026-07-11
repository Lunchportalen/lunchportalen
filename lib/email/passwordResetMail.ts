import { passwordResetCopy } from "@/lib/email/i18n/emailCopy";
import type { AppLocale } from "@/lib/i18n/middlewareLocale";

/** Fase E5: locale-aware (default nb; unknown values fall back to nb). */
export function buildPasswordResetEmail(
  link: string,
  locale?: AppLocale | string | null,
): { subject: string; text: string } {
  const copy = passwordResetCopy(locale);
  const text =
    `${copy.greeting}\n` +
    `${copy.intro}\n\n` +
    `${copy.linkLead}\n` +
    `${link}\n\n` +
    `${copy.validityNote}\n\n` +
    copy.signoff;

  return { subject: copy.subject, text };
}
