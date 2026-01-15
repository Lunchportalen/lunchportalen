// app/lib/date/cutoff.ts

// true når klokka er >= 08:00 i Oslo
export function isCutoffPassedNow(): boolean {
  const now = new Date();
  const oslo = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Oslo" })
  );

  const h = oslo.getHours();
  const m = oslo.getMinutes();

  return h > 8 || (h === 8 && m >= 0);
}

// Wrapper brukt av pages / API
export function cutoffStatusNow() {
  return {
    isLocked: isCutoffPassedNow(),
    cutoffTime: "08:00",
  };
}
