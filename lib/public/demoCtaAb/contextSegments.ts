/** Grov enhetsklasse (server: User-Agent). */
export type DemoDeviceSegment = "mobile" | "tablet" | "desktop" | "unknown";

/** Grov trafikkilde (UTM + referrer). */
export type DemoSourceSegment = "direct" | "organic" | "paid" | "social" | "email" | "referral" | "unknown";

export const DEMO_DEVICE_SEGMENTS: DemoDeviceSegment[] = ["mobile", "tablet", "desktop", "unknown"];

export const DEMO_SOURCE_SEGMENTS: DemoSourceSegment[] = [
  "direct",
  "organic",
  "paid",
  "social",
  "email",
  "referral",
  "unknown",
];

export function parseDemoDeviceSegment(v: string | null | undefined): DemoDeviceSegment | null {
  if (!v) return null;
  return DEMO_DEVICE_SEGMENTS.includes(v as DemoDeviceSegment) ? (v as DemoDeviceSegment) : null;
}

export function parseDemoSourceSegment(v: string | null | undefined): DemoSourceSegment | null {
  if (!v) return null;
  return DEMO_SOURCE_SEGMENTS.includes(v as DemoSourceSegment) ? (v as DemoSourceSegment) : null;
}
