import "server-only";

/** Maks godkjente e-poster per UTC-døgn (prosess-lokal teller; flere instanser = konservativ grense). */
export const MAX_SALES_EMAIL_SENDS_PER_UTC_DAY = 20;

type Bucket = { day: string; count: number };

let bucket: Bucket = { day: "", count: 0 };

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureBucket(): void {
  const d = utcDayKey();
  if (bucket.day !== d) {
    bucket = { day: d, count: 0 };
  }
}

export function canSend(maxPerDay: number = MAX_SALES_EMAIL_SENDS_PER_UTC_DAY): boolean {
  ensureBucket();
  return bucket.count < maxPerDay;
}

export function markSent(): void {
  ensureBucket();
  bucket.count += 1;
}

export function getSalesSendCountToday(): number {
  ensureBucket();
  return bucket.count;
}
