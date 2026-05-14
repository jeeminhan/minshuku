// Finale proof-of-concept: the Speaking Out.
//
// Simulates the climactic seven-line incantation against the Silence Demon
// using a HARD-CODED fake learning record, with optional Gemini TTS for the
// authored Japanese lines and an ambient shrine bed underneath.
//
// Run with:
//   npm run finale                 # full audio
//   npm run finale -- --no-tts     # text only
//   npm run finale -- --no-music   # voices, no ambient bed
//
// TTS is opt-out: if GEMINI_API_KEY is missing the script falls back to text
// only and prints a notice. Player-typed lines are intentionally NOT spoken
// back — only the authored, world-spoken lines and Aoi's epilogue are voiced.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import "dotenv/config";

import { synthesizeSpeech } from "../src/lib/audio/tts.js";

// ---------------------------------------------------------------------------
// Voices, bed
// ---------------------------------------------------------------------------

// Voice choices tuned to the finale's emotional cast:
//   you   — Puck       (ja-friendly-young-adult; warm, present)
//   Aoi   — Aoede      (ja-soft-ambiguous; small, returning)
//   coach — Iapetus    (ja-formal-male; calm narrator)
const VOICE_YOU = "Puck";
const VOICE_AOI = "Aoede";
const VOICE_COACH = "Iapetus";

const BED_REL_PATH = "tmp/sample-shrine.wav";
const BED_VOLUME = "0.18"; // a touch quieter than scene:play; finale should breathe

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  noMusic: boolean;
  noTts: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let noMusic = false;
  let noTts = false;
  for (const arg of argv) {
    if (arg === "--no-music") noMusic = true;
    else if (arg === "--no-tts") noTts = true;
    else if (arg === "--help" || arg === "-h") {
      stdout.write(
        [
          "Finale proof-of-concept (the Speaking Out).",
          "",
          "  --no-music   Disable the ambient shrine bed",
          "  --no-tts     Disable text-to-speech (text only)",
          "",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { noMusic, noTts };
}

// ---------------------------------------------------------------------------
// Fake learning record
// ---------------------------------------------------------------------------

type GrammarMastery = "mastered" | "skipped" | "weakest";
type WordState = "bright" | "dim" | "whispered" | "lost";

interface FakeRecord {
  grammar: Record<string, GrammarMastery>;
  pool: Record<string, WordState>;
  weakestForm: string;
}

const RECORD: FakeRecord = {
  grammar: {
    "masu-form": "mastered",
    "ukemi-passive": "skipped",
    "te-shimau": "weakest",
    "temo-daijobu": "mastered",
    "sequence-markers": "mastered",
    "te-miru": "mastered",
  },
  pool: {
    "葵": "bright",
    "妹": "bright",
    "朝": "bright",
    "ごはん": "bright",
    "温かい": "bright",
    "一緒": "bright",
    "笑う": "bright",
    "暗い": "bright",
    "怖い": "dim",
    "帰る": "whispered",
    "離す": "bright",
    "信じる": "lost",
  },
  weakestForm: "te-shimau",
};

// ---------------------------------------------------------------------------
// ANSI styling
// ---------------------------------------------------------------------------

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  italic: "\x1b[3m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
} as const;

const c = (color: keyof typeof C, text: string): string =>
  `${C[color]}${text}${C.reset}`;

const line = (text = ""): void => {
  stdout.write(text + "\n");
};
const pause = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Audio: ambient bed + TTS
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
): Promise<void> {
  if (!audio.enabled || !audio.apiKey) return;
  try {
    const wav = await synthesizeSpeech({
      apiKey: audio.apiKey,
      text,
      voice,
    });
    const path = join(audio.scratchDir, `${randomUUID()}.wav`);
    writeFileSync(path, wav);
    await playWav(path);
  } catch (err) {
    line(
      c(
        "gray",
        `   (tts skipped: ${err instanceof Error ? err.message : String(err)})`,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

interface RitualLine {
  index: number;
  title: string;
  grammar: string;
  grammarLabel: string;
  reclaims: readonly string[];
  perform: (
    rl: Interface,
    state: RitualState,
    audio: AudioCtx,
  ) => Promise<LineOutcome>;
}

interface LineOutcome {
  success: boolean;
  reclaimed: readonly string[];
  failed: readonly string[];
  note?: string;
}

interface RitualState {
  reclaimed: Set<string>;
  failed: Set<string>;
  linesSpoken: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const norm = (s: string): string => s.trim().toLowerCase().normalize("NFKC");

async function ask(rl: Interface, prompt: string): Promise<string> {
  const ans = await rl.question(prompt);
  return ans.trim();
}

async function microRecovery(
  rl: Interface,
  word: string,
): Promise<boolean> {
  line(
    c(
      "dim",
      `   …「${word}」 has gone quiet. Speak it three times to bring it back.`,
    ),
  );
  for (let i = 1; i <= 3; i++) {
    const ans = await ask(rl, c("magenta", `   (${i}/3) `));
    if (norm(ans) !== norm(word)) {
      line(c("gray", "   …the syllable falls into the dark."));
      return false;
    }
  }
  line(c("green", `   「${word}」 — clear again.`));
  return true;
}

function header(title: string, grammar: string): void {
  line();
  line(c("bold", `── ${title} ──`));
  line(c("dim", `   grammar: ${grammar}`));
  line();
}

function speakerLine(
  speaker: string,
  text: string,
  color: keyof typeof C = "cyan",
): void {
  line(`${c(color, speaker)}: ${text}`);
}

function presence(text: string): void {
  line(c("gray", c("italic", `   ${text}`)));
}

function coachText(text: string): void {
  line(c("dim", `coach: ${text}`));
}

// ---------------------------------------------------------------------------
// The seven lines
// ---------------------------------------------------------------------------

const LINES: readonly RitualLine[] = [
  {
    index: 1,
    title: "LINE 1 — Calling her name",
    grammar: "masu-form",
    grammarLabel: "ます形 (polite)",
    reclaims: ["葵", "妹"],
    async perform(_rl, _state, audio) {
      const text = "妹の葵を、家へ返していただきます。";
      speakerLine("you", text, "yellow");
      await speak(audio, text, VOICE_YOU);
      await pause(400);
      presence("the demon's edges shudder. Aoi's breath catches.");
      presence("her name returns to her — clearly.");
      return { success: true, reclaimed: this.reclaims, failed: [] };
    },
  },

  {
    index: 2,
    title: "LINE 2 — Refusing the lie",
    grammar: "ukemi-passive",
    grammarLabel: "受身 (passive)",
    reclaims: ["信じる"],
    async perform(_rl, _state, _audio) {
      line(
        c(
          "gray",
          c(
            "italic",
            "   (you never warded a 嘘鬼. the line cannot be spoken.)",
          ),
        ),
      );
      await pause(900);
      presence("the Silence Demon laughs, soundlessly.");
      presence("「信じる」— the word for trust — stays behind in the dark.");
      coachText(c("italic", "next time, you'll be able to speak it."));
      return {
        success: false,
        reclaimed: [],
        failed: this.reclaims,
        note: "skipped grammar",
      };
    },
  },

  {
    index: 3,
    title: "LINE 3 — Naming the regret",
    grammar: "te-shimau",
    grammarLabel: "～てしまう (your weakest)",
    reclaims: ["離す"],
    async perform(rl, _state, _audio) {
      line(c("red", "   ※ this is the form you most avoided. no hint."));
      line(c("dim", "   speak the regret. ～てしまう must appear."));
      await pause(400);
      const ans = await ask(rl, c("magenta", "» "));
      const ok = ans.includes("しまっ") || ans.includes("ちゃっ");
      if (ok) {
        await pause(500);
        presence("the demon flinches violently.");
        presence(
          "～てしまう, the form you most avoided, lands like a struck bell.",
        );
        return { success: true, reclaimed: this.reclaims, failed: [] };
      }
      line(c("gray", "   the line falters. the demon presses in."));
      return {
        success: false,
        reclaimed: [],
        failed: this.reclaims,
        note: "weakest form not produced",
      };
    },
  },

  {
    index: 4,
    title: "LINE 4 — Offering safety",
    grammar: "temo-daijobu",
    grammarLabel: "～ても大丈夫",
    reclaims: ["暗い", "怖い"],
    async perform(rl, _state, audio) {
      line(c("dim", "   slot 1: 暗い (bright — flows on its own)"));
      line(c("yellow", "   slot 2: ___ (dim — type the word for fear)"));
      const ans = await ask(
        rl,
        c("magenta", "» 暗くても、___ても、もう大丈夫だよ。\n  fear: "),
      );
      const reclaimed: string[] = ["暗い"];
      const failed: string[] = [];
      const got = norm(ans) === norm("怖い") || norm(ans) === norm("こわい");
      if (got) reclaimed.push("怖い");
      else failed.push("怖い");

      const fearWord = got ? "怖い" : "○";
      const spoken = `暗くても、${fearWord}くても、もう大丈夫だよ。`;
      speakerLine("you", spoken, "yellow");
      await speak(audio, spoken, VOICE_YOU);

      await pause(400);
      if (got) presence("both words flow back to her.");
      else line(c("gray", "   「怖い」 stays dim. but 暗い flows."));
      return { success: reclaimed.length === 2, reclaimed, failed };
    },
  },

  {
    index: 5,
    title: "LINE 5 — Setting the path",
    grammar: "sequence-markers",
    grammarLabel: "まず・次に・最後に",
    reclaims: ["帰る", "朝"],
    async perform(rl, _state, audio) {
      line(
        c("dim", "   the path has three steps. one of the words has gone quiet."),
      );
      const recovered = await microRecovery(rl, "帰る");
      const reclaimed: string[] = ["朝"];
      const failed: string[] = [];
      if (recovered) reclaimed.push("帰る");
      else failed.push("帰る");
      await pause(300);
      const homeVerb = recovered ? "帰" : "○";
      const text = `まず、家に${homeVerb}ろう。次に、お母さんに会おう。最後に、朝のことを話そう。`;
      speakerLine("you", text, "yellow");
      await speak(audio, text, VOICE_YOU);
      await pause(400);
      if (recovered) presence("the demon's silhouette begins to thin.");
      else presence("the path wavers — but holds, mostly.");
      return { success: recovered, reclaimed, failed };
    },
  },

  {
    index: 6,
    title: "LINE 6 — Trying the unknown",
    grammar: "te-miru",
    grammarLabel: "～てみる",
    reclaims: ["笑う"],
    async perform(_rl, _state, audio) {
      const text = "もう一度、笑ってみて。";
      speakerLine("you", text, "yellow");
      await speak(audio, text, VOICE_YOU);
      await pause(500);
      presence("Aoi tries.");
      return { success: true, reclaimed: this.reclaims, failed: [] };
    },
  },

  {
    index: 7,
    title: "LINE 7 — The form again, alone",
    grammar: "te-shimau",
    grammarLabel: "～てしまう (no scaffolding)",
    reclaims: ["一緒"],
    async perform(rl, _state, _audio) {
      line(
        c(
          "red",
          "   the demon reaches its last shape. ～てしまう, alone, no help.",
        ),
      );
      await pause(400);
      const ans = await ask(rl, c("magenta", "» "));
      const ok =
        ans.includes("しまわ") ||
        ans.includes("しまう") ||
        ans.includes("しまっ");
      if (ok) {
        await pause(700);
        presence("the Silence Demon dissolves — not destroyed, but spoken-past.");
        presence("the crack closes.");
        return { success: true, reclaimed: this.reclaims, failed: [] };
      }
      line(c("gray", "   the demon does not dissolve. it withdraws — for now."));
      return { success: false, reclaimed: [], failed: this.reclaims };
    },
  },
];

// ---------------------------------------------------------------------------
// Aoi's epilogue
// ---------------------------------------------------------------------------

interface Epilogue {
  spoken: string;
  lostNote: string;
}

function buildEpilogue(state: RitualState): Epilogue {
  const has = (w: string): boolean => state.reclaimed.has(w);
  const parts: string[] = [];

  parts.push(has("葵") ? "お……お兄ちゃん……" : "お……");

  if (has("朝") && has("ごはん") && has("温かい")) {
    parts.push("朝のごはん、まだ温かい？");
  } else if (has("朝")) {
    parts.push("朝……");
  }

  if (has("一緒") && has("帰る")) {
    parts.push("一緒に、家に帰ろう。");
  } else if (has("帰る")) {
    parts.push("家に……帰ろう。");
  } else if (has("一緒")) {
    parts.push("一緒に……。");
  }

  if (has("笑う")) parts.push("ね、笑って。");

  const lostBits: string[] = [];
  if (state.failed.has("信じる")) lostBits.push("trust");
  if (state.failed.has("怖い")) lostBits.push("the word for fear");
  if (state.failed.has("帰る")) lostBits.push("the word for going home");

  return {
    spoken: parts.join(" "),
    lostNote: lostBits.length
      ? `(she pauses on ${lostBits.join(", ")} — and lets it pass without naming. she'll learn it again.)`
      : "",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const apiKeyRaw = process.env.GEMINI_API_KEY;
  const apiKey = apiKeyRaw && apiKeyRaw.length > 0 ? apiKeyRaw : null;
  const ttsEnabled = !opts.noTts && apiKey !== null;

  const scratchDir = join(tmpdir(), "minshuku-finale");
  mkdirSync(scratchDir, { recursive: true });

  const audio: AudioCtx = {
    enabled: ttsEnabled,
    apiKey,
    scratchDir,
  };

  const bedPath = resolve(process.cwd(), BED_REL_PATH);
  const wantBed = !opts.noMusic && existsSync(bedPath);
  const bed = wantBed ? loopBed(bedPath) : null;

  const cleanup = (): void => {
    if (bed) bed.stop();
  };
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    line();
    line(c("bold", "  影の糸 — the Speaking Out"));
    line(
      c("dim", "  proof of concept · finale only · hardcoded learning record"),
    );
    line(
      c(
        "dim",
        `  audio: ${ttsEnabled ? "tts on" : opts.noTts ? "tts disabled" : "tts unavailable (no GEMINI_API_KEY)"}, ${wantBed ? "bed on" : "bed off"}`,
      ),
    );
    line();
    line(c("dim", "  the crack at the hilltop shrine."));
    line(
      c(
        "dim",
        "  the Silence Demon, vast and quiet, holds Aoi like cupped hands",
      ),
    );
    line(c("dim", "  hold a candle."));
    line();
    await pause(600);
    coachText(
      "this is the speaking-out. seven lines. each calls one of the wards you carry.",
    );
    coachText(
      "lines you cannot speak, you must skip — and what they would have returned, she will not have.",
    );
    line();
    await ask(rl, c("dim", "  press enter when you're ready. "));

    const state: RitualState = {
      reclaimed: new Set(),
      failed: new Set(),
      linesSpoken: 0,
    };

    for (const ln of LINES) {
      header(ln.title, ln.grammarLabel);
      const outcome = await ln.perform(rl, state, audio);
      for (const w of outcome.reclaimed) state.reclaimed.add(w);
      for (const w of outcome.failed) state.failed.add(w);
      if (outcome.success) state.linesSpoken += 1;
      await pause(800);
    }

    line();
    line(c("bold", "── she comes back ──"));
    line();
    await pause(600);
    presence("Aoi turns. she finds her voice piece by piece.");
    await pause(700);
    line();

    const ep = buildEpilogue(state);
    speakerLine("Aoi", ep.spoken, "green");
    await speak(audio, ep.spoken, VOICE_AOI);
    if (ep.lostNote) line(c("gray", c("italic", ep.lostNote)));
    line();
    await pause(700);

    line(c("dim", "─".repeat(60)));
    line(c("dim", `lines spoken: ${state.linesSpoken} / 7`));
    line(
      c(
        "dim",
        `words reclaimed: ${[...state.reclaimed].join("、") || "—"}`,
      ),
    );
    line(
      c(
        "dim",
        `words she lost today: ${[...state.failed].join("、") || "—"}`,
      ),
    );
    line();
  } finally {
    rl.close();
    cleanup();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[finale] failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
