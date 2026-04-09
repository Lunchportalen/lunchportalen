export function hashOutboundBody(s: string): string {
  const t = String(s ?? "");
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
  return `ob_${Math.abs(h)}_${t.length}`;
}
