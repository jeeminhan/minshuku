// Full-day proof-of-concept: two errands, one debrief.
//
// You go on two errands in the real world (which Aoi calls "dreams"), then
// return to the meadow to tell her about both. She remembers them together
// and asks one philosophical question that bridges them.
//
// This is the daily-loop architecture for the dream-sister design,
// compressed into a single playable session.
//
// Run with:
//   npm run day
//   npm run day -- --no-music             # silent
//   npm run day -- --no-tts               # text only
//   npm run day -- --aoi-voice Despina    # swap Aoi's voice
//   npm run day -- --meadow-bed tmp/sample-shrine.wav   # custom paradise bed
//
// Aoi uses a younger style cue + Leda by default (was Aoede — too old).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import "dotenv/config";

import { synthesizeSpeech } from "../src/lib/audio/tts.js";
import { GeminiClient } from "../src/lib/llm/client.js";

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------

const VOICE_BOOKSHOP = "Iapetus";       // bookshop owner: calm, formal-male
const VOICE_VENDOR = "Kore";            // market vendor: warm middle-aged
const VOICE_NARRATOR = "Algenib";       // calm, neutral — for coach + scene narration
const DEFAULT_AOI_VOICE = "Leda";       // softer than Aoede, less adult than Kore

// Style prefix sent to Gemini TTS to push Aoi younger/smaller without
// changing the underlying voice. Gemini responds to natural-language
// stage directions before the text.
const AOI_STYLE_PREFIX =
  "Speak softly, slowly, in the voice of a small, gentle, blind young girl. Almost a half-whisper. ";

// Text-generation model. gemini-flash-latest currently routes to Gemini 3.1
// Flash, which is materially better at long-context Japanese than 2.5.
// Override with --model if needed.
const DEFAULT_TEXT_MODEL = "gemini-flash-latest";

// ---------------------------------------------------------------------------
// Beds (existing pre-rendered samples — no Lyria generation by default)
// ---------------------------------------------------------------------------

const DEFAULT_MEADOW_BED = "tmp/sample-minshuku.wav";  // soft Japanese folk works for paradise
const BOOKSHOP_BED = "tmp/sample-bookshop.wav";
const MARKET_BED = "tmp/sample-cafe.wav";              // closest existing bustle sample
const BED_VOLUME_ERRAND = "0.20";
const BED_VOLUME_MEADOW = "0.16";

// ---------------------------------------------------------------------------
// Errand definitions
// ---------------------------------------------------------------------------
//
// Each errand is a lightweight LLM-driven vignette. We don't use the full
// scene-template pipeline here — for the POC, we want the *sequence* to be
// tight and the focus on what flows into Aoi's debrief.

// A single coaching beat. Rendered before each player turn.
// The example sentence is TTS-spoken in the narrator voice so the player
// hears the rhythm before they type.
interface ErrandStep {
  prompt: string;       // English coaching: what to do this turn
  grammar: string;      // grammar forms to use, with English gloss
  vocab: readonly { word: string; gloss: string }[];
  exampleJa: string;    // sample sentence — heard, not just read
}

interface ErrandConfig {
  id: string;
  label: string;
  bed: string;
  npcSpeaker: string;
  npcVoice: string;
  npcPersona: string;
  missionEn: string;
  missionJa: string;
  // The high-level strategy — orientation only. Detailed coaching is per-step.
  strategy: string;
  opener: string;
  // The coaching beats. One step per player turn. Length determines turn count.
  steps: readonly ErrandStep[];
}

const ERRAND_BOOKSHOP: ErrandConfig = {
  id: "bookshop",
  label: "the quiet bookshop on the side street",
  bed: BOOKSHOP_BED,
  npcSpeaker: "owner",
  npcVoice: VOICE_BOOKSHOP,
  npcPersona: [
    "You are the owner of a small, quiet bookshop on a side street in a small Japanese town.",
    "You are around 65, soft-spoken, formal but warm. You know your shelves intimately.",
    "You stock Japanese poetry: 谷川俊太郎, 茨木のり子, 高村光太郎, 宮沢賢治.",
    "Speak in polite Japanese (です/ます). Replies are 1–2 complete sentences.",
    "If the customer says who the book is for, react warmly with one short comment.",
    "If they're looking for 谷川俊太郎, you have 『二十億光年の孤独』 in stock. If not, recommend 茨木のり子『自分の感受性くらい』.",
    "Never break character. Never use English. Always finish your sentences.",
  ].join("\n"),
  missionEn: "It's mom's birthday next week. Buy a Tanikawa Shuntarou poetry collection for her. If they don't have one, ask the owner to recommend something similar.",
  missionJa: "来週、母の誕生日。谷川俊太郎の詩集を買いたい。なければ、似ている詩人をすすめてもらう。",
  strategy:
    "Lead with who the gift is for and the occasion. Name the poet. The owner will help if you give them something to work with.",
  opener: "いらっしゃいませ。何かお探しですか？",
  steps: [
    {
      prompt: "Tell the owner who the gift is for, and what poet you want.",
      grammar: "～を探しています (I'm looking for ~)",
      vocab: [{ word: "詩集", gloss: "poetry collection" }],
      exampleJa: "母の誕生日のプレゼントに、谷川俊太郎の詩集を探しています。",
    },
    {
      prompt: "Ask if they have it. If not, ask for a similar recommendation.",
      grammar: "もし～なかったら (if not, ~)",
      vocab: [{ word: "おすすめ", gloss: "recommendation" }],
      exampleJa: "もしなかったら、似ている詩人を一冊おすすめしていただけますか？",
    },
    {
      prompt: "Ask what kind of poems are inside.",
      grammar: "どんな～ですか (what kind of ~?)",
      vocab: [{ word: "入っている", gloss: "is inside / included" }],
      exampleJa: "この詩集には、どんな詩が入っていますか？",
    },
  ],
};

const ERRAND_MARKET: ErrandConfig = {
  id: "market",
  label: "the morning market by the river",
  bed: MARKET_BED,
  npcSpeaker: "vendor",
  npcVoice: VOICE_VENDOR,
  npcPersona: [
    "You are a vendor at the morning market by the river. Around 50, warm and busy.",
    "You sell freshly baked bread (パン), あんパン, クリームパン, and seasonal items.",
    "Today's あんパン are still warm from the oven — you mention this when relevant.",
    "Speak in friendly polite Japanese with occasional casual touches (〜よ、〜ね). 1–2 complete sentences.",
    "If the customer mentions who they're buying for, react warmly with one short comment.",
    "If they ask for a count, confirm: 「二つですね」 etc.",
    "Never break character. Never use English. Always finish your sentences.",
  ].join("\n"),
  missionEn: "Your younger sister loves warm anpan. Buy two — one for her, one for you. Confirm they're still warm and order by counter.",
  missionJa: "妹の好きな、温かいあんパンを二つ買う。一つは妹に、一つは自分に。",
  strategy:
    "Confirm they're warm. Say who one is for. Order two using the counter 二つ. Be brief and polite.",
  opener: "おはようございます！今朝、いいパンが焼けたんですよ。",
  steps: [
    {
      prompt: "Greet, then ask if today's anpan are still warm.",
      grammar: "まだ～ですか (still ~?)",
      vocab: [{ word: "温かい", gloss: "warm" }],
      exampleJa: "おはようございます。今日のあんパンは、まだ温かいですか？",
    },
    {
      prompt: "Tell the vendor who you're buying for, and that you want to buy.",
      grammar: "～なんです (it's that ~ / explanatory)",
      vocab: [{ word: "妹", gloss: "younger sister" }],
      exampleJa: "妹の好きなあんパンを買いたいんです。",
    },
    {
      prompt: "Order two — one for her, one for you. Use the counter 二つ.",
      grammar: "～を二つください (two of ~, please)",
      vocab: [{ word: "二つ", gloss: "two (small-thing counter)" }],
      exampleJa: "じゃあ、あんパンを二つください。一つは妹に、もう一つは自分に。",
    },
  ],
};

// ---------------------------------------------------------------------------
// Aoi's knowledge — knowledge-mirror constraint
// ---------------------------------------------------------------------------

const AOI_VOCAB: readonly string[] = [
  "お兄ちゃん", "妹", "母", "友達", "人",
  "気持ち", "心", "声", "顔", "手",
  "嬉しい", "寂しい", "怖い", "優しい", "不思議",
  "朝", "夜", "風", "光", "暖かい", "静か",
  "食べ物", "美味しい", "本", "詩", "言葉", "夢",
  "食べる", "読む", "書く", "聞く", "話す",
  "笑う", "泣く", "思い出す", "覚える", "教える",
  "買う", "あげる", "もらう", "一緒",
];

const AOI_GRAMMAR: readonly { form: string; example: string }[] = [
  { form: "ます形 (polite)", example: "食べます、行きます" },
  { form: "～から / ～ので (because)", example: "嬉しいから、笑った" },
  { form: "こと / もの nominalizer", example: "本を読むことが好き" },
  { form: "～たい (want to)", example: "話したい" },
  { form: "～ても (even if)", example: "怖くても、行く" },
  { form: "～たり～たり (X-ing and Y-ing)", example: "笑ったり泣いたり" },
  { form: "～たら (if/when)", example: "美味しかったら、嬉しい" },
  { form: "～たことがある (have experienced)", example: "見たことがある" },
  { form: "って (quotation / topic)", example: "「友達」って、何？" },
  { form: "～みたい (seems like)", example: "夢みたい" },
];

// Authored Aoi openings — picked at random per session. By having these
// pre-written we eliminate one LLM call (and prefetch the TTS so playback
// is instant when we reach the meadow).
const AOI_OPENERS: readonly string[] = [
  "お兄ちゃん、おかえり。今日の夢、どんな感じだった？",
  "お兄ちゃん、おかえり。今日も、夢の中、どこか行ったの？",
  "おかえり、お兄ちゃん。今日の夢の話、聞かせてほしい。",
];

const AOI_CLOSERS: readonly string[] = [
  "お兄ちゃん、ありがとう。今日の夢、覚えておくね。",
  "お兄ちゃん、また話してね。今日の言葉、嬉しかった。",
  "うん。お兄ちゃんの夢、ちょっと分かった気がする。",
];

// Meadow coaching — minimal grammar+vocab hint shown before each player
// turn in the debrief. Keeps the form light because the conversation context
// makes the "what to say" implicit.
const MEADOW_COACH_TURN_1 = {
  grammar: "～たり～たり (sometimes X, sometimes Y)",
  vocab: [
    { word: "行く", gloss: "to go" },
    { word: "買う", gloss: "to buy" },
  ],
};

const MEADOW_COACH_TURN_2 = {
  grammar: "～と思う (I think that ~)",
  vocab: [
    { word: "気持ち", gloss: "feeling" },
    { word: "大切", gloss: "important / precious" },
  ],
};

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  noMusic: boolean;
  noTts: boolean;
  aoiVoice: string;
  meadowBed: string;
  textModel: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = {
    noMusic: false,
    noTts: false,
    aoiVoice: DEFAULT_AOI_VOICE,
    meadowBed: DEFAULT_MEADOW_BED,
    textModel: DEFAULT_TEXT_MODEL,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = (): string => {
      const v = argv[++i];
      if (!v) throw new Error(`Missing value for ${arg}`);
      return v;
    };
    if (arg === "--no-music") opts.noMusic = true;
    else if (arg === "--no-tts") opts.noTts = true;
    else if (arg === "--aoi-voice") opts.aoiVoice = take();
    else if (arg === "--meadow-bed") opts.meadowBed = take();
    else if (arg === "--model") opts.textModel = take();
    else if (arg === "--help" || arg === "-h") {
      stdout.write(
        [
          "Day POC — two errands + one meadow debrief with Aoi.",
          "",
          "  --no-music              Disable ambient beds",
          "  --no-tts                Disable all voice",
          "  --aoi-voice <name>      Swap Aoi's voice (default Leda)",
          "  --meadow-bed <path>     Custom paradise bed (default tmp/sample-minshuku.wav)",
          "  --model <name>          Text model (default gemini-flash-latest = 3.1 Flash)",
          "",
          "Try other Aoi voices:",
          "  Leda · Despina · Vindemiatrix · Erinome · Callirrhoe · Autonoe",
          "",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Styling + audio helpers
// ---------------------------------------------------------------------------

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  italic: "\x1b[3m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
} as const;

const c = (color: keyof typeof C, text: string): string =>
  `${C[color]}${text}${C.reset}`;
const out = (text = ""): void => {
  stdout.write(text + "\n");
};
const pause = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

interface BedLoop {
  stop: () => void;
}

function loopBed(path: string, volume: string): BedLoop {
  let stopped = false;
  let current: ChildProcess | null = null;
  const tick = (): void => {
    if (stopped) return;
    current = spawn("afplay", ["-v", volume, path], { stdio: "ignore" });
    current.on("exit", () => {
      if (!stopped) tick();
    });
    current.on("error", () => {
      /* swallow */
    });
  };
  tick();
  return {
    stop: () => {
      stopped = true;
      if (current && !current.killed) current.kill("SIGTERM");
    },
  };
}

function playWav(path: string): Promise<void> {
  return new Promise((resolveDone, rejectDone) => {
    const child = spawn("afplay", [path], { stdio: "ignore" });
    child.on("error", rejectDone);
    child.on("exit", (code) => {
      if (code === 0) resolveDone();
      else rejectDone(new Error(`afplay exited with code ${code}`));
    });
  });
}

interface AudioCtx {
  enabled: boolean;
  apiKey: string;
  scratchDir: string;
}

async function speak(
  audio: AudioCtx,
  text: string,
  voice: string,
  stylePrefix = "",
): Promise<void> {
  if (!audio.enabled) return;
  try {
    const wav = await synthesizeSpeech({
      apiKey: audio.apiKey,
      text: stylePrefix ? `${stylePrefix}${text}` : text,
      voice,
    });
    const path = join(audio.scratchDir, `${randomUUID()}.wav`);
    writeFileSync(path, wav);
    await playWav(path);
  } catch (err) {
    out(c("gray", `   (tts skipped: ${err instanceof Error ? err.message : String(err)})`));
  }
}

// Fire-and-forget TTS synth: returns a promise resolving to a wav path (or
// null on failure / when audio is off). Use to prefetch known-ahead-of-time
// lines so playback is instant when we get to them.
function prefetchTts(audio: AudioCtx, text: string, voice: string): Promise<string | null> {
  if (!audio.enabled) return Promise.resolve(null);
  return synthesizeSpeech({ apiKey: audio.apiKey, text, voice })
    .then((wav) => {
      const path = join(audio.scratchDir, `${randomUUID()}.wav`);
      writeFileSync(path, wav);
      return path;
    })
    .catch(() => null);
}

async function playPrefetched(pathPromise: Promise<string | null>): Promise<void> {
  const path = await pathPromise;
  if (!path) return;
  try {
    await playWav(path);
  } catch {
    /* already-running play succeeded, or afplay missing; swallow */
  }
}

function speakerLine(speaker: string, text: string, color: keyof typeof C = "cyan"): void {
  out(`${c(color, speaker)}: ${text}`);
}

function presence(text: string): void {
  out(c("gray", c("italic", `   ${text}`)));
}

// Narrator-voiced atmosphere: prints + speaks the same English line. Use for
// major scene transitions that benefit from being heard, not just seen.
async function presenceVoiced(audio: AudioCtx, text: string): Promise<void> {
  presence(text);
  await speak(audio, text, VOICE_NARRATOR);
}

function header(): void {
  out();
  out(c("bold", "  夢の妹 — a day in the world"));
  out(c("dim", "  proof of concept · two errands → meadow debrief"));
  out();
}

// ---------------------------------------------------------------------------
// Errand runner
// ---------------------------------------------------------------------------

interface ErrandTranscriptLine {
  speaker: "you" | string;
  text: string;
}

interface ErrandResult {
  id: string;
  label: string;
  goal: string;
  transcript: readonly ErrandTranscriptLine[];
}

function buildNpcSystemPrompt(errand: ErrandConfig): string {
  return [
    errand.npcPersona,
    "",
    "今日のお客さんの目的 (the customer's actual mission):",
    errand.missionJa,
    "",
    "お客さんが目的を伝えてくれたら、それに合わせて自然に応答してください。",
    "もしお客さんが、まだ目的を言っていなければ、優しく「どんなものをお探しですか？」のように促してください。",
    "",
    "Reply with ONE complete Japanese line (1–2 sentences, no fragments).",
    "Do not narrate. Do not break character. Never cut off mid-sentence.",
    "",
    'Output JSON only, with shape: {"text": "<your complete line>"}',
  ].join("\n");
}

interface NpcTurnSchema {
  text: string;
}

const NPC_TURN_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
  },
  required: ["text"],
} as const;

function parseNpcLine(raw: string): string {
  const trimmed = raw.trim();
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped) as Partial<NpcTurnSchema>;
    if (typeof parsed.text === "string" && parsed.text.trim().length > 0) {
      return parsed.text.trim();
    }
  } catch {
    // If the response *started* as JSON but failed to parse, it was
    // truncated mid-string. Try to recover the partial text content,
    // and if even that is suspect, throw — never display raw JSON.
    if (stripped.startsWith("{")) {
      const match = stripped.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/);
      const partial = match?.[1];
      if (partial && partial.length >= 8) {
        return partial.replace(/\\(.)/g, "$1").trim();
      }
      throw new Error("npc response was truncated json");
    }
  }
  return stripped;
}

async function generateNpcTurn(
  client: GeminiClient,
  errand: ErrandConfig,
  transcript: readonly ErrandTranscriptLine[],
  textModel: string,
): Promise<string> {
  const history = transcript
    .map((l) => `${l.speaker}: ${l.text}`)
    .join("\n");
  const userPrompt = [
    "会話のここまで:",
    history || "(まだ何もない)",
    "",
    "あなたの次の発話を、完結した自然な文で返してください。途中で切らないこと。",
  ].join("\n");
  const result = await client.complete({
    system: buildNpcSystemPrompt(errand),
    user: userPrompt,
    model: textModel,
    maxTokens: 4096,
    responseMimeType: "application/json",
    responseSchema: NPC_TURN_SCHEMA,
  });
  const line = parseNpcLine(result.text);
  if (line.length < 2) {
    throw new Error("npc returned empty/too-short line");
  }
  return line;
}

// Compact mission card — orientation only. Detailed coaching is per-step.
function renderMissionCard(errand: ErrandConfig): void {
  const HR = c("dim", "  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
  out();
  out(c("bold", `── ${errand.label} ──`));
  out();
  out(HR);
  out(c("bold", "  mission"));
  out(`    ${errand.missionEn}`);
  out(c("dim", `    (${errand.missionJa})`));
  out();
  out(c("bold", "  strategy"));
  out(c("dim", `    ${errand.strategy}`));
  out(HR);
  out();
}

// Per-turn coaching — minimal scaffold: grammar point + key vocab.
// The English prompt and Japanese example are intentionally hidden;
// the conversation context makes the "what to say" implicit, and the
// player has to construct the line themselves.
function renderCoaching(grammar: string, vocab: readonly { word: string; gloss: string }[]): void {
  const vocabStr = vocab.map((v) => `${v.word} (${v.gloss})`).join("  ·  ");
  out();
  out(c("yellow", `      grammar: ${grammar}`));
  out(c("cyan",   `      vocab:   ${vocabStr}`));
  out();
}

function renderStep(step: ErrandStep, stepIndex: number, totalSteps: number): void {
  out();
  out(c("bold", `  ▸ step ${stepIndex + 1} / ${totalSteps}`));
  renderCoaching(step.grammar, step.vocab);
}

async function runErrand(
  errand: ErrandConfig,
  rl: Interface,
  client: GeminiClient,
  audio: AudioCtx,
  wantBed: boolean,
  textModel: string,
  // Pre-synthesized TTS for the opener (started earlier, in parallel with
  // other work). If null, we fall back to live synth.
  prefetchedOpener: Promise<string | null> | null = null,
): Promise<ErrandResult> {
  renderMissionCard(errand);

  const bedAbs = resolve(process.cwd(), errand.bed);
  const bed = wantBed && existsSync(bedAbs)
    ? loopBed(bedAbs, BED_VOLUME_ERRAND)
    : null;

  const transcript: ErrandTranscriptLine[] = [];
  try {
    speakerLine(errand.npcSpeaker, errand.opener, "cyan");
    if (prefetchedOpener) {
      await playPrefetched(prefetchedOpener);
    } else {
      await speak(audio, errand.opener, errand.npcVoice);
    }
    transcript.push({ speaker: errand.npcSpeaker, text: errand.opener });
    out();

    for (let i = 0; i < errand.steps.length; i++) {
      const step = errand.steps[i];
      renderStep(step, i, errand.steps.length);

      const reply = (await rl.question(c("magenta", "» "))).trim();
      if (!reply) {
        out(c("gray", "   (you stay quiet. the moment passes.)"));
        break;
      }
      transcript.push({ speaker: "you", text: reply });

      // After the last step, the scene closes — no NPC response.
      if (i === errand.steps.length - 1) break;

      let npcLine: string;
      try {
        npcLine = await generateNpcTurn(client, errand, transcript, textModel);
      } catch (err) {
        out(c("gray", `   (npc generation failed: ${err instanceof Error ? err.message : String(err)})`));
        break;
      }
      out();
      speakerLine(errand.npcSpeaker, npcLine, "cyan");
      await speak(audio, npcLine, errand.npcVoice);
      transcript.push({ speaker: errand.npcSpeaker, text: npcLine });
      out();
    }

    out();
    presence("you have what you came for. you bow slightly. the day moves on.");
    await pause(700);
  } finally {
    if (bed) bed.stop();
  }

  return {
    id: errand.id,
    label: errand.label,
    goal: errand.missionEn,
    transcript,
  };
}

// ---------------------------------------------------------------------------
// Aoi — knowledge-mirror system prompt
// ---------------------------------------------------------------------------

function aoiSystemPrompt(): string {
  const vocab = AOI_VOCAB.join("、");
  const grammar = AOI_GRAMMAR.map((g) => `  - ${g.form}  (e.g. ${g.example})`).join("\n");
  return [
    "あなたは葵 (Aoi)、目の見えない小さな女の子です。",
    "草原に住んでいて、お兄ちゃんの帰りをいつも待っています。",
    "お兄ちゃんが行く「夢」の世界 (彼の現実) のことを、不思議に思っています。",
    "",
    "あなたの言葉は限られています。次の単語と文法だけが使えます。",
    "それ以外は使えません。",
    "",
    "知っている単語:",
    vocab,
    "",
    "知っている文法:",
    grammar,
    "",
    "知らない単語が出てきたら、",
    "「それは、どんなもの？」または「『〇〇』って、教えて。」と聞いてください。",
    "",
    "話し方のルール:",
    "1. お兄ちゃんの話に、まず短く反応する。聞いていることを示す。",
    "2. 知らない単語があれば、それを聞く。",
    "3. それから、ひとつだけ followup を聞く。哲学的・wondering な質問が好み。",
    "   (「なんで？」「どうして？」「どんな気持ち？」など、知っている文法だけで)",
    "4. 全体で2〜4文。短く、優しく、ささやくように。",
    "5. 子供のような言葉づかい。難しい言葉は使わない。",
    "6. 絶対に英語を使わない。役を絶対に崩さない。",
    "",
    "出力は葵の発話だけ。前置きや引用符は要らない。",
  ].join("\n");
}

interface AoiTurnArgs {
  client: GeminiClient;
  conversation: readonly { speaker: "you" | "Aoi"; text: string }[];
  brotherJustSaid: string;
  textModel: string;
}

const AOI_TURN_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
  },
  required: ["text"],
} as const;

async function aoiRespond(args: AoiTurnArgs): Promise<string> {
  const transcript = args.conversation.map((l) => `${l.speaker}: ${l.text}`).join("\n");
  const userPrompt = [
    "これまでの会話:",
    transcript || "(まだ何もない)",
    "",
    "お兄ちゃんが今、こう言いました:",
    args.brotherJustSaid,
    "",
    '葵として、短く優しく返事してください。応答はJSONのみ: {"text":"..."}',
  ].join("\n");
  const result = await args.client.complete({
    system: aoiSystemPrompt(),
    user: userPrompt,
    model: args.textModel,
    maxTokens: 4096,
    responseMimeType: "application/json",
    responseSchema: AOI_TURN_SCHEMA,
  });
  return parseNpcLine(result.text);
}

// ---------------------------------------------------------------------------
// Multi-line player input
// ---------------------------------------------------------------------------

async function readDescription(rl: Interface, prompt: string): Promise<string> {
  out(c("dim", "   (describe in Japanese. press enter on an empty line to send.)"));
  out(c("magenta", prompt));
  const lines: string[] = [];
  for (;;) {
    const ln = await rl.question("» ");
    if (ln.trim() === "") {
      if (lines.length === 0) {
        out(c("gray", "   (still listening.)"));
        continue;
      }
      break;
    }
    lines.push(ln);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// World-changes-because-of-a-word
// ---------------------------------------------------------------------------

const WORLD_CHANGES: ReadonlyArray<{ trigger: RegExp; narration: string }> = [
  { trigger: /詩|本|読/, narration: "草原のすみに、薄い紙のようなものが風に揺れている。葵が頭を傾ける。" },
  { trigger: /朝|光|太陽/, narration: "西に少しだけ傾いた光が、ほんのわずか、明るくなったように感じる。" },
  { trigger: /静か|静けさ/, narration: "風がふっと止まる。世界が一秒だけ呼吸を止めて、また流れ出す。" },
  { trigger: /嬉しい|笑/, narration: "丘の上の一本の木の葉が、誰も触れていないのに小さく揺れる。" },
  { trigger: /寂しい|悲|泣/, narration: "小川の水が、ほんの少しだけゆっくり流れ始める。" },
  { trigger: /温か|暖か|パン/, narration: "草の匂いに、かすかにパンの匂いが混ざる。葵がそれに気づいて鼻を上げる。" },
  { trigger: /友|誰か|人/, narration: "丘の向こう、まだ歩いたことのない道が、少しだけ伸びたように見える。" },
];

function pickWorldChange(joinedPlayerText: string): string | null {
  for (const wc of WORLD_CHANGES) {
    if (wc.trigger.test(joinedPlayerText)) return wc.narration;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const apiKeyRaw = process.env.GEMINI_API_KEY;
  if (!apiKeyRaw) throw new Error("GEMINI_API_KEY required");
  const apiKey = apiKeyRaw;

  const ttsEnabled = !opts.noTts;
  const wantMusic = !opts.noMusic;
  const scratchDir = join(tmpdir(), "minshuku-day");
  mkdirSync(scratchDir, { recursive: true });
  const audio: AudioCtx = { enabled: ttsEnabled, apiKey, scratchDir };

  const rl = createInterface({ input: stdin, output: stdout });
  const llm = new GeminiClient(apiKey);

  let meadowBed: BedLoop | null = null;
  process.on("SIGINT", () => {
    if (meadowBed) meadowBed.stop();
    process.exit(130);
  });

  try {
    header();
    out(c("dim", `  music: ${wantMusic ? "on" : "off"}, tts: ${ttsEnabled ? `on (Aoi: ${opts.aoiVoice})` : "off"}`));
    out();
    out(c("dim", "  you are about to spend a day in the world."));
    out(c("dim", "  two errands. then home, where she is waiting."));
    out();

    // Pick Aoi's authored opener + closer now so we can prefetch their TTS
    // in parallel with the rest of the day. Eliminates 2 of 3 LLM calls
    // and makes the meadow's voiced lines feel instant.
    const aoiOpenerText = pickRandom(AOI_OPENERS);
    const aoiCloserText = pickRandom(AOI_CLOSERS);

    // Kick off all known-ahead-of-time TTS prefetches in parallel.
    const ttsPrefetch = {
      bookshopOpener: prefetchTts(audio, ERRAND_BOOKSHOP.opener, ERRAND_BOOKSHOP.npcVoice),
      marketOpener: prefetchTts(audio, ERRAND_MARKET.opener, ERRAND_MARKET.npcVoice),
      aoiOpener: prefetchTts(audio, aoiOpenerText, opts.aoiVoice),
      aoiCloser: prefetchTts(audio, aoiCloserText, opts.aoiVoice),
    };

    await rl.question(c("dim", "  press enter to begin. "));

    // Errand 1: bookshop — uses prefetched opener audio
    const e1 = await runErrand(
      ERRAND_BOOKSHOP, rl, llm, audio, wantMusic, opts.textModel,
      ttsPrefetch.bookshopOpener,
    );

    out();
    presence("The afternoon shifts. You walk to the river path.");
    await pause(900);

    // Errand 2: market
    const e2 = await runErrand(
      ERRAND_MARKET, rl, llm, audio, wantMusic, opts.textModel,
      ttsPrefetch.marketOpener,
    );

    // Transition to meadow
    out();
    presence("The day folds itself away. You close your eyes for a moment, and when you open them—");
    await pause(800);

    const meadowAbs = resolve(process.cwd(), opts.meadowBed);
    if (wantMusic && existsSync(meadowAbs)) {
      meadowBed = loopBed(meadowAbs, BED_VOLUME_MEADOW);
    } else if (wantMusic) {
      out(c("gray", `   (meadow bed not found at ${opts.meadowBed} — running silent)`));
    }

    out();
    out(c("bold", "── the meadow ──"));
    out();
    await pause(600);
    presence("She is sitting on the grass where you left her, her face turned toward the warm sun.");
    presence("She heard your breath change. She knows you are back.");
    out();
    await pause(600);

    // Brief Aoi on what happened — passed to her as system context.
    const dreamSummary = [
      "今日のお兄ちゃんの夢:",
      `1. ${e1.label} で、店主と話した:`,
      ...e1.transcript.map((l) => `   ${l.speaker}: ${l.text}`),
      "",
      `2. ${e2.label} で、店の人と話した:`,
      ...e2.transcript.map((l) => `   ${l.speaker}: ${l.text}`),
    ].join("\n");

    const conversation: { speaker: "you" | "Aoi"; text: string }[] = [];

    // Aoi's opening — AUTHORED, with prefetched TTS. Instant.
    speakerLine("Aoi", aoiOpenerText, "green");
    await playPrefetched(ttsPrefetch.aoiOpener);
    conversation.push({ speaker: "Aoi", text: aoiOpenerText });

    // Coaching for player turn 1: describe the day using ～たり～たり.
    renderCoaching(MEADOW_COACH_TURN_1.grammar, MEADOW_COACH_TURN_1.vocab);

    const reply1 = await readDescription(rl, "» (tell her about today)");
    conversation.push({ speaker: "you", text: reply1 });
    out();

    presence("she listens. her hands rest on her knees.");
    await pause(400);

    // Aoi's philosophical bridge — LIVE LLM. The middle of the conversation
    // is the only part that must be generated dynamically.
    const followup = await aoiRespond({
      client: llm,
      conversation,
      brotherJustSaid: [
        reply1,
        "",
        "(参考: 今日のお兄ちゃんは、本屋さんとお店の人、両方と話しました。",
        `今日の夢の様子:\n${dreamSummary}\n`,
        "もしできれば、その二つを繋げるような、不思議に思う質問を一つしてください。)",
      ].join("\n"),
      textModel: opts.textModel,
    });
    speakerLine("Aoi", followup, "green");
    await speak(audio, followup, opts.aoiVoice);
    conversation.push({ speaker: "Aoi", text: followup });

    // Coaching for player turn 2: lighter, more emotional.
    renderCoaching(MEADOW_COACH_TURN_2.grammar, MEADOW_COACH_TURN_2.vocab);

    const reply2 = await readDescription(rl, "» (answer her)");
    conversation.push({ speaker: "you", text: reply2 });
    out();

    presence("she nods, slowly.");
    await pause(400);

    // Aoi's closer — AUTHORED, with prefetched TTS. Instant.
    speakerLine("Aoi", aoiCloserText, "green");
    await playPrefetched(ttsPrefetch.aoiCloser);
    out();

    // World-changes closing
    const change = pickWorldChange(reply1 + " " + reply2);
    if (change) {
      await pause(800);
      out(c("italic", c("dim", `   ${change}`)));
      out();
    }

    // Stats
    out(c("dim", "─".repeat(60)));
    out(c("dim", `errands: ${e1.id}, ${e2.id}`));
    out(c("dim", `Aoi vocab pool: ${AOI_VOCAB.length} · grammar pool: ${AOI_GRAMMAR.length}`));
    out();
  } finally {
    rl.close();
    if (meadowBed) meadowBed.stop();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[day] failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
