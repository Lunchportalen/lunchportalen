import * as Sentry from "@sentry/nextjs";

import { buildSentryInitOptions } from "@/lib/sentry/scrubEvent";

Sentry.init(buildSentryInitOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
