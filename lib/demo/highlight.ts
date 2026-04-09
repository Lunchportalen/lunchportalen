export function highlightStyle(active: boolean): Record<string, string | number> {
  return active
    ? {
        boxShadow: "0 0 0 3px rgba(0,112,243,0.5)",
      }
    : {};
}
