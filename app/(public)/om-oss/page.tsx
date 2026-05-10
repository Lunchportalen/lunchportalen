import {
  generatePublicCmsSlugMetadata,
  PublicCmsSlugPageView,
} from "@/lib/cms/public/publicCmsSlugRoute";

type SP = Record<string, string | string[] | undefined> | undefined;
export const revalidate = 3600;

export async function generateMetadata({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  return generatePublicCmsSlugMetadata("om-oss", searchParams);
}

export default async function OmOssPage({ searchParams }: { searchParams?: Promise<SP> | SP }) {
  return <PublicCmsSlugPageView slug="om-oss" searchParams={searchParams} />;
}
