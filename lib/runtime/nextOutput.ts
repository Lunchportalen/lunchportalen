import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";

export const NEXT_DEV_DIST_DIR = ".next/dev-runtime";
export const NEXT_BUILD_DIST_DIR = ".next/build-runtime";

export function resolveNextDistDir(phase: string): string {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return NEXT_DEV_DIST_DIR;
  }

  if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) {
    return NEXT_BUILD_DIST_DIR;
  }

  return NEXT_BUILD_DIST_DIR;
}
