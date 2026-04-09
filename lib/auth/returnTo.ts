// STATUS: KEEP

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function isLoopPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/logout" ||
    pathname.startsWith("/logout/") ||
    pathname === "/registrering" ||
    pathname.startsWith("/registrering/")
  );
}

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

export function safePath(input: string | null | undefined): string {
  const raw = safeStr(input);
  if (!raw) return "/";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (hasControlChars(raw)) return "/";
  return raw;
}

export function normalizeReturnTo(input: string | null | undefined): string | null {
  const path = safePath(input);
  if (path === "/") return null;

  const comparePath = normalizePathname(path.split(/[?#]/, 1)[0] || "/");
  if (isLoopPath(comparePath)) return null;
  if (comparePath.startsWith("/api/")) return null;
  if (comparePath.startsWith("/auth/")) return null;

  return path;
}

