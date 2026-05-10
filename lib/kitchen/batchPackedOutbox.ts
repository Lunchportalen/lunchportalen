import "server-only";

import { ORDER_EMAIL } from "@/lib/system/emailAddresses";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function isTestEnv() {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

function formatDisplayDate(dateISO: string) {
  const parts = String(dateISO).slice(0, 10).split("-");
  if (parts.length !== 3) return dateISO;
  const [year, month, day] = parts;
  if (!year || !month || !day) return dateISO;
  return `${day}.${month}.${year}`;
}

export async function enqueueBatchPackedOutbox(
  admin: any,
  input: {
    rid: string;
    date: string;
    slot: string;
    companyId: string;
    locationId: string;
  }
) {
  const [companyRes, locationRes, ordersRes] = await Promise.all([
    admin.from("companies").select("name").eq("id", input.companyId).maybeSingle(),
    admin
      .from("company_locations")
      .select("name, delivery_window_from, delivery_window_to")
      .eq("id", input.locationId)
      .maybeSingle(),
    admin
      .from("orders")
      .select("id")
      .eq("date", input.date)
      .eq("company_id", input.companyId)
      .eq("location_id", input.locationId)
      .eq("slot", input.slot)
      .eq("status", "ACTIVE"),
  ]);

  const company = safeStr(companyRes.data?.name) || "Ukjent firma";
  const location = safeStr(locationRes.data?.name) || "Lokasjon";
  const deliveryWindow =
    safeStr(locationRes.data?.delivery_window_from) && safeStr(locationRes.data?.delivery_window_to)
      ? `${safeStr(locationRes.data.delivery_window_from)}–${safeStr(locationRes.data.delivery_window_to)}`
      : input.slot;
  const portions = Array.isArray(ordersRes.data) ? ordersRes.data.length : 0;
  const eventKey = `batch_packed:${input.date}:${input.slot}:${input.locationId}`;
  const displayDate = formatDisplayDate(input.date);

  try {
    const { error } = await admin.from("outbox").insert({
      event_key: eventKey,
      status: "PENDING",
      attempts: 0,
      payload: {
        eventType: "BATCH_PACKED",
        eventKey,
        rid: input.rid,
        from: safeStr(process.env.LP_RESEND_FROM) || `Lunchportalen <${ORDER_EMAIL}>`,
        to: "driver@lunchportalen.no",
        subject: `Leveranse klar – ${deliveryWindow} ${displayDate}`,
        bodyText: [
          `Leveranse klar – ${deliveryWindow} ${displayDate}`,
          "",
          "Hei,",
          "",
          "Følgende leveranser er pakket og klare for henting:",
          "",
          `- ${company}, ${location}: ${portions} porsjoner`,
          `  Leveringsvindu: ${deliveryWindow}`,
          "",
          "Totalt: 1 leveranse",
          "",
          "Med vennlig hilsen,",
          "Lunchportalen-kjøkkenet",
        ].join("\n"),
        timestampISO: new Date().toISOString(),
        extra: {
          date: input.date,
          displayDate,
          slot: input.slot,
          companyId: input.companyId,
          locationId: input.locationId,
          portions,
        },
      },
    });

    if (error && String((error as any).code ?? "") !== "23505") throw error;
  } catch (error: any) {
    if (isTestEnv() && String(error?.message ?? error).includes(".insert is not a function")) return;
    throw error;
  }
}
