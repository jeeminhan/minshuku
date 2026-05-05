import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadGrammar, loadTemplates, loadVocab } from "../src/lib/content.js";
import { GeminiClient } from "../src/lib/llm/client.js";
import { recentContextFromLogs } from "../src/lib/log/recentContext.js";
import { renderSceneRunLog } from "../src/lib/log/renderSceneRunLog.js";
import { readAllSceneRunLogs } from "../src/lib/log/sceneRunLog.js";
import { runScene } from "../src/lib/runScene.js";
import { applyOutcome } from "../src/lib/srs/intervals.js";
import type { EvaluatorResult, JlptLevel, ReviewItem } from "../src/lib/types.js";

const LOG_DIR = join(process.cwd(), "logs");
const STATE_PATH = join(LOG_DIR, "srs-state.json");

const VALID_LEVELS: ReadonlySet<JlptLevel> = new Set(["N5", "N4", "N3", "N2", "N1"]);

interface CliOptions {
  levels: ReadonlySet<JlptLevel> | null;
  reseed: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let levels: Set<JlptLevel> | null = null;
  let reseed = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    let value: string | undefined;
    if (arg === "--level" || arg === "--levels") {
      value = argv[++i];
    } else if (arg?.startsWith("--level=") || arg?.startsWith("--levels=")) {
      value = arg.split("=", 2)[1];
    } else if (arg === "--reseed") {
      reseed = true;
      continue;
    } else {
      continue;
    }
    if (!value) throw new Error(`Missing value for ${arg}`);
    levels = new Set();
    for (const raw of value.split(",")) {
      const lvl = raw.trim().toUpperCase() as JlptLevel;
      if (!VALID_LEVELS.has(lvl)) {
        throw new Error(`Invalid JLPT level "${raw}". Use one of: N5, N4, N3, N2, N1.`);
      }
      levels.add(lvl);
    }
    if (levels.size === 0) throw new Error(`Empty level list for ${arg}`);
  }
  return { levels, reseed };
}

function writeState(items: ReviewItem[]): void {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(items, null, 2));
}

function newReviewItem(itemId: string, itemType: "grammar" | "vocab"): ReviewItem {
  return {
    itemId,
    itemType,
    lastReviewedAt: null,
    nextReviewAt: null,
    ease: 2.5,
    interval: 0,
    lapses: 0,
  };
}

function defaultSeed(): ReviewItem[] {
  return [
    newReviewItem("grammar.tsumori", "grammar"),
    newReviewItem("vocab.mado", "vocab"),
    newReviewItem("vocab.ame", "vocab"),
    newReviewItem("vocab.fushigi", "vocab"),
    newReviewItem("vocab.yakusoku", "vocab"),
  ];
}

function seedByLevel(levels: ReadonlySet<JlptLevel>): ReviewItem[] {
  const grammar = loadGrammar()
    .filter((g) => levels.has(g.jlptLevel))
    .map((g) => newReviewItem(g.id, "grammar"));
  const vocab = loadVocab()
    .filter((v) => levels.has(v.jlptLevel))
    .map((v) => newReviewItem(v.id, "vocab"));
  const items = [...grammar, ...vocab];
  if (items.length === 0) {
    const list = [...levels].join(",");
    throw new Error(`No items in data/ matched levels: ${list}`);
  }
  return items;
}

function loadOrInitState(opts: CliOptions): ReviewItem[] {
  const exists = existsSync(STATE_PATH);
  if (exists && !opts.reseed && !opts.levels) {
    return JSON.parse(readFileSync(STATE_PATH, "utf8")) as ReviewItem[];
  }
  const seed = opts.levels ? seedByLevel(opts.levels) : defaultSeed();
  writeState(seed);
  if (opts.levels) {
    const list = [...opts.levels].join(",");
    console.log(`Seeded ${seed.length} items at JLPT ${list} -> ${STATE_PATH}`);
  }
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
  const opts = parseArgs(process.argv.slice(2));
  const items = loadOrInitState(opts);
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
