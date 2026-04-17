// Editorial HTML + SEO via Umbraco Delivery — same pipeline as `om-oss` (Next = renderer only).
import {
  generatePublicCmsSlugMetadata,
  PublicCmsSlugPageView,
} from "@/lib/cms/public/publicCmsSlugRoute";

type SP = Record<string, string | string[] | undefined> | undefined;

type Props = { searchParams?: Promise<SP> | SP };

const SLUG = "hvordan";

export async function generateMetadata({ searchParams }: Props) {
  return generatePublicCmsSlugMetadata(SLUG, searchParams);
}

export default async function HvordanPage({ searchParams }: Props) {
  return <PublicCmsSlugPageView slug={SLUG} searchParams={searchParams} />;
}
