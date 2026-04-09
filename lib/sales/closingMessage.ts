import { generateBookingLink } from "@/lib/sales/booking";
import { generateMeetingMessage } from "@/lib/sales/meetingMessage";

export function buildClosingMessage(lead: { id: string; meta?: Record<string, unknown> | null }): string {
  const bookingLink = generateBookingLink(lead);
  return generateMeetingMessage({ meta: lead.meta ?? null }).replace("[BOOKING LINK]", bookingLink);
}
