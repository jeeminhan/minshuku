import { join } from "node:path";
import { runScene } from "@engine/runScene";
import type { RunSceneResult } from "@engine/runScene";
import {
  DEMO_NOW,
  DEMO_PERSONA,
  DEMO_RECENT_CONTEXT,
  demoReviewItems,
} from "./demoLearner";
import { createLLMClient } from "./fixtureClient";

// Next runs with cwd = web/ (HARNESS.md: `cd web && npm run dev`), so the
// repo-level logs/ directory is one level up. Passed explicitly — never rely
// on the engine's cwd default, which would write into web/logs.
const WEB_LOG_DIR = join(process.cwd(), "..", "logs", "web");

// Server-side bridge: runs one episode for the fixed demo learner.
// SRS persistence between requests is contract 004 — every request replays
// the same fresh seed.
export async function runEpisode(): Promise<RunSceneResult> {
  return runScene({
    reviewItems: demoReviewItems(),
    now: DEMO_NOW,
    recentContext: { ...DEMO_RECENT_CONTEXT },
    llmClient: createLLMClient(),
    logDir: WEB_LOG_DIR,
    persona: DEMO_PERSONA,
    userId: "demo-learner",
  });
}
