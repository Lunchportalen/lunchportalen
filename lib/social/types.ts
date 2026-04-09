/**

 * AI Social Engine — felles typer og flagg (re-eksporter + konstanter).

 */



export type { CalendarPost, CalendarPostPerformance, CalendarPostStatus } from "@/lib/social/calendar";

export { CALENDAR_DAYS, rollingDayKeys, serializeCalendar, parseCalendar } from "@/lib/social/calendar";

export type {

  GeneratedSocialPostPayload,

  LearningEngagementTier,

  SocialEngineMediaPayload,

  SocialGenerateContext,

} from "@/lib/social/enginePayload";

export type { SchedulerRunResult } from "@/lib/social/scheduler";

export {

  AUTO_PUBLISH,

  runScheduler,

  getPlannedPosts,

  runSchedulerWithLearning,

  alignPlannedPostsToTimeInsights,

} from "@/lib/social/scheduler";

export type { SocialEngineLearning } from "@/lib/social/learning";

export type { PostPerformancePatch } from "@/lib/social/performance";



/** Internt kart: hva som finnes i repoet (for dokumentasjon / diagnostikk). */

export const SOCIAL_ENGINE_CAPABILITIES = {

  hasContentGen: true,

  hasCalendar: true,

  hasTracking: true,

  hasRevenue: true,

  hasAIEngine: true,

  hasCmsMedia: true,

} as const;


