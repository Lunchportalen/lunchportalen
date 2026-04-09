/**
 * Immutable block reorder for CMS drag-and-drop persistence (client or server).
 */
export function reorderBlocks<T>(blocks: T[] | null | undefined, fromIndex: number, toIndex: number): T[] {
  const list = Array.isArray(blocks) ? blocks : [];
  const len = list.length;
  if (len === 0) return [];
  if (fromIndex === toIndex) return [...list];
  if (fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len) return [...list];
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
