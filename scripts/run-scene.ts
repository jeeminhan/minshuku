import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadTemplates } from "../src/lib/content.js";
import { GeminiClient } from "../src/lib/llm/client.js";
import { recentContextFromLogs } from "../src/lib/log/recentContext.js";
import { renderSceneRunLog } from "../src/lib/log/renderSceneRunLog.js";
import { readAllSceneRunLogs } from "../src/lib/log/sceneRunLog.js";
import { runScene } from "../src/lib/runScene.js";
import { applyOutcome } from "../src/lib/srs/intervals.js";
import type { EvaluatorResult, ReviewItem } from "../src/lib/types.js";

const LOG_DIR = join(process.cwd(), "logs");
const STATE_PATH = join(LOG_DIR, "srs-state.json");

function writeState(items: ReviewItem[]): void {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(items, null, 2));
}

function loadOrInitState(): ReviewItem[] {
  if (existsSync(STATE_PATH)) {
    const raw = readFileSync(STATE_PATH, "utf8");
    return JSON.parse(raw) as ReviewItem[];
  }
  // First run: seed with one of each item due immediately.
  const seed: ReviewItem[] = [
    { itemId: "grammar.tsumori", itemType: "grammar", lastReviewedAt: null, nextReviewAt: null, ease: 2.5, interval: 0, lapses: 0 },
    { itemId: "vocab.mado",      itemType: "vocab",   lastReviewedAt: null, nextReviewAt: null, ease: 2.5, interval: 0, lapses: 0 },
    { itemId: "vocab.ame",       itemType: "vocab",   lastReviewedAt: null, nextReviewAt: null, ease: 2.5, interval: 0, lapses: 0 },
    { itemId: "vocab.fushigi",   itemType: "vocab",   lastReviewedAt: null, nextReviewAt: null, ease: 2.5, interval: 0, lapses: 0 },
    { itemId: "vocab.yakusoku",  itemType: "vocab",   lastReviewedAt: null, nextReviewAt: null, ease: 2.5, interval: 0, lapses: 0 },
  ];
  writeState(seed);
  return seed;
}

function applySceneOutcomes(
  items: ReviewItem[],
  outcomes: EvaluatorResult[],
  now: Date,
): ReviewItem[] {
  const outcomesByItem = new Map(outcomes.map((o) => [o.itemId, o.outcome]));
  return items.map((item) => {
    const outcome = outcomesByItem.get(item.itemId);
    return outcome ? applyOutcome(item, outcome, now) : item;
  });
}

async function main(): Promise<void> {
  const items = loadOrInitState();
  const client = new GeminiClient();
  const now = new Date();
  const result = await runScene({
    reviewItems: items,
    now,
    recentContext: recentContextFromLogs(readAllSceneRunLogs(), loadTemplates()),
    llmClient: client,
    persona: "intermediate-n3-foreign-student",
  });

  if (result.status === "skipped") {
    console.log(result.message);
    console.log(`Reason: ${result.reason}`);
    return;
  }

  const { log } = result;
  writeState(applySceneOutcomes(items, log.itemOutcomes, now));

  console.log(renderSceneRunLog(log));
  console.log(`Log appended to logs/scene-runs.jsonl`);
  console.log(`SRS state updated at logs/srs-state.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
