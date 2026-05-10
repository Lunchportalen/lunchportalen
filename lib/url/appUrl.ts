import "server-only";

export function getAppBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.PUBLIC_APP_URL ??
    process.env.VERCEL_URL;

  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL er ikke satt i produksjon. Sett variabelen i Vercel.");
    }
    return "http://localhost:3000";
  }

  return (url.startsWith("http") ? url : `https://${url}`).replace(/\/+$/, "");
}
