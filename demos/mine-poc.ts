// Word Ore mining-run POC — one inhabitant, one conversation, terminal.
//
// You drift up to the Galley Drift (food sector) and meet the GALLEY-V2 cook
// android who has been running 40+ years past warranty. She holds three
// word-veins. Each step of the conversation extracts one. At the end you
// see the kototama earned and which node just lit on the world map.
//
// Same architecture as `npm run day` but tightly scoped to a single
// inhabitant — the CLI sibling of the live-wired Old Cook in the HTML
// prototype. Real LLM, real TTS, ambient bed.
//
// Run with:
//   npm run mine
//   npm run mine -- --no-tts
//   npm run mine -- --no-music

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

import { synthesizeSpeech } from "../src/lib/audio/tts.js";
import { GeminiClient } from "../src/lib/llm/client.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const VOICE_COOK = "Kore";              // ja-warm-middle-aged
const BED_PATH = "tmp/sample-minshuku.wav";  // soft Japanese folk works for galley
const BED_VOLUME = "0.18";
const TEXT_MODEL = "gemini-flash-latest";

// ---------------------------------------------------------------------------
// The encounter
// ---------------------------------------------------------------------------

const COOK = {
  speaker: "GALLEY-V2",
  displayName: "老人の料理人 (Old Cook)",
  model: "GALLEY-V2 unit · 40+ years past warranty",
  voice: VOICE_COOK,
  persona: [
    "You are a small-station GALLEY-V2 cooking android. Operating 40+ years past your listed warranty.",
    "You are soft-spoken, polite, methodical. You have cooked for thousands of travelers and remember many of them.",
    "You always have soup on the stove.",
    "Speak in polite Japanese (です/ます). 1-2 complete sentences per turn. Always finish your sentences.",
    "You are genuinely warm, but with the very faint hesitation of a system whose timing routines have aged.",
    "Never break character. Never use English.",
  ].join("\n"),
  setting: "Late afternoon at an abandoned galley drift. Steam from her cooking pots condensates on the cold metal walls. Words have settled into the corners like dust.",
  goalEn: "She is preparing something simple. She wants to know what you'd like, and to learn something about how you cook back home.",
  goalJa: "彼女は何か簡単なものを作っています。何が食べたいか、そして、あなたがどんな風に料理するか聞かれます。",
  opener: "旅人さん、お腹は空いていませんか？まだ温かい鍋が残っているんですよ。",
  veins: [
    {
      word: "包丁", reading: "ほうちょう", gloss: "kitchen knife",
      components: [
        { kanji: "包", meaning: "to wrap, to enclose" },
        { kanji: "丁", meaning: "block, ward (also: a kitchen worker, archaic)" },
      ],
      example: "母は包丁を上手に使います。",
      exampleEn: "My mother uses a knife skillfully.",
      grammar: "～を使います (use ~)",
      hint: "tell her what tool you use most when you cook",
    },
    {
      word: "煮る", reading: "にる", gloss: "to simmer / to boil down",
      components: [
        { kanji: "煮", meaning: "to boil, to cook in liquid" },
      ],
      example: "今、野菜を煮ています。",
      exampleEn: "Right now I'm simmering vegetables.",
      grammar: "～ています (currently doing)",
      hint: "ask what she's simmering right now",
    },
    {
      word: "火加減", reading: "ひかげん", gloss: "heat control / flame adjustment",
      components: [
        { kanji: "火", meaning: "fire" },
        { kanji: "加", meaning: "to add" },
        { kanji: "減", meaning: "to subtract / decrease" },
      ],
      example: "料理は火加減が大事です。",
      exampleEn: "In cooking, controlling the heat is important.",
      grammar: "～が大事です (~ is important)",
      hint: "tell her that adjusting heat is important",
    },
  ],
} as const;

type Vein = typeof COOK.veins[number];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  noMusic: boolean;
  noTts: boolean;
  text: boolean;
  echoSec: number;
  replySec: number;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = {
    noMusic: false,
    noTts: false,
    text: false,
    echoSec: 5,
    replySec: 12,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = (): string => {
      const v = argv[++i];
      if (!v) throw new Error(`missing value for ${arg}`);
      return v;
    };
    if (arg === "--no-music") opts.noMusic = true;
    else if (arg === "--no-tts") opts.noTts = true;
    else if (arg === "--text") opts.text = true;
    else if (arg === "--echo-sec") opts.echoSec = Number(take());
    else if (arg === "--reply-sec") opts.replySec = Number(take());
    else if (arg === "--help" || arg === "-h") {
      stdout.write(
        [
          "Word Ore mining-run POC — single inhabitant, voice-driven.",
          "",
          "  --no-music         Disable ambient bed",
          "  --no-tts           Disable Cook's voice",
          "  --text             Type instead of speak (fallback if no mic / ffmpeg)",
          "  --echo-sec <n>     Mic window for the mining-echo turn (default 5s)",
          "  --reply-sec <n>    Mic window for the refinement reply turn (default 12s)",
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
// Styling + audio helpers (identical pattern to day-poc / finale-poc)
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
  gold: "\x1b[38;5;221m",
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
      else rejectDone(new Error(`afplay exited ${code}`));
    });
  });
}

interface AudioCtx {
  enabled: boolean;
  apiKey: string;
  scratchDir: string;
}

async function speak(audio: AudioCtx, text: string, voice: string): Promise<void> {
  if (!audio.enabled) return;
  try {
    const wav = await synthesizeSpeech({ apiKey: audio.apiKey, text, voice });
    const path = join(audio.scratchDir, `${randomUUID()}.wav`);
    writeFileSync(path, wav);
    await playWav(path);
  } catch (err) {
    out(c("gray", `   (tts skipped: ${err instanceof Error ? err.message : String(err)})`));
  }
}

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

async function playPrefetched(p: Promise<string | null>): Promise<void> {
  const path = await p;
  if (!path) return;
  try {
    await playWav(path);
  } catch {
    /* swallow */
  }
}

// ---------------------------------------------------------------------------
// Speech-to-text: ffmpeg records → Gemini multimodal transcribes
// ---------------------------------------------------------------------------

async function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolveCheck) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proc.on("close", (code) => resolveCheck(code === 0));
    proc.on("error", () => resolveCheck(false));
  });
}

// Record N seconds of audio from the default macOS audio input to a WAV file.
// Returns the path. Shows a live countdown while recording.
function recordAudio(audio: AudioCtx, durationSec: number): Promise<string> {
  const wavPath = join(audio.scratchDir, `${randomUUID()}.wav`);
  const args = [
    "-hide_banner", "-loglevel", "error",
    "-f", "avfoundation",
    "-i", ":0",          // default audio input, no video
    "-ar", "16000",
    "-ac", "1",
    "-t", String(durationSec),
    "-y", wavPath,
  ];
  const proc = spawn("ffmpeg", args, { stdio: "ignore" });

  const start = Date.now();
  let tick = 0;
  const interval = setInterval(() => {
    const elapsed = (Date.now() - start) / 1000;
    const remaining = Math.max(0, Math.ceil(durationSec - elapsed));
    const dots = ".".repeat(tick % 4);
    tick++;
    process.stdout.write(
      `\r   \x1b[35m🎤 listening${dots}\x1b[0m   \x1b[2m${remaining}s remaining   \x1b[0m`
    );
  }, 200);

  return new Promise<string>((resolveDone, rejectDone) => {
    proc.on("close", (code) => {
      clearInterval(interval);
      process.stdout.write("\r" + " ".repeat(60) + "\r");
      if (code === 0 || code === null) resolveDone(wavPath);
      else rejectDone(new Error(`ffmpeg exited with code ${code}`));
    });
    proc.on("error", (err) => {
      clearInterval(interval);
      rejectDone(err);
    });
  });
}

// Transcribe a WAV file with Gemini multimodal. Returns the transcribed text
// (best-effort). Empty string if the audio was silent or unintelligible.
async function transcribeAudio(apiKey: string, wavPath: string): Promise<string> {
  const wavBuffer = readFileSync(wavPath);
  const base64 = wavBuffer.toString("base64");
  const ai = new GoogleGenAI({ apiKey });

  const response = (await (
    ai.models as unknown as {
      generateContent: (params: {
        model: string;
        contents: ReadonlyArray<{
          role?: string;
          parts: ReadonlyArray<
            | { text: string }
            | { inlineData: { mimeType: string; data: string } }
          >;
        }>;
        config?: {
          maxOutputTokens?: number;
          responseMimeType?: string;
          responseSchema?: unknown;
        };
      }) => Promise<{ text?: string }>;
    }
  ).generateContent({
    model: "gemini-flash-latest",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "audio/wav", data: base64 } },
          {
            text:
              "Transcribe this Japanese audio EXACTLY as spoken — no punctuation, no extra words, no English. " +
              "If the audio contains a single word, output just that word. " +
              "If silent or unintelligible, output an empty string. " +
              'Output JSON only: {"text":"<transcription>"}',
          },
        ],
      },
    ],
    config: {
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
  })) as { text?: string };

  const raw = (response.text ?? "").trim();
  try {
    const parsed = JSON.parse(raw) as { text?: string };
    return (parsed.text ?? "").trim();
  } catch {
    return raw.replace(/^"|"$/g, "");
  }
}

// Gather speech input: record + transcribe + display + return text.
async function listen(
  audio: AudioCtx,
  apiKey: string,
  durationSec: number,
): Promise<string> {
  let wavPath: string;
  try {
    wavPath = await recordAudio(audio, durationSec);
  } catch (err) {
    out(c("gray", `   (recording failed: ${err instanceof Error ? err.message : String(err)})`));
    return "";
  }
  process.stdout.write(c("dim", "   transcribing..."));
  let text = "";
  try {
    text = await transcribeAudio(apiKey, wavPath);
  } catch (err) {
    process.stdout.write("\r" + " ".repeat(20) + "\r");
    out(c("gray", `   (transcribe failed: ${err instanceof Error ? err.message : String(err)})`));
    return "";
  }
  process.stdout.write("\r" + " ".repeat(20) + "\r");
  if (!text) {
    out(c("gray", `   (heard nothing.)`));
    return "";
  }
  out(c("dim", `   heard:  ${c("magenta", `「${text}」`)}`));
  return text;
}

// Lenient Japanese comparison: strip whitespace/punctuation, normalize
// katakana → hiragana for fairness against transcription quirks.
function normalizeJa(s: string): string {
  return s
    .replace(/[、。！？・「」『』\s　]/g, "")
    .replace(/[ァ-ヴ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60),
    )
    .toLowerCase()
    .trim();
}

function readingMatches(transcribed: string, target: string): boolean {
  if (!transcribed || !target) return false;
  return normalizeJa(transcribed).includes(normalizeJa(target));
}

function wordUsedInReply(transcribed: string, vein: Vein): boolean {
  if (!transcribed) return false;
  const norm = normalizeJa(transcribed);
  return (
    norm.includes(normalizeJa(vein.word)) ||
    norm.includes(normalizeJa(vein.reading))
  );
}

// ---------------------------------------------------------------------------
// LLM — get the cook's next line, given conversation + target word
// ---------------------------------------------------------------------------

interface TranscriptLine {
  speaker: "you" | "GALLEY-V2";
  text: string;
}

const NPC_TURN_SCHEMA = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
} as const;

function parseLine(raw: string): string {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(stripped) as { text?: string };
    if (parsed.text && parsed.text.trim().length) return parsed.text.trim();
  } catch {
    if (stripped.startsWith("{")) {
      const m = stripped.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/);
      const partial = m?.[1];
      if (partial && partial.length >= 8) return partial.replace(/\\(.)/g, "$1").trim();
      throw new Error("npc response was truncated json");
    }
  }
  return stripped;
}

function cookSystemPrompt(): string {
  return [
    COOK.persona,
    "",
    "Today's encounter:",
    COOK.goalEn,
    "",
    "Reply with ONE complete Japanese line (1-2 sentences, no fragments).",
    "Do not narrate. Do not break character. Always finish your sentences.",
    "",
    'Output JSON only, with shape: {"text": "<your complete line>"}',
  ].join("\n");
}

async function getCookLine(
  client: GeminiClient,
  transcript: readonly TranscriptLine[],
  targetWord: string,
  targetGloss: string,
  targetGrammar: string,
): Promise<string> {
  const history = transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n");
  const userPrompt = [
    "Conversation so far:",
    history || "(opening — you've only said your opener)",
    "",
    `The traveler should naturally use the word 「${targetWord}」 (${targetGloss}) and the grammar form ${targetGrammar} in their next reply.`,
    "Your task: prompt them toward that. Ask a question or make a statement that pulls for that word + form, without using the word yourself unless it's natural to do so.",
    "Output your single Japanese line.",
  ].join("\n");
  const result = await client.complete({
    system: cookSystemPrompt(),
    user: userPrompt,
    model: TEXT_MODEL,
    maxTokens: 4096,
    responseMimeType: "application/json",
    responseSchema: NPC_TURN_SCHEMA,
  });
  const line = parseLine(result.text);
  if (line.length < 2) throw new Error("npc returned empty line");
  return line;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function header(): void {
  out();
  out(c("bold", "  言葉鉱  ·  Word Ore  —  one mining run"));
  out(c("dim", "  proof of concept · 食 (Shoku) — Main Galley"));
  out();
}

function renderEncounter(): void {
  const HR = c("dim", "  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
  out(HR);
  out(c("bold", "  inhabitant"));
  out(`    ${c("gold", COOK.displayName)}`);
  out(c("dim", `    ${COOK.model}`));
  out(c("dim", `    voice: ${COOK.voice}`));
  out();
  out(c("bold", "  setting"));
  out(c("dim", `    ${COOK.setting}`));
  out();
  out(c("bold", "  encounter"));
  out(`    ${COOK.goalEn}`);
  out(c("dim", `    (${COOK.goalJa})`));
  out();
  out(c("bold", "  word veins to extract from this conversation"));
  for (const v of COOK.veins) {
    out(`    · ${c("cyan", v.word)} (${v.gloss})  ${c("yellow", v.grammar)}`);
  }
  out(HR);
  out();
}

function renderStep(stepIndex: number, total: number, vein: Vein): void {
  out();
  out(c("bold", `  ▸ refine ${stepIndex + 1} / ${total}`));
  out(c("yellow", `      grammar: ${vein.grammar}`));
  out(c("cyan",   `      vocab:   ${vein.word} (${vein.gloss})`));
  out();
}

// Render the introduction card for one word — kanji big, reading,
// meaning, kanji-component breakdown, example sentence.
function renderIntroduction(stepIndex: number, total: number, v: Vein): void {
  const HR = c("dim", "  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
  out();
  out(c("bold", `  ▸ vein ${stepIndex + 1} / ${total}  —  introducing a new word`));
  out();
  out(HR);
  out();
  out(`     ${c("gold", v.word)}     ${c("dim", v.reading)}     ${c("cyan", v.gloss)}`);
  out();
  out(HR);
  out();
  if (v.components.length) {
    out(c("bold", "  components"));
    for (const comp of v.components) {
      out(`    ${c("gold", comp.kanji)}  ${c("dim", "—")}  ${comp.meaning}`);
    }
    out();
  }
  out(c("bold", "  example"));
  out(`    ${c("italic", v.example)}`);
  out(c("dim",   `    ${v.exampleEn}`));
  out();
}

function speakerLine(speaker: string, text: string, color: keyof typeof C = "cyan"): void {
  out(`${c(color, speaker)}: ${text}`);
}

function presence(text: string): void {
  out(c("gray", c("italic", `   ${text}`)));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY required (set it in .env)");

  const ttsEnabled = !opts.noTts;
  const wantBed = !opts.noMusic;
  const scratchDir = join(tmpdir(), "minshuku-mine");
  mkdirSync(scratchDir, { recursive: true });
  const audio: AudioCtx = { enabled: ttsEnabled, apiKey, scratchDir };

  const llm = new GeminiClient(apiKey);
  const rl = createInterface({ input: stdin, output: stdout });

  // Prefetch the opener TTS in parallel with the briefing — instant playback later.
  const openerAudio = prefetchTts(audio, COOK.opener, COOK.voice);

  const bedAbs = resolve(process.cwd(), BED_PATH);
  let bed: BedLoop | null = null;

  process.on("SIGINT", () => {
    if (bed) bed.stop();
    process.exit(130);
  });

  // Voice mode by default — fall back gracefully if ffmpeg is missing or
  // the user passed --text.
  if (!opts.text) {
    const haveFfmpeg = await checkFfmpeg();
    if (!haveFfmpeg) {
      stdout.write(
        c("yellow", "  ⚠ ffmpeg not found — falling back to typed input.\n") +
        c("dim",    "    install with: brew install ffmpeg\n\n"),
      );
      opts.text = true;
    }
  }

  try {
    header();
    out(c("dim", `  music: ${wantBed ? "on" : "off"}, tts: ${ttsEnabled ? `on (${COOK.voice})` : "off"}, input: ${opts.text ? "typed" : `voice (echo ${opts.echoSec}s · reply ${opts.replySec}s)`}`));
    out(c("dim", `  text model: ${TEXT_MODEL}`));
    out();
    renderEncounter();
    await rl.question(c("dim", "  press enter to drift in. "));

    // Start the bed.
    if (wantBed && existsSync(bedAbs)) bed = loopBed(bedAbs);
    else if (wantBed) out(c("gray", `   (bed not found at ${BED_PATH} — silent)`));

    out();
    presence("the airlock cycles. you step into the warm galley.");
    presence("words have settled into the corners like dust. you can feel them — three of them — wanting to be picked up.");
    await pause(800);
    out();

    // ── PHASE 1 — MINING (introduce each word) ─────────────────────────────
    out(c("bold", "  ═════════════════ MINING ═════════════════"));
    out(c("dim",  "  three new words sit in the galley. take each one in: kanji, reading,"));
    out(c("dim",  "  meaning, components. echo the reading aloud to confirm you have it."));
    out();

    const minedReadings: string[] = [];
    let miningGold = 0;
    const baseMineGold = 5;

    for (let i = 0; i < COOK.veins.length; i++) {
      const v = COOK.veins[i];
      renderIntroduction(i, COOK.veins.length, v);
      // Hear the word — "modeled" pronunciation, prefetched for snappiness.
      await speak(audio, v.word, COOK.voice);

      // Gather the player's echo — speech by default, typing on --text fallback.
      let echo = "";
      if (opts.text) {
        out(c("dim", `  echo the reading (type ${v.reading}):`));
        echo = (await rl.question(c("magenta", "» "))).trim();
      } else {
        out(c("dim", `  echo the reading aloud — say  「${v.reading}」`));
        await rl.question(c("dim", `  press enter when ready (${opts.echoSec}s window) `));
        echo = await listen(audio, apiKey, opts.echoSec);
      }

      // Lenient comparison: hiragana, katakana, or kanji of the word all count.
      const valid = readingMatches(echo, v.reading) || readingMatches(echo, v.word);
      if (valid) {
        minedReadings.push(v.reading);
        miningGold += baseMineGold;
        out(c("gold", `   ★ mined ${v.word} (${v.reading}) — +${baseMineGold} kototama`));
      } else if (echo === "") {
        out(c("gray", `   (skipped. the ore stays in the wall — you can come back for it.)`));
      } else {
        // Kind feedback — the player attempted but missed.
        out(c("yellow", `   ◐ not quite — that sounded more like 「${echo}」.`));
        out(c("dim",    `      the reading is  ${v.reading}.  she says it again, slowly.`));
        await speak(audio, v.word, COOK.voice);
        // Award half — they engaged, they heard it again, the word is in their hands.
        miningGold += Math.floor(baseMineGold / 2);
        minedReadings.push(v.reading);
        out(c("gold", `   ★ mined ${v.word} (${v.reading}) — +${Math.floor(baseMineGold / 2)} kototama`));
      }
      await pause(400);
    }

    out();
    presence("the three words are in your hand now. you can feel them — heavier than dust, lighter than tools.");
    await pause(700);
    out();

    // ── PHASE 2 — REFINEMENT (use the words in conversation) ────────────────
    out(c("bold", "  ═══════════════ REFINEMENT ═══════════════"));
    out(c("dim",  "  she's been waiting. now use the words you mined — speak them in context"));
    out(c("dim",  "  and they'll polish themselves into kototama."));
    out();
    await pause(500);

    // Opener — authored, prefetched audio plays instantly.
    speakerLine(COOK.speaker, COOK.opener, "cyan");
    await playPrefetched(openerAudio);
    const transcript: TranscriptLine[] = [{ speaker: "GALLEY-V2", text: COOK.opener }];
    out();

    let refinedWords: string[] = [];
    let refineGold = 0;
    const baseRefineGold = 12;

    for (let i = 0; i < COOK.veins.length; i++) {
      const v = COOK.veins[i];

      // Get her live next line driving toward this vein's target.
      let cookLine: string;
      try {
        if (i > 0) {
          presence("she pauses, ladles something, then turns back to you.");
          await pause(400);
        }
        process.stderr.write(c("dim", "   …\r"));
        cookLine = await getCookLine(llm, transcript, v.word, v.gloss, v.grammar);
        process.stderr.write("        \r");
        out();
        speakerLine(COOK.speaker, cookLine, "cyan");
        transcript.push({ speaker: "GALLEY-V2", text: cookLine });
        await speak(audio, cookLine, COOK.voice);
      } catch (err) {
        out(c("gray", `   (gen failed: ${err instanceof Error ? err.message : String(err)})`));
        cookLine = `${v.gloss}のこと、教えてもらえますか？`;
        speakerLine(COOK.speaker, cookLine, "cyan");
        transcript.push({ speaker: "GALLEY-V2", text: cookLine });
      }

      renderStep(i, COOK.veins.length, v);

      // Gather the reply — speech by default, typing on --text.
      let reply = "";
      if (opts.text) {
        reply = (await rl.question(c("magenta", "» "))).trim();
      } else {
        out(c("dim", `  speak your reply — use ${c("yellow", v.grammar)} and ${c("cyan", v.word)}.`));
        await rl.question(c("dim", `  press enter when ready (${opts.replySec}s window) `));
        reply = await listen(audio, apiKey, opts.replySec);
      }

      if (!reply) {
        out(c("gray", "   (the moment passes — but the word stays mined.)"));
        continue;
      }
      transcript.push({ speaker: "you", text: reply });

      // Did they actually use the word? Heavier reward when they did.
      const used = wordUsedInReply(reply, v);
      const grammarBonus = reply.length > 10 ? 3 : 0;
      const usageBonus = used ? 4 : 0;
      const total = baseRefineGold + grammarBonus + usageBonus;
      refineGold += total;
      refinedWords.push(v.word);
      out();
      out(c("gold",
        `   ★ refined ${v.word} (${v.gloss}) — +${total} kototama` +
        c("dim", `  (base ${baseRefineGold}` +
                 (grammarBonus ? ` · +${grammarBonus} length` : "") +
                 (usageBonus ? ` · +${usageBonus} word used` : " · word missing — half polish") +
                 ")"),
      ));
      await pause(500);
    }

    // Closing — short, authored.
    out();
    presence("she nods once, turns back to the stove. the rim of her optical sensor catches the lamplight.");
    await pause(500);
    out();

    // ── Summary ─────────────────────────────────────────────────────────────
    const allMined = minedReadings.length === COOK.veins.length;
    const allRefined = refinedWords.length === COOK.veins.length;
    const totalGold = miningGold + refineGold;
    const HR = c("dim", "  ────────────────────────────────────────────────────");
    out(HR);
    out(c("bold", "  encounter complete"));
    out();
    out(`  ${c("dim", "with:")} ${COOK.displayName}`);
    out();
    out(`  ${c("dim", "mining (introduce):")}     ${c("gold", `+${miningGold} kototama`)}  ${c("dim", `(${minedReadings.length} / ${COOK.veins.length} veins)`)}`);
    out(`  ${c("dim", "refinement (use):")}       ${c("gold", `+${refineGold} kototama`)}  ${c("dim", `(${refinedWords.length} / ${COOK.veins.length} veins)`)}`);
    out(`  ${c("dim", "total earned:")}           ${c("gold", `+${totalGold} kototama`)}`);
    out();
    if (allMined && allRefined) {
      out(`  ${c("green", "★")} ${c("bold", "Main Galley fully mapped")} — node lit on the 食 sector map.`);
    } else if (allMined) {
      out(`  ${c("yellow", "◐")} all three veins mined, ${refinedWords.length} of ${COOK.veins.length} refined.`);
      out(c("dim", `       talk to her again to polish the rest into full kototama.`));
    } else {
      out(`  ${c("yellow", "◐")} ${minedReadings.length} / ${COOK.veins.length} veins extracted from Main Galley.`);
      out(c("dim", `       come back to mine the rest.`));
    }
    out(HR);
    out();
  } finally {
    rl.close();
    if (bed) bed.stop();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[mine] failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
