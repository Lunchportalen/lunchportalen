/**
 * Booking-lenke — konfigurerbar base-URL (ingen auto-booking uten menneske).
 */
export function generateBookingLink(lead: { id: string }): string {
  const base =
    typeof process !== "undefined" && typeof process.env?.BOOKING_URL === "string" && process.env.BOOKING_URL.trim()
      ? process.env.BOOKING_URL.trim()
      : "https://calendly.com/demo";
  return `${base}?leadId=${encodeURIComponent(lead.id)}`;
}
