import { OSLO_TZ } from "./oslo";

function osloHourMinute() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const h = Number(parts.find(p => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find(p => p.type === "minute")?.value ?? "0");
  return { h, m };
}

export function cutoffStatusNow() {
  if (process.env.DEV_BYPASS_CUTOFF === "true") {
    return { isLocked: false, cutoffTime: "08:00" };
  }

  const { h, m } = osloHourMinute();
  const isLocked = h > 8 || (h === 8 && m >= 0);
  return { isLocked, cutoffTime: "08:00" };
}
