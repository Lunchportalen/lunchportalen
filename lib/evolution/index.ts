export { analyzeSystem } from "./analyze";
export { proposeFix } from "./propose";
export { testProposal } from "./experiment";
export { decide } from "./decide";
export { applyProposal } from "./apply";
export { persistEvolutionEvent } from "./persist";
/** DB row insert: import `@/lib/evolution/persistDb.server` from server routes only (not re-exported here). */
export { runEvolution } from "./run";
export type * from "./types";
