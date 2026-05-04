import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GeminiClient } from "../src/lib/llm/client.js";
import { runScene } from "../src/lib/runScene.js";
import type { ReviewItem } from "../src/lib/types.js";

const STATE_PATH = join(process.cwd(), "logs", "srs-state.json");

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
  writeFileSync(STATE_PATH, JSON.stringify(seed, null, 2));
  return seed;
}

async function main(): Promise<void> {
  const items = loadOrInitState();
  const client = new GeminiClient();
  const log = await runScene({
    reviewItems: items,
    now: new Date(),
    recentContext: { lastTemplateId: null, lastLocation: null },
    llmClient: client,
    persona: "intermediate-n3-foreign-student",
  });

  if (!log) {
    console.log("No due items — nothing to run.");
    return;
  }

  console.log(`Scene run complete. id=${log.id}`);
  console.log(`Template: ${log.templateChosen.id}`);
  console.log(`Active: ${log.activeTargetsChosen.map((a) => a.itemId).join(", ")}`);
  console.log(`Turns: ${log.turns.length}`);
  console.log(`Outcomes: ${log.itemOutcomes.map((o) => `${o.itemId}=${o.outcome}`).join(", ")}`);
  console.log(`Log appended to logs/scene-runs.jsonl`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
