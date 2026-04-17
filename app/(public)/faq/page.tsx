import {
  generatePublicCmsSlugMetadata,
  PublicCmsSlugPageView,
} from "@/lib/cms/public/publicCmsSlugRoute";

type SP = Record<string, string | string[] | undefined> | undefined;

export async function generateMetadata({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  return generatePublicCmsSlugMetadata("faq", searchParams);
}

export default async function FaqPage({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  return <PublicCmsSlugPageView slug="faq" searchParams={searchParams} />;
}
