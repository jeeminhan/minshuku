// Interactive REPL: type Japanese, hear it spoken via Gemini 3.1 Flash TTS.
//
// Usage:
//   npm run tts:repl
//   npm run tts:repl -- --voice Puck
//
// Commands at the prompt:
//   /voice <name>   Switch voice (Kore, Puck, Charon, Fenrir, Aoede, ...)
//   /quit | /exit   Leave

import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import "dotenv/config";

import {
  GEMINI_TTS_DEFAULT_VOICE,
  synthesizeSpeech,
} from "../src/lib/audio/tts.js";

interface CliOptions {
  voice: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = { voice: GEMINI_TTS_DEFAULT_VOICE };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = (): string => {
      const val = argv[++i];
      if (!val) throw new Error(`Missing value for ${arg}`);
      return val;
    };
    if (arg === "--voice") opts.voice = take();
    else if (arg === "--help" || arg === "-h") {
      stdout.write(
        "tts-repl: type Japanese, hear it spoken.\n  --voice <name>\n",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function playWav(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("afplay", [path], { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`afplay exited with code ${code}`));
    });
  });
}

async function speak(
  apiKey: string,
  text: string,
  voice: string,
  scratchDir: string,
): Promise<void> {
  const started = Date.now();
  const wav = await synthesizeSpeech({ apiKey, text, voice });
  const path = join(scratchDir, `${randomUUID()}.wav`);
  writeFileSync(path, wav);
  const synthMs = Date.now() - started;
  const seconds = (wav.byteLength - 44) / (24_000 * 2);
  stdout.write(
    `  ↳ ${seconds.toFixed(1)}s audio · synth ${synthMs}ms · ${voice}\n`,
  );
  await playWav(path);
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required (set it in .env)");

  const opts = parseArgs(process.argv.slice(2));
  let voice = opts.voice;

  const scratchDir = join(tmpdir(), "minshuku-tts");
  mkdirSync(scratchDir, { recursive: true });

  const rl = createInterface({ input: stdin, output: stdout });
  stdout.write(
    `tts-repl ready · voice=${voice} · /voice <name> to switch · /quit to exit\n`,
  );

  try {
    while (true) {
      const line = (await rl.question("» ")).trim();
      if (!line) continue;
      if (line === "/quit" || line === "/exit") break;
      if (line.startsWith("/voice ")) {
        voice = line.slice("/voice ".length).trim() || voice;
        stdout.write(`  ↳ voice=${voice}\n`);
        continue;
      }
      try {
        await speak(apiKey, line, voice, scratchDir);
      } catch (err) {
        stdout.write(
          `  ↳ error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[tts-repl] failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
