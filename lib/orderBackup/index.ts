// STATUS: KEEP

// lib/orderBackup/index.ts
import type { OrderBackupInput } from "./types";
import { upsertOutboxEvent, markOutboxFailed, markOutboxSent } from "./outbox";
import { sendBackupEmail } from "./mailer";

/**
 * Hovedfunksjon:
 * - Legger event i outbox (idempotent)
 * - Forsøker å sende mail (best effort)
 * - Oppdaterer status
 *
 * VIKTIG:
 * - Denne kalles KUN etter at DB-lagring er verifisert (riktig i Dag 2)
 */
export async function backupOrderEvent(input: OrderBackupInput) {
  await upsertOutboxEvent(input.eventKey, input);

  try {
    const sent = await sendBackupEmail(input);
    await markOutboxSent(input.eventKey, sent.messageId ?? null);
    return { ok: true as const, messageId: sent.messageId ?? null };
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? "unknown");
    await markOutboxFailed(input.eventKey, msg);
    return { ok: false as const, error: msg };
  }
}
