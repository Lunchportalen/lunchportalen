// Internal landing path for AI Social attribution links — preserves query, redirects to home for capture.
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function ProductAttributionLandingPage({ params, searchParams }: Props) {
  const { productId: rawPid } = await params;
  const spRaw = searchParams ? await Promise.resolve(searchParams) : {};
  const sp = spRaw as Record<string, string | string[] | undefined>;
  const productId = decodeURIComponent(String(rawPid ?? "").trim()) || "unknown";

  const q = new URLSearchParams();
  const src = typeof sp.src === "string" ? sp.src : "ai_social";
  const postId = typeof sp.postId === "string" ? sp.postId : "";
  q.set("src", src);
  if (postId) q.set("postId", postId);
  if (productId && productId !== "unknown") q.set("productId", productId);

  redirect(`/?${q.toString()}`);
}
