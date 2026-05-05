// Bulk-enrich JLPT vocab + grammar from open sources via Gemini.
//
// Modes:
//   tsx scripts/import-jlpt.ts --sample 5            → 5 items / level, stdout only
//   tsx scripts/import-jlpt.ts --full                → 80 vocab + 20 grammar / level, writes data/
//   tsx scripts/import-jlpt.ts --full --levels N3,N2 → only listed levels
//
// Sources:
//   vocab   https://jlpt-vocab-api.vercel.app  (CC-BY)
//   grammar https://github.com/Hanekawa-00/JLPT-Grammar (community-maintained)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { GeminiClient, type LLMClient } from "../src/lib/llm/client.js";
import type { GrammarItem, JlptLevel, VocabItem } from "../src/lib/types.js";

// ---------- constants ----------

const LEVELS: readonly JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"] as const;
const LEVEL_NUM: Record<JlptLevel, number> = { N5: 5, N4: 4, N3: 3, N2: 2, N1: 1 };
const VOCAB_API = "https://jlpt-vocab-api.vercel.app/api/words";
const GRAMMAR_URL =
  "https://raw.githubusercontent.com/Hanekawa-00/JLPT-Grammar/main/jlpt_grammar_full.json";

const FULL_VOCAB_PER_LEVEL = 80;
const FULL_GRAMMAR_PER_LEVEL = 20;
const BATCH_SIZE = 10;

// Concrete tags only. "everyday" was deliberately removed — it became a
// 41% catch-all in spot-check. Force the LLM to pick a real category.
const ALLOWED_TAGS = [
  "minshuku", "evening", "morning", "weekend", "weather", "planning",
  "permission", "soft-magical", "school", "work", "restaurant", "shopping",
  "transport", "family", "formal", "casual", "health", "travel", "food",
  "feelings", "directions", "introductions", "home", "nature", "hobbies",
] as const;

const POS_VALUES = [
  "noun", "godan-verb", "ichidan-verb", "irregular-verb", "i-adjective",
  "na-adjective", "adverb", "particle", "expression", "interjection",
  "conjunction", "prefix", "suffix", "counter", "pronoun",
] as const;

const DATA_DIR = join(process.cwd(), "data");
const VOCAB_PATH = join(DATA_DIR, "vocab.json");
const GRAMMAR_PATH = join(DATA_DIR, "grammar.json");

// ---------- CLI ----------

interface CliOptions {
  mode: "sample" | "full";
  sampleSize: number;
  levels: readonly JlptLevel[];
}

function parseArgs(argv: readonly string[]): CliOptions {
  let mode: "sample" | "full" | null = null;
  let sampleSize = 5;
  let levels: JlptLevel[] = [...LEVELS];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sample") {
      mode = "sample";
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) {
        sampleSize = n;
        i++;
      }
    } else if (a === "--full") {
      mode = "full";
    } else if (a === "--levels" || a?.startsWith("--levels=")) {
      const value = a.includes("=") ? a.split("=", 2)[1] : argv[++i];
      if (!value) throw new Error("--levels requires a value");
      levels = value.split(",").map((s) => {
        const lvl = s.trim().toUpperCase() as JlptLevel;
        if (!LEVELS.includes(lvl)) throw new Error(`invalid level: ${s}`);
        return lvl;
      });
    }
  }
  if (!mode) throw new Error("usage: --sample N | --full [--levels N3,N2]");
  return { mode, sampleSize, levels };
}

// ---------- source fetchers ----------

interface VocabSource {
  word: string;
  meaning: string;
  furigana: string;
  romaji: string;
  level: number;
}

interface GrammarSource {
  level: string;
  grammar_point: string;
  meaning_cn: string;
  usage: string;
  example_ja: string;
}

// Strip scraping artifacts: △ markers, full-width spaces inside words,
// trailing/leading whitespace, stray \r.
function cleanJa(s: string): string {
  return s
    .replace(/[△▲]/g, "")
    .replace(/\r/g, "")
    .replace(/\s+/g, (m) => (/[　\s]/.test(m) ? "" : m))
    .trim();
}

// Drop Hanekawa entries that are abstract structural templates rather than
// learnable patterns (e.g. "名词1＋は＋名词2＋です").
function isLearnablePattern(p: string): boolean {
  if (/^[名动形]词?\d?＋/.test(p)) return false;
  if (p.includes("名词1") || p.includes("名词2") || p.includes("动词1")) return false;
  return p.length > 0;
}

async function fetchVocabPage(level: JlptLevel, offset: number, limit: number): Promise<VocabSource[]> {
  const url = `${VOCAB_API}?level=${LEVEL_NUM[level]}&offset=${offset}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`vocab fetch ${level} offset=${offset}: ${r.status}`);
  const j = (await r.json()) as { words: VocabSource[] };
  return j.words;
}

async function fetchVocab(level: JlptLevel, count: number): Promise<VocabSource[]> {
  // Page through API to avoid hitting any single-request cap.
  const out: VocabSource[] = [];
  const PAGE = 50;
  for (let offset = 0; out.length < count; offset += PAGE) {
    const page = await fetchVocabPage(level, offset, Math.min(PAGE, count - out.length));
    if (page.length === 0) break;
    out.push(...page);
  }
  return out.slice(0, count);
}

let grammarCache: GrammarSource[] | null = null;
async function fetchGrammar(level: JlptLevel, count: number): Promise<GrammarSource[]> {
  if (!grammarCache) {
    const r = await fetch(GRAMMAR_URL);
    if (!r.ok) throw new Error(`grammar fetch: ${r.status}`);
    grammarCache = (await r.json()) as GrammarSource[];
  }
  return grammarCache
    .filter((g) => g.level === level && isLearnablePattern(g.grammar_point))
    .slice(0, count);
}

// ---------- enrichment via Gemini ----------

const VocabEnrichItem = z.object({
  word: z.string(),
  partOfSpeech: z.enum(POS_VALUES),
  scenarioTags: z.array(z.string()).min(1).max(4),
  exampleSentences: z.array(z.string()).min(2).max(3),
});

const VocabEnrichResp = z.object({ items: z.array(VocabEnrichItem) });

const GrammarEnrichItem = z.object({
  pattern: z.string(),
  meaning: z.string(),
  formation: z.string(),
  scenarioTags: z.array(z.string()).min(1).max(4),
  exampleSentences: z.array(z.string()).min(2).max(3),
  commonMistakes: z.array(z.string()).max(2).optional(),
});

const GrammarEnrichResp = z.object({ items: z.array(GrammarEnrichItem) });

const TAG_GUIDANCE = `Allowed scenarioTags (lowercase kebab-case): ${ALLOWED_TAGS.join(", ")}. Pick the most concrete tags that genuinely apply (where the word is used, what topic, what register). 1-3 tags per item — prefer 1 specific tag over 3 vague ones. Only invent a new tag if none of these fit. Do NOT use "everyday" as a fallback; if no concrete tag fits, return just the single best-fitting one.`;

const REGISTER_GUIDANCE: Record<JlptLevel, string> = {
  N5: "Use very simple casual or です/ます polite forms. Short sentences (5-10 words).",
  N4: "Casual or polite. Sentences slightly longer; basic connectives like から, けど.",
  N3: "Mixed register. Natural conversation; intermediate connectives and modifiers.",
  N2: "Advanced patterns acceptable. Sentences should feel like real adult speech, written or spoken.",
  N1: "Sophisticated patterns; literary, formal, or idiomatic registers welcome.",
};

async function callJson<T>(
  client: LLMClient,
  system: string,
  user: string,
  parser: (raw: unknown) => T,
  label: string,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { text } = await client.complete({
        system,
        user,
        responseMimeType: "application/json",
        maxTokens: 4096,
      });
      return parser(JSON.parse(stripFences(text)));
    } catch (err) {
      lastErr = err;
      console.error(`  ! ${label} attempt ${attempt} failed: ${(err as Error).message.slice(0, 120)}`);
    }
  }
  throw lastErr;
}

async function enrichVocabBatch(
  client: LLMClient,
  level: JlptLevel,
  batch: readonly VocabSource[],
): Promise<z.infer<typeof VocabEnrichResp>> {
  const system = `You enrich a Japanese vocabulary dataset for a language-learning game.
For each item, output:
- partOfSpeech: one of [${POS_VALUES.join(", ")}]
- scenarioTags: 1-3 tags. ${TAG_GUIDANCE}
- exampleSentences: exactly 2 short, natural Japanese sentences using the word, suited to JLPT ${level}. ${REGISTER_GUIDANCE[level]}
Return JSON {items:[{word, partOfSpeech, scenarioTags, exampleSentences}]} preserving input order. The "word" field must match input exactly. Output valid JSON only — no markdown, no commentary.`;
  const user = `Level: ${level}\nItems:\n${batch
    .map((b) => `- ${b.word} (${b.furigana}) — ${b.meaning}`)
    .join("\n")}`;
  return callJson(client, system, user, (raw) => VocabEnrichResp.parse(raw), `vocab-${level}`);
}

async function enrichGrammarBatch(
  client: LLMClient,
  level: JlptLevel,
  batch: readonly GrammarSource[],
): Promise<z.infer<typeof GrammarEnrichResp>> {
  const system = `You enrich a Japanese grammar dataset for a language-learning game.
For each grammar pattern, output:
- pattern: copy the input grammar_point exactly
- meaning: short English gloss (5-15 words). Do NOT translate from Chinese; derive from the pattern + usage + example.
- formation: rewrite the input "usage" using English grammar terms. Examples: "Verb dictionary form + つもりです", "Verb te-form + もいい", "Noun + あっての + Noun". No Chinese characters like 动词/名词/形容词.
- scenarioTags: 1-3 tags. ${TAG_GUIDANCE}
- exampleSentences: 2 natural Japanese sentences using the pattern, suited to JLPT ${level}. ${REGISTER_GUIDANCE[level]}
- commonMistakes (optional): 0-2 short notes about typical learner errors. Either English or Japanese is fine.
Return JSON {items:[{pattern, meaning, formation, scenarioTags, exampleSentences, commonMistakes?}]}. Output valid JSON only — no markdown, no commentary.`;
  const user = `Level: ${level}\nItems:\n${batch
    .map((b) => `- pattern: ${b.grammar_point}\n  usage: ${b.usage}\n  example: ${b.example_ja}`)
    .join("\n\n")}`;
  return callJson(client, system, user, (raw) => GrammarEnrichResp.parse(raw), `grammar-${level}`);
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

// ---------- assembly ----------

// Convert macrons to doubled vowels, drop everything past middle-dot,
// keep only [a-z0-9-]. e.g. "dōkan" → "doukan", "koshō・suru" → "koshou".
function slugifyRomaji(r: string): string {
  return r
    .toLowerCase()
    .replace(/ā/g, "aa").replace(/ī/g, "ii").replace(/ū/g, "uu")
    .replace(/ē/g, "ee").replace(/ō/g, "ou")
    .split("・")[0]
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Hiragana → Hepburn fallback for when romaji is empty (rare) or unusable.
function hiraganaToRomaji(s: string): string {
  const m: Record<string, string> = {
    あ:"a",い:"i",う:"u",え:"e",お:"o",
    か:"ka",き:"ki",く:"ku",け:"ke",こ:"ko",
    さ:"sa",し:"shi",す:"su",せ:"se",そ:"so",
    た:"ta",ち:"chi",つ:"tsu",て:"te",と:"to",
    な:"na",に:"ni",ぬ:"nu",ね:"ne",の:"no",
    は:"ha",ひ:"hi",ふ:"fu",へ:"he",ほ:"ho",
    ま:"ma",み:"mi",む:"mu",め:"me",も:"mo",
    や:"ya",ゆ:"yu",よ:"yo",
    ら:"ra",り:"ri",る:"ru",れ:"re",ろ:"ro",
    わ:"wa",を:"wo",ん:"n",
    が:"ga",ぎ:"gi",ぐ:"gu",げ:"ge",ご:"go",
    ざ:"za",じ:"ji",ず:"zu",ぜ:"ze",ぞ:"zo",
    だ:"da",ぢ:"ji",づ:"zu",で:"de",ど:"do",
    ば:"ba",び:"bi",ぶ:"bu",べ:"be",ぼ:"bo",
    ぱ:"pa",ぴ:"pi",ぷ:"pu",ぺ:"pe",ぽ:"po",
  };
  return [...s].map((c) => m[c] ?? c).join("").replace(/[^a-z0-9]+/g, "");
}

function buildVocab(level: JlptLevel, src: VocabSource, enr: z.infer<typeof VocabEnrichItem>): VocabItem {
  const slug =
    slugifyRomaji(src.romaji) ||
    slugifyRomaji(hiraganaToRomaji(src.furigana)) ||
    slugifyRomaji(src.word);
  // Katakana-only words come back with empty furigana from the API; fall
  // back to the word itself so reading is always non-empty.
  const reading = src.furigana.trim() || src.word;
  return {
    id: `vocab.${level.toLowerCase()}.${slug}`,
    word: src.word,
    reading,
    meaning: src.meaning,
    partOfSpeech: enr.partOfSpeech,
    jlptLevel: level,
    scenarioTags: enr.scenarioTags,
    exampleSentences: enr.exampleSentences.map(cleanJa),
  };
}

function buildGrammar(
  level: JlptLevel,
  src: GrammarSource,
  enr: z.infer<typeof GrammarEnrichItem>,
  index: number,
): GrammarItem {
  const padded = String(index + 1).padStart(3, "0");
  // Drop the source example_ja because Hanekawa scrapes carry △ markers and
  // injected spacing that survive cleaning poorly. Use Gemini-generated
  // examples only — they're consistently clean.
  return {
    id: `grammar.${level.toLowerCase()}.${padded}`,
    pattern: cleanJa(src.grammar_point),
    meaning: enr.meaning,
    jlptLevel: level,
    formation: enr.formation,
    scenarioTags: enr.scenarioTags,
    exampleSentences: enr.exampleSentences.map(cleanJa),
    commonMistakes: enr.commonMistakes,
  };
}

async function processLevel(
  client: LLMClient,
  level: JlptLevel,
  vocabCount: number,
  grammarCount: number,
): Promise<{ vocab: VocabItem[]; grammar: GrammarItem[] }> {
  console.error(`[${level}] fetching ${vocabCount} vocab + ${grammarCount} grammar…`);
  const [vSrc, gSrc] = await Promise.all([fetchVocab(level, vocabCount), fetchGrammar(level, grammarCount)]);

  const vocab: VocabItem[] = [];
  for (let i = 0; i < vSrc.length; i += BATCH_SIZE) {
    const batch = vSrc.slice(i, i + BATCH_SIZE);
    console.error(`[${level}] vocab batch ${i / BATCH_SIZE + 1}/${Math.ceil(vSrc.length / BATCH_SIZE)}`);
    const enr = await enrichVocabBatch(client, level, batch);
    if (enr.items.length !== batch.length) {
      console.error(`  ! batch size mismatch: in=${batch.length} out=${enr.items.length}`);
    }
    batch.forEach((src, i) => {
      const e = enr.items[i];
      if (!e) return;
      vocab.push(buildVocab(level, src, e));
    });
  }

  const grammar: GrammarItem[] = [];
  for (let i = 0; i < gSrc.length; i += BATCH_SIZE) {
    const batch = gSrc.slice(i, i + BATCH_SIZE);
    console.error(`[${level}] grammar batch ${i / BATCH_SIZE + 1}/${Math.ceil(gSrc.length / BATCH_SIZE)}`);
    const enr = await enrichGrammarBatch(client, level, batch);
    if (enr.items.length !== batch.length) {
      console.error(`  ! batch size mismatch: in=${batch.length} out=${enr.items.length}`);
    }
    batch.forEach((src, j) => {
      const e = enr.items[j];
      if (!e) return;
      grammar.push(buildGrammar(level, src, e, grammar.length + j));
    });
  }

  return { vocab, grammar };
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((x) => x.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }
  return merged;
}

function loadExisting<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as T[];
}

// ---------- main ----------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const client = new GeminiClient();
  const vocabPerLevel = opts.mode === "full" ? FULL_VOCAB_PER_LEVEL : opts.sampleSize;
  const grammarPerLevel = opts.mode === "full"
    ? FULL_GRAMMAR_PER_LEVEL
    : Math.max(1, Math.floor(opts.sampleSize / 4));

  const allVocab: VocabItem[] = [];
  const allGrammar: GrammarItem[] = [];
  for (const level of opts.levels) {
    const { vocab, grammar } = await processLevel(client, level, vocabPerLevel, grammarPerLevel);
    allVocab.push(...vocab);
    allGrammar.push(...grammar);
  }

  if (opts.mode === "sample") {
    process.stdout.write(JSON.stringify({ vocab: allVocab, grammar: allGrammar }, null, 2));
    process.stdout.write("\n");
    console.error(`\n--sample produced ${allVocab.length} vocab + ${allGrammar.length} grammar (no files written)`);
    return;
  }

  const mergedVocab = mergeById(loadExisting<VocabItem>(VOCAB_PATH), allVocab);
  const mergedGrammar = mergeById(loadExisting<GrammarItem>(GRAMMAR_PATH), allGrammar);
  writeFileSync(VOCAB_PATH, JSON.stringify(mergedVocab, null, 2) + "\n");
  writeFileSync(GRAMMAR_PATH, JSON.stringify(mergedGrammar, null, 2) + "\n");
  console.error(
    `wrote ${mergedVocab.length} vocab (+${allVocab.length}) and ${mergedGrammar.length} grammar (+${allGrammar.length})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
