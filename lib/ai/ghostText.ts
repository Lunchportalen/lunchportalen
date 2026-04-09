/**
 * Ghost continuation: only the part the user has not already typed.
 * Pure helper — safe on client or server.
 */

/**
 * @returns Suffix to render after `currentText` (no leading overlap / duplication).
 */
export function renderGhostText(currentText: string, completion: string): string {
  const comp = completion.trimStart();
  if (!comp) return "";
  const cur = currentText;

  if (comp.startsWith(cur)) {
    return comp.slice(cur.length);
  }

  const max = Math.min(cur.length, comp.length);
  for (let len = max; len > 0; len--) {
    if (cur.slice(-len) === comp.slice(0, len)) {
      return comp.slice(len);
    }
  }

  return comp;
}
