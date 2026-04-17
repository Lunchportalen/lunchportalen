import {
  generatePublicCmsSlugMetadata,
  PublicCmsSlugPageView,
} from "@/lib/cms/public/publicCmsSlugRoute";

type SP = Record<string, string | string[] | undefined> | undefined;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<SP> | SP;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params;
  return generatePublicCmsSlugMetadata(slug, searchParams);
}

export default async function PublicCmsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  return <PublicCmsSlugPageView slug={slug} searchParams={searchParams} />;
}
