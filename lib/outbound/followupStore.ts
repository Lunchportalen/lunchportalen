/**
 * Vedvarende oppfølging (localStorage). Regler: maks én aktiv per lead, minst 30 døgn frem i tid.
 */

const KEY = "lp_outbound_followups_v1";
/** Minimum tid til oppfølging fra nå (30 døgn) */
export const MIN_FOLLOWUP_DELAY_MS = 1000 * 60 * 60 * 24 * 30;

export type FollowUpRow = {
  leadId: string;
  time: number;
  reason: string;
  /** Satt når bruker har håndtert / loggført oppfølging */
  completedAt?: number;
};

function readAll(): FollowUpRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = JSON.parse(raw ?? "[]") as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x) => x && typeof (x as FollowUpRow).leadId === "string") as FollowUpRow[];
  } catch {
    return [];
  }
}

function writeAll(rows: FollowUpRow[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 2000)));
  } catch {
    /* ignore */
  }
}

function bumpFollowUpTick(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("lp-outbound-followup"));
}

function activeRows(rows: FollowUpRow[]): FollowUpRow[] {
  return rows.filter((r) => !r.completedAt);
}

/** Sann hvis lead har en aktiv (ikke fullført) oppfølging planlagt eller forfalt. */
export function hasActiveFollowUp(leadId: string): boolean {
  return activeRows(readAll()).some((r) => r.leadId === leadId);
}

export type AddFollowUpResult = { ok: true; scheduledAt: number } | { ok: false; reason: string };

/**
 * Planlegg oppfølging. Klipper til minst nå + 30 døgn. Avviser hvis lead allerede har aktiv oppfølging.
 */
export function addFollowUp(leadId: string, time: number, reason: string): AddFollowUpResult {
  if (typeof window === "undefined") {
    return { ok: false, reason: "Kun i nettleser." };
  }
  const now = Date.now();
  const when = Math.max(time, now + MIN_FOLLOWUP_DELAY_MS);

  const all = readAll();
  if (activeRows(all).some((r) => r.leadId === leadId)) {
    return { ok: false, reason: "Maks én aktiv oppfølging per lead." };
  }

  all.push({ leadId, time: when, reason });
  writeAll(all);
  bumpFollowUpTick();
  return { ok: true, scheduledAt: when };
}

export function getDueFollowUps(): FollowUpRow[] {
  const now = Date.now();
  return activeRows(readAll()).filter((f) => f.time <= now);
}

export function getPendingFollowUps(): FollowUpRow[] {
  const now = Date.now();
  return activeRows(readAll())
    .filter((f) => f.time > now)
    .sort((a, b) => a.time - b.time);
}

/** Marker forfalt oppfølging som håndtert (én rad per lead antas aktiv). */
export function completeFollowUpForLead(leadId: string): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const all = readAll();
  const next = all.map((r) => {
    if (r.leadId !== leadId || r.completedAt) return r;
    if (r.time <= now) {
      return { ...r, completedAt: now };
    }
    return r;
  });
  writeAll(next);
  bumpFollowUpTick();
}
