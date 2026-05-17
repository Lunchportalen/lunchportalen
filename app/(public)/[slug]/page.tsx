import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PublicCatchAllRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const safeSlug = encodeURIComponent(slug);
  permanentRedirect(`https://lunchportalen.no/${safeSlug}`);
}
