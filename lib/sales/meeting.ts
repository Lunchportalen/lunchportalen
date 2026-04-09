import "server-only";

export type LeadLike = Record<string, unknown>;

/**
 * Observability-only meeting marker — does not call calendars or send mail.
 */
export function bookMeeting(lead: LeadLike): { status: "meeting_scheduled" } {
  console.log("[MEETING_BOOKED]", {
    keys: Object.keys(lead ?? {}).slice(0, 12),
  });

  return { status: "meeting_scheduled" as const };
}
