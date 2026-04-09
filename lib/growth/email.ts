/**
 * Enkel B2B e-postutkast fra et sosialt utkast (kan kobles til ESP senere).
 */

import type { DistributablePost } from "@/lib/growth/channels";

export function generateEmailFromPost(post: DistributablePost): { subject: string; body: string } {
  return {
    subject: "Ny lunsjløsning for bedriften din",
    body: post.text,
  };
}
