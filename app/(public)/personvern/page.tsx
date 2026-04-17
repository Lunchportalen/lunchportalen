import {
  generatePublicCmsSlugMetadata,
  PublicCmsSlugPageView,
} from "@/lib/cms/public/publicCmsSlugRoute";

type SP = Record<string, string | string[] | undefined> | undefined;

export async function generateMetadata({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  return generatePublicCmsSlugMetadata("personvern", searchParams);
}

export default async function PersonvernPage({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  return <PublicCmsSlugPageView slug="personvern" searchParams={searchParams} />;
}
