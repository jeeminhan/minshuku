import kuromoji from "kuromoji";
import { join } from "node:path";

export interface KuromojiToken {
  word_id: number;
  word_type: string;
  word_position: number;
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
  conjugated_type: string;
  conjugated_form: string;
  basic_form: string;
  reading: string | undefined;
  pronunciation: string | undefined;
}

let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;

function getTokenizer(): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
  if (tokenizerPromise) return tokenizerPromise;
  // kuromoji ships its dictionary inside node_modules.
  const dicPath = join(
    process.cwd(),
    "node_modules",
    "kuromoji",
    "dict",
  );
  tokenizerPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err) return reject(err);
      resolve(tokenizer);
    });
  });
  return tokenizerPromise;
}

export async function tokenize(text: string): Promise<KuromojiToken[]> {
  const t = await getTokenizer();
  return t.tokenize(text) as unknown as KuromojiToken[];
}

// Strip JLPT-style decorations from a pattern so it compares against actual
// learner output. Examples: "～間" → "間", "～あげく(に)" → "あげく",
// "が早いか" → "が早いか" (unchanged).
export function normalizePattern(pattern: string): string {
  return pattern
    .replace(/^[～~]+/, "")
    .replace(/（[^）]*）|\([^)]*\)/g, "")
    .trim();
}

// Split a pattern with slash alternatives into individual surface forms.
// Examples:
//   "～やすい/にくい"                          → ["やすい", "にくい"]
//   "～かねる/かねない"                        → ["かねる", "かねない"]
//   "～甲斐があって/甲斐がある/甲斐がない/甲斐もなく"
//                                             → ["甲斐があって", "甲斐がある",
//                                                "甲斐がない", "甲斐もなく"]
//   "つもり"                                   → ["つもり"]
export function patternAlternatives(pattern: string): string[] {
  const normalized = normalizePattern(pattern);
  if (!normalized) return [];
  if (!normalized.includes("/")) return [normalized];
  return normalized
    .split("/")
    .map((p) => p.replace(/^[～~]+/, "").trim())
    .filter((p) => p.length > 0);
}

// v0 pattern check: does the text contain ANY of the pattern's normalized
// alternatives as a substring, OR does the tokenized output contain a token
// whose surface_form or basic_form equals one of them? Substring fallback
// covers multi-character patterns that kuromoji may split into multiple tokens.
export async function containsPattern(text: string, pattern: string): Promise<boolean> {
  const alternatives = patternAlternatives(pattern);
  if (alternatives.length === 0) return false;
  for (const alt of alternatives) {
    if (text.includes(alt)) return true;
  }
  const tokens = await tokenize(text);
  return tokens.some((t) =>
    alternatives.some((alt) => t.surface_form === alt || t.basic_form === alt),
  );
}
