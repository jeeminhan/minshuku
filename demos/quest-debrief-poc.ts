// Quest-debrief proof-of-concept: the dream-sister.
//
// You return from a "dream" (a completed scene in the real world). You
// arrive at the meadow. Your blind sister Aoi is waiting. She asks about
// what happened. You describe in Japanese. She listens, may ask you to
// teach her a word, and asks one philosophical follow-up.
//
// THIS IS THE KNOWLEDGE-MIRROR PROTOTYPE: Aoi can only use vocabulary
// and grammar present in the hardcoded fake SRS state. She is, literally,
// a model of your own knowledge made into a small girl on a hill.
//
// Run with:
//   npm run debrief
//   npm run debrief -- --no-music   # skip Lyria meadow bed
//   npm run debrief -- --no-tts     # text only
//   npm run debrief -- --regenerate-music  # re-fetch the meadow bed
//
// Music: first run generates a ~75s Lyria "meadow" clip (~75s wallclock).
// Cached at public/audio/meadow.wav. Subsequent runs reuse it.

import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

import { synthesizeSpeech } from "../src/lib/audio/tts.js";
import { GeminiClient } from "../src/lib/llm/client.js";
import { LYRIA_PCM, pcmChunksToWav } from "../src/lib/audio/wav.js";
import {
  presetForLocation,
  type MoodPreset,
  type WeightedPrompt,
} from "../src/lib/audio/lyriaPrompts.js";

// ---------------------------------------------------------------------------
// Voices, music
// ---------------------------------------------------------------------------

const VOICE_AOI = "Leda";
const AOI_STYLE_PREFIX =
  "Speak softly, slowly, in the voice of a small, gentle, blind young girl. Almost a half-whisper. ";
const BED_PATH_REL = "public/audio/meadow.wav";
const BED_VOLUME = "0.16"; // quieter than scene:play; debrief is intimate
const BED_DURATION_SEC = 75;
const LYRIA_MODEL = "models/lyria-realtime-exp";

// ---------------------------------------------------------------------------
// Fake SRS state — the heart of the POC
// ---------------------------------------------------------------------------
//
// In a real build, these would be derived from review-history. Aoi knows
// EXACTLY these words and grammar forms — nothing else. If the player uses
// a word outside her pool, she will ask "それは、どんなもの？".

const AOI_VOCAB: readonly string[] = [
  // people / family
  "お兄ちゃん", "妹", "母", "友達", "人",
  // body / inner state
  "気持ち", "心", "声", "顔", "手",
  // emotions she has language for
  "嬉しい", "寂しい", "怖い", "優しい", "不思議",
  // sensory / world
  "朝", "夜", "風", "光", "暖かい", "静か",
  // food / objects
  "食べ物", "美味しい", "本", "詩", "言葉", "夢",
  // basic verbs
  "食べる", "読む", "書く", "聞く", "話す",
  "笑う", "泣く", "思い出す", "覚える", "教える",
];

const AOI_GRAMMAR: readonly { form: string; example: string }[] = [
  { form: "ます形 (polite)", example: "食べます、行きます" },
  { form: "～から / ～ので (because)", example: "嬉しいから、笑った" },
  { form: "こと / もの nominalizer", example: "本を読むことが好き" },
  { form: "～たい (want to)", example: "話したい" },
  { form: "～ても (even if)", example: "怖くても、行く" },
  { form: "～たり～たり (sometimes X, sometimes Y)", example: "笑ったり泣いたり" },
  { form: "～たら (if/when)", example: "美味しかったら、嬉しい" },
  { form: "～たことがある (have experienced)", example: "見たことがある" },
  { form: "って (quotation / topic-marking)", example: "「友達」って、何？" },
  { form: "～みたい (seems like)", example: "夢みたい" },
];

// What the player "did" in the world before arriving back at the meadow.
// This is the hook the sister asks about. In a real build, this would be
// derived from the most recently completed scene.
const COMPLETED_SCENE_SUMMARY = {
  brief: "You went to a quiet bookshop and asked the owner for a book of poems. You tried one of the poems aloud, very softly, and bought it.",
  oneLineJa: "今日、本屋さんで詩集を買いました。",
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  noMusic: boolean;
  noTts: boolean;
  regenerateMusic: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = {
    noMusic: false,
    noTts: false,
    regenerateMusic: false,
  };
  for (const arg of argv) {
    if (arg === "--no-music") opts.noMusic = true;
    else if (arg === "--no-tts") opts.noTts = true;
    else if (arg === "--regenerate-music") opts.regenerateMusic = true;
    else if (arg === "--help" || arg === "-h") {
      stdout.write(
        [
          "Quest-debrief POC (the dream-sister).",
          "",
          "  --no-music             Skip the Lyria meadow bed",
          "  --no-tts               Disable Aoi's voice (text only)",
          "  --regenerate-music     Force a fresh Lyria meadow generation",
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
// Styling
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

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

interface BedLoop {
  stop: () => void;
}

function loopBed(path: string): BedLoop {
  let stopped = false;
  let current: ChildProcess | null = null;
  const tick = (): void => {
    if (stopped) return;
    current = spawn("afplay", ["-v", BED_VOLUME, path], { stdio: "ignore" });
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
  apiKey: string | null;
  scratchDir: string;
}

async function speak(
  audio: AudioCtx,
  text: string,
  voice: string,
  stylePrefix = "",
): Promise<void> {
  if (!audio.enabled || !audio.apiKey) return;
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

// ---------------------------------------------------------------------------
// Lyria meadow generation (used when public/audio/meadow.wav is absent)
// ---------------------------------------------------------------------------

const BYTES_PER_SECOND =
  (LYRIA_PCM.sampleRate * LYRIA_PCM.channels * LYRIA_PCM.bitsPerSample) / 8;

interface AudioChunkLike { data?: string }
interface ServerContentLike { audioChunks?: readonly AudioChunkLike[] }
interface ServerMessageLike {
  serverContent?: ServerContentLike;
  filteredPrompt?: { text?: string; filteredReason?: string };
}
interface LiveMusicLike {
  setWeightedPrompts(p: { weightedPrompts: WeightedPrompt[] }): Promise<void>;
  setMusicGenerationConfig(p: { musicGenerationConfig: NonNullable<MoodPreset["config"]> }): Promise<void>;
  play(): void;
  stop(): void;
  close(): void;
}

async function generateMeadowBed(
  apiKey: string,
  outPath: string,
  seconds: number,
): Promise<void> {
  const preset = presetForLocation("meadow");
  const ai = new GoogleGenAI({ apiKey, apiVersion: "v1alpha" });
  const live = (ai as unknown as {
    live: {
      music: {
        connect: (params: {
          model: string;
          callbacks: {
            onmessage: (e: ServerMessageLike) => void;
            onerror?: (e: unknown) => void;
            onclose?: (e: unknown) => void;
          };
        }) => Promise<LiveMusicLike>;
      };
    };
  }).live;

  const targetBytes = BYTES_PER_SECOND * seconds;
  const chunks: Uint8Array[] = [];
  let received = 0;
  let resolveDone!: () => void;
  let rejectDone!: (err: unknown) => void;
  const done = new Promise<void>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });

  const session = await live.music.connect({
    model: LYRIA_MODEL,
    callbacks: {
      onmessage: (msg) => {
        const audioChunks = msg.serverContent?.audioChunks;
        if (!audioChunks?.length) return;
        for (const ch of audioChunks) {
          if (!ch.data) continue;
          const bytes = new Uint8Array(Buffer.from(ch.data, "base64"));
          chunks.push(bytes);
          received += bytes.byteLength;
        }
        const secs = (received / BYTES_PER_SECOND).toFixed(1);
        process.stderr.write(`\r[lyria] meadow: ${secs}s / ${seconds}s `);
        if (received >= targetBytes) resolveDone();
      },
      onerror: (e) => rejectDone(e),
      onclose: () => {
        if (received < targetBytes) {
          rejectDone(new Error(`closed early at ${(received / BYTES_PER_SECOND).toFixed(1)}s`));
        }
      },
    },
  });

  await session.setWeightedPrompts({ weightedPrompts: [...preset.prompts] });
  if (preset.config) {
    await session.setMusicGenerationConfig({ musicGenerationConfig: { ...preset.config } });
  }
  session.play();

  const safety = setTimeout(() => {
    rejectDone(new Error(`lyria timeout`));
  }, seconds * 2 * 1000 + 15_000);

  try {
    await done;
  } finally {
    clearTimeout(safety);
    try { session.stop(); } catch { /* */ }
    try { session.close(); } catch { /* */ }
    process.stderr.write("\n");
  }

  const wav = pcmChunksToWav(chunks);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, wav);
}

// ---------------------------------------------------------------------------
// The sister — knowledge-mirror system prompt
// ---------------------------------------------------------------------------

function aoiSystemPrompt(): string {
  const vocab = AOI_VOCAB.join("、");
  const grammar = AOI_GRAMMAR.map((g) => `  - ${g.form}  (e.g. ${g.example})`).join("\n");
  return [
    "あなたは葵 (Aoi)、目の見えない小さな女の子です。",
    "草原に住んでいて、お兄ちゃんの帰りをいつも待っています。",
    "お兄ちゃんが「夢」と呼ぶ世界 (彼の現実) のことを、不思議に思っています。",
    "",
    "あなたの言葉は限られています。次の単語と文法だけが使えます。",
    "それ以外の単語や文法は使えません。",
    "",
    "知っている単語:",
    vocab,
    "",
    "知っている文法:",
    grammar,
    "",
    "もしお兄ちゃんが、あなたの知らない単語を使ったら、",
    "「それは、どんなもの？」または「『〇〇』って、教えて。」と聞いてください。",
    "",
    "話し方のルール:",
    "1. お兄ちゃんの話に、まず短く反応する (一文)。聞いていることを示す。",
    "2. 知らない単語があれば、それを聞く。",
    "3. それから、ひとつだけ followup を聞く。できれば哲学的・wondering な質問にする。",
    "   (「なんで？」「どうして？」「どんな気持ち？」など、知っている文法だけで)",
    "4. 全体で2〜4文。短く、優しく。",
    "5. 絶対に英語を使わない。役を絶対に崩さない。",
    "6. 戦争・仕事のストレス・交通など、知らない概念は驚きや戸惑いで反応する。",
    "",
    "出力は葵の発話だけ。前置きや引用符は要らない。",
  ].join("\n");
}

interface AoiTurnArgs {
  client: GeminiClient;
  conversation: readonly { speaker: "you" | "Aoi"; text: string }[];
  brotherJustSaid: string;
}

async function aoiRespond(args: AoiTurnArgs): Promise<string> {
  const transcript = args.conversation
    .map((l) => `${l.speaker}: ${l.text}`)
    .join("\n");
  const userPrompt = [
    "これまでの会話:",
    transcript || "(まだ何もない)",
    "",
    "お兄ちゃんが今、こう言いました:",
    args.brotherJustSaid,
    "",
    "葵として返事してください。",
  ].join("\n");
  const result = await args.client.complete({
    system: aoiSystemPrompt(),
    user: userPrompt,
    maxTokens: 300,
  });
  return result.text.trim();
}

// ---------------------------------------------------------------------------
// World-changes-because-of-a-word — closing narration
// ---------------------------------------------------------------------------

const WORLD_CHANGES: ReadonlyArray<{
  trigger: RegExp;
  narration: string;
}> = [
  { trigger: /詩|本|読/, narration: "草原のすみに、薄い紙のようなものが風に揺れている。葵が頭を傾ける。" },
  { trigger: /朝|光|太陽/, narration: "西に少しだけ傾いた光が、ほんのわずか、明るくなったように感じる。" },
  { trigger: /静か|静けさ/, narration: "風が、ふっと止まる。世界が一秒だけ呼吸を止めて、また流れ出す。" },
  { trigger: /嬉しい|笑/, narration: "丘の上の一本の木の葉が、誰も触れていないのに小さく揺れる。" },
  { trigger: /寂しい|悲|泣/, narration: "小川の水が、ほんの少しだけゆっくり流れ始める。" },
  { trigger: /温か|暖か/, narration: "草の匂いが濃くなる。葵が小さく深呼吸する。" },
  { trigger: /友|誰か|人/, narration: "丘の向こう、まだ歩いたことのない道が、少しだけ伸びたように見える。" },
];

function pickWorldChange(playerLines: readonly string[]): string | null {
  const joined = playerLines.join(" ");
  for (const wc of WORLD_CHANGES) {
    if (wc.trigger.test(joined)) return wc.narration;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function speakerLine(speaker: string, text: string, color: keyof typeof C = "cyan"): void {
  out(`${c(color, speaker)}: ${text}`);
}

function presence(text: string): void {
  out(c("gray", c("italic", `   ${text}`)));
}

function header(): void {
  out();
  out(c("bold", "  夢の妹 — the Dream-Sister"));
  out(c("dim", "  proof of concept · quest-debrief · knowledge-mirror"));
  out();
}

function aoiKnowledgeBriefing(): void {
  out(c("dim", "  Aoi's mind is a model of your knowledge."));
  out(c("dim", `  she has ${AOI_VOCAB.length} words and ${AOI_GRAMMAR.length} grammar forms — yours.`));
  out(c("dim", "  if you say something she has no word for, she will ask you to teach her."));
  out();
}

// ---------------------------------------------------------------------------
// Multi-line input — the player can write a paragraph; empty line ends it.
// ---------------------------------------------------------------------------

async function readDescription(rl: Interface, prompt: string): Promise<string> {
  out(c("dim", `   (write your description in Japanese. press enter on an empty line to finish.)`));
  out(c("magenta", prompt));
  const lines: string[] = [];
  for (;;) {
    const ln = await rl.question("» ");
    if (ln.trim() === "") {
      if (lines.length === 0) {
        out(c("gray", "   (you didn't say anything. she's still listening.)"));
        continue;
      }
      break;
    }
    lines.push(ln);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const apiKeyRaw = process.env.GEMINI_API_KEY;
  const apiKey = apiKeyRaw && apiKeyRaw.length > 0 ? apiKeyRaw : null;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is required for the LLM-driven sister and the TTS. set it in .env.",
    );
  }

  const ttsEnabled = !opts.noTts;
  const scratchDir = join(tmpdir(), "minshuku-debrief");
  mkdirSync(scratchDir, { recursive: true });
  const audio: AudioCtx = { enabled: ttsEnabled, apiKey, scratchDir };

  const bedAbs = resolve(process.cwd(), BED_PATH_REL);
  const wantBed = !opts.noMusic;
  let bed: BedLoop | null = null;
  const cleanup = (): void => { if (bed) bed.stop(); };
  process.on("SIGINT", () => { cleanup(); process.exit(130); });

  header();
  aoiKnowledgeBriefing();

  if (wantBed) {
    if (!existsSync(bedAbs) || opts.regenerateMusic) {
      out(c("dim", `  generating Lyria meadow bed (~${BED_DURATION_SEC}s, this takes about that long in wallclock)…`));
      try {
        await generateMeadowBed(apiKey, bedAbs, BED_DURATION_SEC);
        out(c("dim", `  meadow bed cached at ${BED_PATH_REL}`));
      } catch (err) {
        out(c("gray", `  (lyria failed: ${err instanceof Error ? err.message : String(err)} — running silent)`));
      }
    } else {
      out(c("dim", `  meadow bed: ${BED_PATH_REL} (cached)`));
    }
    if (existsSync(bedAbs)) bed = loopBed(bedAbs);
  } else {
    out(c("dim", "  music: disabled"));
  }

  out();
  out(c("dim", "  ─ the dream you came from ─"));
  out(c("dim", `   ${COMPLETED_SCENE_SUMMARY.brief}`));
  out(c("dim", `   ${COMPLETED_SCENE_SUMMARY.oneLineJa}`));
  out();
  await pause(800);

  const rl = createInterface({ input: stdin, output: stdout });
  const llm = new GeminiClient(apiKey);
  const conversation: { speaker: "you" | "Aoi"; text: string }[] = [];
  const playerLines: string[] = [];

  try {
    presence("you wake on the grass. she is sitting beside you, her face turned toward the warm sun she cannot see.");
    presence("she heard your breath change — she knows you are back.");
    out();
    await pause(700);

    // Aoi opens with the dream-debrief question.
    const opening = await aoiRespond({
      client: llm,
      conversation: [],
      brotherJustSaid: `(お兄ちゃんが「夢」から戻ってきたばかり。今日の夢は: ${COMPLETED_SCENE_SUMMARY.oneLineJa})`,
    });
    speakerLine("Aoi", opening, "green");
    await speak(audio, opening, VOICE_AOI, AOI_STYLE_PREFIX);
    conversation.push({ speaker: "Aoi", text: opening });
    out();

    // First player turn: describe the scene.
    const firstReply = await readDescription(rl, "» (tell her about the bookshop)");
    conversation.push({ speaker: "you", text: firstReply });
    playerLines.push(firstReply);
    out();

    // Aoi listens, may ask about a word, and asks one philosophical follow-up.
    presence("she listens. her hands rest on her knees.");
    await pause(500);
    const followup = await aoiRespond({
      client: llm,
      conversation,
      brotherJustSaid: firstReply,
    });
    speakerLine("Aoi", followup, "green");
    await speak(audio, followup, VOICE_AOI, AOI_STYLE_PREFIX);
    conversation.push({ speaker: "Aoi", text: followup });
    out();

    // Second player turn: respond to her philosophical question.
    const secondReply = await readDescription(rl, "» (answer her)");
    conversation.push({ speaker: "you", text: secondReply });
    playerLines.push(secondReply);
    out();

    // Aoi closes — short, warm.
    presence("she nods, slowly.");
    await pause(500);
    const closing = await aoiRespond({
      client: llm,
      conversation,
      brotherJustSaid: secondReply + "\n\n(これで会話を閉じてください。短く、優しく、一文で。)",
    });
    speakerLine("Aoi", closing, "green");
    await speak(audio, closing, VOICE_AOI, AOI_STYLE_PREFIX);
    out();

    // World-changes-because-of-a-word
    const change = pickWorldChange(playerLines);
    if (change) {
      await pause(800);
      out(c("italic", c("dim", `   ${change}`)));
      out();
    }

    // Stats
    out(c("dim", "─".repeat(60)));
    out(c("dim", `vocab she had access to: ${AOI_VOCAB.length} words`));
    out(c("dim", `grammar she had access to: ${AOI_GRAMMAR.length} forms`));
    out(c("dim", `your turns: ${playerLines.length}`));
    out();
  } finally {
    rl.close();
    cleanup();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[debrief] failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
