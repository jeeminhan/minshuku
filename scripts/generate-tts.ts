// Generate a WAV file from Gemini 3.1 Flash TTS Preview.
//
// Usage:
//   npm run tts -- --text "こんにちは、今日は晴れですね。"
//   npm run tts -- --text "..." --voice Puck --out public/audio/hello.wav

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import "dotenv/config";

import {
  GEMINI_TTS_DEFAULT_VOICE,
  GEMINI_TTS_MODEL,
  synthesizeSpeech,
} from "../src/lib/audio/tts.js";

interface CliOptions {
  text: string;
  voice: string;
  out: string | null;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = {
    text: "",
    voice: GEMINI_TTS_DEFAULT_VOICE,
    out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = (): string => {
      const val = argv[++i];
      if (!val) throw new Error(`Missing value for ${arg}`);
      return val;
    };
    if (arg === "--text") opts.text = take();
    else if (arg === "--voice") opts.voice = take();
    else if (arg === "--out") opts.out = take();
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.text) throw new Error("--text is required");
  return opts;
}

function printHelp(): void {
  process.stdout.write(
    [
      "Generate a WAV from Gemini 3.1 Flash TTS Preview.",
      "",
      "  --text <string>   Text to speak (required)",
      "  --voice <name>    Prebuilt voice (default: Kore)",
      "  --out <path>      Output WAV path (default public/audio/tts.wav)",
      "",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required (set it in .env)");

  const opts = parseArgs(process.argv.slice(2));
  const outPath = opts.out ?? join(process.cwd(), "public", "audio", "tts.wav");

  process.stderr.write(`[tts] model=${GEMINI_TTS_MODEL} voice=${opts.voice}\n`);
  process.stderr.write(`[tts] text: ${opts.text}\n`);

  const wav = await synthesizeSpeech({
    apiKey,
    text: opts.text,
    voice: opts.voice,
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, wav);
  process.stderr.write(
    `[tts] wrote ${(wav.byteLength / 1024).toFixed(1)} KiB → ${outPath}\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[tts] failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
