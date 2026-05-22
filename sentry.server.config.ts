import * as Sentry from "@sentry/nextjs";

import { buildSentryInitOptions } from "@/lib/sentry/scrubEvent";
import { logSentryDiagnostics } from "@/lib/sentry/diagnostics";

logSentryDiagnostics("sentry.server.config");

Sentry.init(buildSentryInitOptions());
