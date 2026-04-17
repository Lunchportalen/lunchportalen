import {
  generatePublicCmsSlugMetadata,
  PublicCmsSlugPageView,
} from "@/lib/cms/public/publicCmsSlugRoute";

type SP = Record<string, string | string[] | undefined> | undefined;

export async function generateMetadata({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  return generatePublicCmsSlugMetadata("vilkar", searchParams);
}

export default async function VilkarPage({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  return <PublicCmsSlugPageView slug="vilkar" searchParams={searchParams} />;
}
