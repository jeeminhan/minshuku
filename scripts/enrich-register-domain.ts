// One-shot enrichment script: tag all vocab and grammar items with
// `register` and `domain` via Gemini. Phase C of the register/domain
// migration. Idempotent — items already tagged are skipped.
//
// Usage:
//   npm run enrich-rd                        # dry run, prints batch sizes
//   npm run enrich-rd -- --apply             # actually run the LLM
//   npm run enrich-rd -- --apply --batch 25  # smaller batches

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { GeminiClient } from "../src/lib/llm/client.js";

interface CliOptions {
  apply: boolean;
  batchSize: number;
  target: "vocab" | "grammar" | "all";
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = { apply: false, batchSize: 30, target: "all" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") opts.apply = true;
    else if (a === "--batch") opts.batchSize = Math.max(1, parseInt(argv[++i], 10));
    else if (a === "--only-vocab") opts.target = "vocab";
    else if (a === "--only-grammar") opts.target = "grammar";
    else throw new Error(`Unknown arg: ${a}`);
  }
  return opts;
}

const REGISTER = ["casual", "neutral", "polite", "formal", "literary"] as const;
const DOMAIN = ["physical", "emotional", "abstract", "social", "temporal", "commercial", "ritual"] as const;

const EnrichedItem = z.object({
  id: z.string(),
  register: z.enum(REGISTER),
  domain: z.array(z.enum(DOMAIN)).min(1).max(4),
});
const EnrichedBatch = z.object({ items: z.array(EnrichedItem) });

const SYSTEM = `You are a Japanese-language taxonomist. For each item you receive, assign:
- register: which speech level the word/grammar BELONGS TO. Choose ONE of:
    casual    — used freely in casual speech, slangy or familiar
    neutral   — register-flexible; works in casual or polite contexts (most common everyday words)
    polite    — primarily appears in polite (です/ます) speech, or in service/business contexts
    formal    — written-style, business-formal, or 敬語 contexts; rarely used in casual speech
    literary  — archaic, written-style, or literary registers; not natural in everyday spoken Japanese
- domain: 1-4 SEMANTIC SPACES the word/grammar OPERATES IN. Choose from:
    physical    — concrete objects, body, nature, food, materials, clothing, weather
    emotional   — feelings, moods, attitudes, evaluative reactions
    abstract    — ideas, concepts, reasoning, meta-language, hypotheticals, thought
    social      — interpersonal interaction, relationships, communication, social roles
    temporal    — time, scheduling, duration, sequence, frequency
    commercial  — money, transactions, business, services, work, transport tickets
    ritual      — ceremony, religion, tradition, formal event observance

CRITICAL:
- A word like "革" (leather) is physical. Don't add unrelated domains.
- A word like "願う" (wish/hope) is emotional+ritual; rarely physical.
- A grammar like "～恐れがある" (risk of) is abstract; don't tag it physical.
- Pick the SMALLEST domain set that's truly accurate. 1-2 domains typical, 3-4 only when the word genuinely spans.
- Output STRICT JSON matching the schema. No prose.`;

interface VocabItemRaw {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  partOfSpeech: string;
  scenarioTags: string[];
  register?: string;
  domain?: string[];
}
interface GrammarItemRaw {
  id: string;
  pattern: string;
  meaning: string;
  formation: string;
  scenarioTags: string[];
  register?: string;
  domain?: string[];
}

function buildVocabPrompt(items: VocabItemRaw[]): string {
  const lines = items.map(
    (v) =>
      `- id="${v.id}"  word="${v.word}"  reading="${v.reading}"  pos="${v.partOfSpeech}"  meaning="${v.meaning}"  tags=${JSON.stringify(v.scenarioTags)}`,
  );
  return `Tag these ${items.length} VOCAB items. Output JSON only.

${lines.join("\n")}

Output schema:
{ "items": [{ "id": "...", "register": "...", "domain": ["..."] }, ...] }`;
}

function buildGrammarPrompt(items: GrammarItemRaw[]): string {
  const lines = items.map(
    (g) =>
      `- id="${g.id}"  pattern="${g.pattern}"  meaning="${g.meaning}"  formation="${g.formation}"  tags=${JSON.stringify(g.scenarioTags)}`,
  );
  return `Tag these ${items.length} GRAMMAR items. Output JSON only.

${lines.join("\n")}

Output schema:
{ "items": [{ "id": "...", "register": "...", "domain": ["..."] }, ...] }`;
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

async function enrichBatch<T extends VocabItemRaw | GrammarItemRaw>(
  client: GeminiClient,
  items: T[],
  kind: "vocab" | "grammar",
): Promise<Map<string, { register: string; domain: string[] }>> {
  const user = kind === "vocab" ? buildVocabPrompt(items as VocabItemRaw[]) : buildGrammarPrompt(items as GrammarItemRaw[]);
  const { text } = await client.complete({
    system: SYSTEM,
    user,
    maxTokens: 8192,
    responseMimeType: "application/json",
  });
  const parsed = EnrichedBatch.parse(JSON.parse(stripFences(text)));
  const out = new Map<string, { register: string; domain: string[] }>();
  for (const i of parsed.items) out.set(i.id, { register: i.register, domain: i.domain });
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const vocab: VocabItemRaw[] = JSON.parse(readFileSync(join(root, "data", "vocab.json"), "utf8"));
  const grammar: GrammarItemRaw[] = JSON.parse(readFileSync(join(root, "data", "grammar.json"), "utf8"));

  const vocabTodo = vocab.filter((v) => !v.register || !v.domain);
  const grammarTodo = grammar.filter((g) => !g.register || !g.domain);
  const vocabBatches = opts.target !== "grammar" ? chunk(vocabTodo, opts.batchSize) : [];
  const grammarBatches = opts.target !== "vocab" ? chunk(grammarTodo, opts.batchSize) : [];

  console.log(`[enrich] vocab to tag: ${vocabTodo.length} (already tagged: ${vocab.length - vocabTodo.length})`);
  console.log(`[enrich] grammar to tag: ${grammarTodo.length} (already tagged: ${grammar.length - grammarTodo.length})`);
  console.log(`[enrich] batches: vocab=${vocabBatches.length}, grammar=${grammarBatches.length}, batchSize=${opts.batchSize}`);

  if (!opts.apply) {
    console.log("[enrich] DRY RUN — pass --apply to run the LLM");
    return;
  }

  const client = new GeminiClient();

  // ---- vocab ----
  const vocabUpdates = new Map<string, { register: string; domain: string[] }>();
  for (let i = 0; i < vocabBatches.length; i++) {
    const batch = vocabBatches[i];
    process.stdout.write(`  [vocab ${i + 1}/${vocabBatches.length}] ${batch.length} items… `);
    try {
      const result = await enrichBatch(client, batch, "vocab");
      for (const [id, fields] of result) vocabUpdates.set(id, fields);
      console.log(`ok (${result.size}/${batch.length})`);
    } catch (err) {
      console.log(`FAIL: ${(err as Error).message}`);
    }
  }
  if (vocabUpdates.size > 0) {
    const out = vocab.map((v) => {
      const upd = vocabUpdates.get(v.id);
      return upd ? { ...v, register: upd.register, domain: upd.domain } : v;
    });
    writeFileSync(join(root, "data", "vocab.json"), JSON.stringify(out, null, 2) + "\n");
    console.log(`[enrich] wrote ${vocabUpdates.size} vocab updates`);
  }

  // ---- grammar ----
  const grammarUpdates = new Map<string, { register: string; domain: string[] }>();
  for (let i = 0; i < grammarBatches.length; i++) {
    const batch = grammarBatches[i];
    process.stdout.write(`  [grammar ${i + 1}/${grammarBatches.length}] ${batch.length} items… `);
    try {
      const result = await enrichBatch(client, batch, "grammar");
      for (const [id, fields] of result) grammarUpdates.set(id, fields);
      console.log(`ok (${result.size}/${batch.length})`);
    } catch (err) {
      console.log(`FAIL: ${(err as Error).message}`);
    }
  }
  if (grammarUpdates.size > 0) {
    const out = grammar.map((g) => {
      const upd = grammarUpdates.get(g.id);
      return upd ? { ...g, register: upd.register, domain: upd.domain } : g;
    });
    writeFileSync(join(root, "data", "grammar.json"), JSON.stringify(out, null, 2) + "\n");
    console.log(`[enrich] wrote ${grammarUpdates.size} grammar updates`);
  }

  console.log("[enrich] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
