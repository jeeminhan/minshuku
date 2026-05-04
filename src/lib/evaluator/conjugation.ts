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

// Simplest v0 pattern check: does the tokenized output contain a token
// whose surface_form OR basic_form equals the pattern?
export async function containsPattern(text: string, pattern: string): Promise<boolean> {
  const tokens = await tokenize(text);
  return tokens.some(
    (t) => t.surface_form === pattern || t.basic_form === pattern,
  );
}
