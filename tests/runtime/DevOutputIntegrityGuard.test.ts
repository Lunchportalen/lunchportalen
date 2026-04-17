import { describe, expect, it } from "vitest";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";
import nextConfig from "@/next.config";
import {
  NEXT_BUILD_DIST_DIR,
  NEXT_DEV_DIST_DIR,
  resolveNextDistDir,
} from "@/lib/runtime/nextOutput";

describe("Dev output integrity guard", () => {
  it("separates next dev output from build/start output", () => {
    expect(resolveNextDistDir(PHASE_DEVELOPMENT_SERVER)).toBe(NEXT_DEV_DIST_DIR);
    expect(resolveNextDistDir(PHASE_PRODUCTION_BUILD)).toBe(NEXT_BUILD_DIST_DIR);
    expect(resolveNextDistDir(PHASE_PRODUCTION_SERVER)).toBe(NEXT_BUILD_DIST_DIR);
    expect(NEXT_DEV_DIST_DIR).not.toBe(NEXT_BUILD_DIST_DIR);
  });

  it("wires the same distDir strategy through next.config", () => {
    expect(nextConfig(PHASE_DEVELOPMENT_SERVER).distDir).toBe(NEXT_DEV_DIST_DIR);
    expect(nextConfig(PHASE_PRODUCTION_BUILD).distDir).toBe(NEXT_BUILD_DIST_DIR);
    expect(nextConfig(PHASE_PRODUCTION_SERVER).distDir).toBe(NEXT_BUILD_DIST_DIR);
  });
});
