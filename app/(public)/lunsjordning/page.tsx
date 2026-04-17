// Editorial HTML + SEO via Umbraco Delivery — Next = renderer only.
import {
  generatePublicCmsSlugMetadata,
  PublicCmsSlugPageView,
} from "@/lib/cms/public/publicCmsSlugRoute";

type SP = Record<string, string | string[] | undefined> | undefined;

type Props = { searchParams?: Promise<SP> | SP };

const SLUG = "lunsjordning";

export async function generateMetadata({ searchParams }: Props) {
  return generatePublicCmsSlugMetadata(SLUG, searchParams);
}

export default async function LunsjordningPage({ searchParams }: Props) {
  return <PublicCmsSlugPageView slug={SLUG} searchParams={searchParams} />;
}
