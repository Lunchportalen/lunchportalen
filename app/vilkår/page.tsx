import { permanentRedirect } from "next/navigation";

/** Canonical path er `/vilkar` (ASCII). Denne ruten bevarer lenker med norsk å. */
export default function VilkårCanonicalRedirect() {
  permanentRedirect("/vilkar");
}
