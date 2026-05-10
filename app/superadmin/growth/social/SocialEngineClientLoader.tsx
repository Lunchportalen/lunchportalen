"use client";

import dynamic from "next/dynamic";

const SocialEngineClient = dynamic(() => import("./SocialEngineClient"), {
  loading: () => (
    <div className="h-32 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />
  ),
  ssr: false,
});

export default function SocialEngineClientLoader() {
  return <SocialEngineClient />;
}
