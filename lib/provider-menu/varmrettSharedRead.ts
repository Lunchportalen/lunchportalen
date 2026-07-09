/**
 * Phase 3B — Shared varmrett read-model helpers for profile generation safety.
 */

import { menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import {
  isVarmrettDateLocked,
  type ProviderOrderLockState,
} from "@/lib/provider-menu/providerMenuOrderLock";
import { resolveSharedVarmrettSlot } from "@/lib/provider-menu/providerMenuWorkspace";

export function slotHasProviderAuthoredVarmrett(slot: ResolvedProviderMenuSlot): boolean {
  if (slot.providerOverride) return true;
  if (!menuSlotHasContent(slot)) return false;
  return !slot.autoFilled;
}

export function dayCanReceiveProfileGeneration(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
  lockState: ProviderOrderLockState,
): boolean {
  if (isVarmrettDateLocked(lockState, date)) return false;

  const shared = resolveSharedVarmrettSlot(slots, date);
  if (!menuSlotHasContent(shared)) return true;

  if (shared.status === "published") return false;
  if (slotHasProviderAuthoredVarmrett(shared)) return false;

  return true;
}

export function collectBlockedDayIndicesForGeneration(
  slots: Record<string, ResolvedProviderMenuSlot>,
  dates: readonly string[],
  lockState: ProviderOrderLockState,
): Set<number> {
  const blocked = new Set<number>();
  dates.forEach((date, index) => {
    if (!dayCanReceiveProfileGeneration(slots, date, lockState)) {
      blocked.add(index);
    }
  });
  return blocked;
}
