// lib/orderBackup/types.ts

/**
 * Hvilken type hendelse som trigget backup.
 * Brukes til idempotens, filtrering og senere rapportering.
 */
export type OrderBackupEventType =
  | "ORDER_PLACED"
  | "ORDER_CANCELLED"
  | "CHOICE_SET";

/**
 * Felles payload for order-backup (outbox).
 *
 * Denne typen er:
 * - stabil (kan lagres som jsonb)
 * - bakoverkompatibel
 * - utvidbar uten migrering
 */
export type OrderBackupInput = {
  /* =========================
     Event-identitet
  ========================= */

  eventType: OrderBackupEventType;

  /**
   * Global request-id (samme rid som resten av requesten)
   */
  rid: string;

  /**
   * Idempotency key (unik per hendelse)
   * Eks:
   * - ORDER_PLACED:<orderId>
   * - ORDER_CANCELLED:<orderId>
   * - CHOICE_SET:<userId>:<date>
   */
  eventKey: string;

  /* =========================
     Aktør
  ========================= */

  userId: string;
  userEmail: string | null;

  /* =========================
     Kontekst
  ========================= */

  companyId: string;
  locationId: string;

  /**
   * Leveringsdato (ISO)
   * Format: YYYY-MM-DD
   */
  date: string;

  /**
   * For ordre:
   * - ACTIVE
   * - CANCELLED
   *
   * For choice-set kan dette være f.eks:
   * - SET
   */
  status: string;

  /**
   * Valg-nøkkel (brukes av CHOICE_SET)
   * Eksempel: "wants_lunch"
   */
  choiceKey?: string | null;

  /**
   * Order-id hvis relevant.
   * Kan være null ved enkelte hendelser.
   */
  orderId?: string | null;

  /**
   * Server-timestamp (ISO8601)
   * Settes når eventet enqueues i outbox.
   */
  timestampISO: string;

  /* =========================
     Transport (valgfritt)
     - brukes av e-post / webhook workers
     - ignoreres av domene
  ========================= */

  /**
   * Avsender e-post (for e-post-backup)
   */
  from?: string;

  /**
   * Mottaker e-post (for e-post-backup)
   */
  to?: string;

  /**
   * Emne (for e-post-backup)
   */
  subject?: string;

  /**
   * Plain text body (for e-post-backup)
   */
  bodyText?: string;

  /**
   * HTML body (for e-post-backup)
   */
  bodyHtml?: string | null;

  /**
   * Frie metadata (debug, pricing, route, osv.)
   */
  extra?: any;
};
