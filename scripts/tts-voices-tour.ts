// Cycle through Gemini TTS voices over a looping ambient bed.
//
// Usage:
//   npm run tts:tour
//   npm run tts:tour -- --bed tmp/sample-shrine.wav --text "ようこそ、神社へ。"

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { stdout } from "node:process";
import "dotenv/config";

import { synthesizeSpeech } from "../src/lib/audio/tts.js";

// Full Gemini prebuilt voice catalog (30 voices, as of 3.1 Flash TTS preview).
const VOICES: readonly string[] = [
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat",
];

const DEFAULT_BED = "tmp/sample-shrine.wav";
const DEFAULT_TEXT = "ようこそ、神社へ。ご参拝、ありがとうございます。";
const BED_VOLUME = "0.25";

interface CliOptions {
  bed: string;
  text: string;
  voices: readonly string[];
}

function parseArgs(argv: readonly string[]): CliOptions {
  let bed = DEFAULT_BED;
  let text = DEFAULT_TEXT;
  let voices: readonly string[] = VOICES;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = (): string => {
      const val = argv[++i];
      if (!val) throw new Error(`Missing value for ${arg}`);
      return val;
    };
    if (arg === "--bed") bed = take();
    else if (arg === "--text") text = take();
    else if (arg === "--voices") voices = take().split(",").map((v) => v.trim()).filter(Boolean);
    else if (arg === "--help" || arg === "-h") {
      stdout.write(
        [
          "Cycle through Gemini TTS voices over a looping ambient bed.",
          "",
          "  --bed <path>      Background WAV to loop (default tmp/sample-shrine.wav)",
          "  --text <string>   Phrase to speak with each voice",
          "  --voices <csv>    Comma-separated subset (default: all 30)",
        ].join("\n") + "\n",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { bed, text, voices };
}

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
      /* swallow — the foreground voice loop continues either way */
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

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required (set it in .env)");

  const opts = parseArgs(process.argv.slice(2));
  const bedPath = resolve(process.cwd(), opts.bed);
  if (!existsSync(bedPath)) {
    throw new Error(`Bed file not found: ${bedPath}`);
  }

  const scratchDir = join(tmpdir(), "minshuku-tts");
  mkdirSync(scratchDir, { recursive: true });

  stdout.write(
    `tour · ${opts.voices.length} voices · bed=${opts.bed} · text="${opts.text}"\n`,
  );

  const bed = loopBed(bedPath);
  const cleanup = (): void => bed.stop();
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    for (let i = 0; i < opts.voices.length; i++) {
      const voice = opts.voices[i];
      stdout.write(`\n[${i + 1}/${opts.voices.length}] ${voice}\n`);
      try {
        const wav = await synthesizeSpeech({
          apiKey,
          text: opts.text,
          voice,
        });
        const path = join(scratchDir, `${voice}-${randomUUID()}.wav`);
        writeFileSync(path, wav);
        await playWav(path);
      } catch (err) {
        stdout.write(
          `  ↳ skipped: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }
  } finally {
    cleanup();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[tts-tour] failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
