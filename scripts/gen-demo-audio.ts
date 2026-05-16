// One-off: pre-generate the demo's NPC audio with Gemini 3.1 TTS.
// The demo scene is canned, so mom's lines never change — generate once,
// commit the WAVs as static assets, no runtime API key on Vercel.
//
//   npm run gen-demo-audio

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "dotenv/config";
import { synthesizeSpeech, GEMINI_TTS_MODEL } from "../src/lib/audio/tts.js";

const VOICE = "Leda"; // warm female — matches the canonical Tanaka-san voice

const LINES: { file: string; text: string }[] = [
  {
    file: "mom-1.wav",
    text: "いらっしゃいませ。遠いところ、よくいらっしゃいました。田中と申します。",
  },
  {
    file: "mom-2.wav",
    text: "まあ、ご丁寧に。お疲れでしょう。お部屋にご案内しますね。お荷物、お持ちしましょうか。",
  },
  {
    file: "mom-3.wav",
    text: "では、こちらへどうぞ。お茶を入れますね。ゆっくりしてください。",
  },
];

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required (set it in .env)");

  const outDir = join(process.cwd(), "demo", "public", "audio");
  mkdirSync(outDir, { recursive: true });

  console.log(`Generating ${LINES.length} lines with ${GEMINI_TTS_MODEL} (voice: ${VOICE})`);

  for (const line of LINES) {
    const wav = await synthesizeSpeech({ apiKey, text: line.text, voice: VOICE });
    const path = join(outDir, line.file);
    writeFileSync(path, wav);
    console.log(`  ✓ ${line.file}  (${(wav.length / 1024).toFixed(0)} KB)`);
  }

  console.log("Done. WAVs written to demo/public/audio/");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
