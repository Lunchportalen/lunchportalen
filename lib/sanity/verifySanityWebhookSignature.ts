import "server-only";

import { isValidSignature, SIGNATURE_HEADER_NAME } from "@sanity/webhook";

export const SANITY_WEBHOOK_SIGNATURE_HEADER = SIGNATURE_HEADER_NAME;

/** Verifies Sanity document-webhook signature over the raw UTF-8 body string. */
export async function verifySanityWebhookSignature(opts: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
}): Promise<boolean> {
  const sig = String(opts.signatureHeader ?? "").trim();
  if (!sig) return false;
  const secret = String(opts.secret ?? "").trim();
  if (!secret) return false;
  return isValidSignature(opts.rawBody, sig, secret);
}
