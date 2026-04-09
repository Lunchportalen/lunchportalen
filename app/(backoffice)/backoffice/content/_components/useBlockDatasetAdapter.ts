"use client";

import { useCallback, useMemo } from "react";
import type { Block } from "./editorBlockTypes";
import type { BlockInspectorFieldsCtx } from "./blockPropertyEditorContract";

export type BlockDatasetCollectionKey = "items" | "plans" | "steps";

type StructureOwner =
  | { type: "cards"; key: "items" }
  | { type: "zigzag"; key: "steps" }
  | { type: "pricing"; key: "plans" }
  | { type: "grid"; key: "items" };

function resolveStructurePath(
  c: Block,
  key: BlockDatasetCollectionKey,
): StructureOwner | null {
  if (key === "items" && c.type === "cards") return { type: "cards", key: "items" };
  if (key === "items" && c.type === "grid") return { type: "grid", key: "items" };
  if (key === "steps" && c.type === "zigzag") return { type: "zigzag", key: "steps" };
  if (key === "plans" && c.type === "pricing") return { type: "pricing", key: "plans" };
  return null;
}

/**
 * Editing façade over canonical `blocks` — all writes go through `setBlockById`.
 * U91: structure collections live under `structureData`; content/settings under their layers.
 * Ingen parallell sannhet: ingen egen kopi av blokkverdier utenom workspace-state.
 */
export function useBlockDatasetAdapter(block: Block, setBlockById: BlockInspectorFieldsCtx["setBlockById"]) {
  const id = block.id;

  const commit = useCallback(
    (updater: (current: Block) => Block) => {
      setBlockById(id, (c) => (c.id === id ? updater(c) : c));
    },
    [id, setBlockById],
  );

  const updateContentData = useCallback(
    (patch: Record<string, unknown>) => {
      commit((c) => {
        if (!("contentData" in c)) return c;
        const cur = c as Block & { contentData: Record<string, unknown> };
        return { ...cur, contentData: { ...cur.contentData, ...patch } } as Block;
      });
    },
    [commit],
  );

  const updateSettingsData = useCallback(
    (patch: Record<string, unknown>) => {
      commit((c) => {
        if (!("settingsData" in c)) return c;
        const cur = c as Block & { settingsData: Record<string, unknown> };
        return { ...cur, settingsData: { ...cur.settingsData, ...patch } } as Block;
      });
    },
    [commit],
  );

  const updateStructureData = useCallback(
    (patch: Record<string, unknown>) => {
      commit((c) => {
        if (!("structureData" in c)) return c;
        const cur = c as Block & { structureData: Record<string, unknown> };
        return { ...cur, structureData: { ...cur.structureData, ...patch } } as Block;
      });
    },
    [commit],
  );

  const updateCollectionItem = useCallback(
    (key: BlockDatasetCollectionKey, index: number, mapItem: (item: unknown) => unknown) => {
      commit((c) => {
        const owner = resolveStructurePath(c, key);
        if (!owner) return c;
        if (c.type === "cards" && owner.type === "cards") {
          const arr = c.structureData.items;
          const next = arr.map((it, i) => (i === index ? (mapItem(it) as (typeof arr)[number]) : it));
          return { ...c, structureData: { ...c.structureData, items: next } };
        }
        if (c.type === "grid" && owner.type === "grid") {
          const arr = c.structureData.items;
          const next = arr.map((it, i) => (i === index ? (mapItem(it) as (typeof arr)[number]) : it));
          return { ...c, structureData: { ...c.structureData, items: next } };
        }
        if (c.type === "zigzag" && owner.type === "zigzag") {
          const arr = c.structureData.steps;
          const next = arr.map((it, i) => (i === index ? (mapItem(it) as (typeof arr)[number]) : it));
          return { ...c, structureData: { ...c.structureData, steps: next } };
        }
        if (c.type === "pricing" && owner.type === "pricing") {
          const arr = c.structureData.plans;
          const next = arr.map((it, i) => (i === index ? (mapItem(it) as (typeof arr)[number]) : it));
          return { ...c, structureData: { ...c.structureData, plans: next } };
        }
        return c;
      });
    },
    [commit],
  );

  const addCollectionItem = useCallback(
    (key: BlockDatasetCollectionKey, item: unknown) => {
      commit((c) => {
        const owner = resolveStructurePath(c, key);
        if (!owner) return c;
        if (c.type === "cards" && owner.type === "cards") {
          const arr = [...c.structureData.items, item as (typeof c.structureData.items)[number]];
          return { ...c, structureData: { ...c.structureData, items: arr } };
        }
        if (c.type === "grid" && owner.type === "grid") {
          const arr = [...c.structureData.items, item as (typeof c.structureData.items)[number]];
          return { ...c, structureData: { ...c.structureData, items: arr } };
        }
        if (c.type === "zigzag" && owner.type === "zigzag") {
          const arr = [...c.structureData.steps, item as (typeof c.structureData.steps)[number]];
          return { ...c, structureData: { ...c.structureData, steps: arr } };
        }
        if (c.type === "pricing" && owner.type === "pricing") {
          const arr = [...c.structureData.plans, item as (typeof c.structureData.plans)[number]];
          return { ...c, structureData: { ...c.structureData, plans: arr } };
        }
        return c;
      });
    },
    [commit],
  );

  const removeCollectionItem = useCallback(
    (key: BlockDatasetCollectionKey, index: number) => {
      commit((c) => {
        const owner = resolveStructurePath(c, key);
        if (!owner) return c;
        if (c.type === "cards" && owner.type === "cards") {
          return {
            ...c,
            structureData: {
              ...c.structureData,
              items: c.structureData.items.filter((_, i) => i !== index),
            },
          };
        }
        if (c.type === "grid" && owner.type === "grid") {
          return {
            ...c,
            structureData: {
              ...c.structureData,
              items: c.structureData.items.filter((_, i) => i !== index),
            },
          };
        }
        if (c.type === "zigzag" && owner.type === "zigzag") {
          return {
            ...c,
            structureData: {
              ...c.structureData,
              steps: c.structureData.steps.filter((_, i) => i !== index),
            },
          };
        }
        if (c.type === "pricing" && owner.type === "pricing") {
          return {
            ...c,
            structureData: {
              ...c.structureData,
              plans: c.structureData.plans.filter((_, i) => i !== index),
            },
          };
        }
        return c;
      });
    },
    [commit],
  );

  const reorderCollectionItems = useCallback(
    (key: BlockDatasetCollectionKey, fromIndex: number, toIndex: number) => {
      commit((c) => {
        const owner = resolveStructurePath(c, key);
        if (!owner) return c;
        const pick = (): Block | null => {
          if (c.type === "cards" && owner.type === "cards") {
            const raw = [...c.structureData.items];
            const [moved] = raw.splice(fromIndex, 1);
            if (moved === undefined) return null;
            raw.splice(toIndex, 0, moved);
            return { ...c, structureData: { ...c.structureData, items: raw } };
          }
          if (c.type === "grid" && owner.type === "grid") {
            const raw = [...c.structureData.items];
            const [moved] = raw.splice(fromIndex, 1);
            if (moved === undefined) return null;
            raw.splice(toIndex, 0, moved);
            return { ...c, structureData: { ...c.structureData, items: raw } };
          }
          if (c.type === "zigzag" && owner.type === "zigzag") {
            const raw = [...c.structureData.steps];
            const [moved] = raw.splice(fromIndex, 1);
            if (moved === undefined) return null;
            raw.splice(toIndex, 0, moved);
            return { ...c, structureData: { ...c.structureData, steps: raw } };
          }
          if (c.type === "pricing" && owner.type === "pricing") {
            const raw = [...c.structureData.plans];
            const [moved] = raw.splice(fromIndex, 1);
            if (moved === undefined) return null;
            raw.splice(toIndex, 0, moved);
            return { ...c, structureData: { ...c.structureData, plans: raw } };
          }
          return null;
        };
        return pick() ?? c;
      });
    },
    [commit],
  );

  return useMemo(
    () => ({
      blockId: id,
      block,
      commit,
      updateContentData,
      updateSettingsData,
      updateStructureData,
      updateCollectionItem,
      addCollectionItem,
      removeCollectionItem,
      reorderCollectionItems,
    }),
    [
      id,
      block,
      commit,
      updateContentData,
      updateSettingsData,
      updateStructureData,
      updateCollectionItem,
      addCollectionItem,
      removeCollectionItem,
      reorderCollectionItems,
    ],
  );
}
