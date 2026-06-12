// One-off: pre-generate the demo's spoken audio with Gemini 3.1 TTS, so the
// web app can play NPC + coach lines as committed static assets — no runtime
// API key on Vercel, no per-turn API calls.
//
// The four demo-day fixtures are canned, so their dialogue never changes:
// generate once locally with the repo .env key, commit the m4a files, done.
//
//   npm run gen-fixture-audio        (from web/)
//
// NEVER runs in CI, at runtime, or during QA — the criteria verify the
// committed bytes only.
//
// Line text is parsed out of the four fixture JSONs (the generateDialogue
// response's briefing / turns / result), so the clips can never drift from the
// fixtures the app actually replays.

import { mkdirSync, writeFileSync, statSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

import { synthesizeSpeech, GEMINI_TTS_MODEL } from "@engine/audio/tts";

// The repo .env (with GEMINI_API_KEY) lives at the monorepo root, one level up
// from web/. Load it explicitly so the script works regardless of cwd.
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env") });

import day1 from "../fixtures/episode-demo-learner.json";
import day2 from "../fixtures/episode-demo-learner-day2.json";
import day3 from "../fixtures/episode-demo-learner-day3.json";
import day4 from "../fixtures/episode-demo-learner-day4.json";

// voiceConfig label → Gemini prebuilt voice. Mom is pinned to Leda (the
// canonical Tanaka-san voice, per scripts/gen-demo-audio.ts); the other three
// NPCs each get a distinct voice from the 30-voice catalog
// (scripts/tts-voices-tour.ts). The coach speaks English and uses Kore — the
// codebase's canonical GEMINI_TTS_DEFAULT_VOICE, distinct from all four NPCs.
const VOICE_BY_CONFIG: Record<string, string> = {
  "ja-warm-female": "Leda", // mom (day 4)
  "ja-friendly-young-adult": "Puck", // cafe_regular (day 1)
  "ja-soft-ambiguous": "Aoede", // stranger (day 2)
  "ja-warm-middle-aged": "Charon", // bookshop_owner (day 3)
};
const COACH_VOICE = "Kore";

interface FixtureFile {
  responses: { label: string; text: string }[];
}

interface DialogueResponse {
  briefing: string;
  result: string;
  turns: { turn: number; speaker: string; text: string }[];
}

// The voiceConfig the demo day's NPC template carries. Kept here (not read from
// data/templates) so the script is self-contained, but it mirrors the template
// JSONs: cafe_regular=ja-friendly-young-adult, stranger=ja-soft-ambiguous,
// bookshop_owner=ja-warm-middle-aged, mom=ja-warm-female.
const VOICE_CONFIG_BY_DAY: Record<number, string> = {
  1: "ja-friendly-young-adult",
  2: "ja-soft-ambiguous",
  3: "ja-warm-middle-aged",
  4: "ja-warm-female",
};

interface ClipSpec {
  file: string; // e.g. day1-turn2.m4a
  text: string;
  voice: string;
}

function dialogueOf(fixture: FixtureFile): DialogueResponse {
  const entry = fixture.responses.find((r) => r.label === "generateDialogue");
  if (!entry) throw new Error("Fixture is missing its generateDialogue response");
  return JSON.parse(entry.text) as DialogueResponse;
}

function clipsForDay(day: number, fixture: FixtureFile): ClipSpec[] {
  const dialogue = dialogueOf(fixture);
  const npcVoice = VOICE_CONFIG_BY_DAY[day];
  const voice = VOICE_BY_CONFIG[npcVoice];
  if (!voice) throw new Error(`No voice mapped for ${npcVoice} (day ${day})`);

  const clips: ClipSpec[] = [
    { file: `day${day}-briefing.m4a`, text: dialogue.briefing, voice: COACH_VOICE },
    { file: `day${day}-result.m4a`, text: dialogue.result, voice: COACH_VOICE },
  ];
  for (const turn of dialogue.turns) {
    clips.push({ file: `day${day}-turn${turn.turn}.m4a`, text: turn.text, voice });
  }
  return clips;
}

function parseRetrySeconds(message: string): number {
  const match = message.match(/retry in ([\d.]+)s/i) ?? message.match(/"retryDelay":\s*"(\d+)s"/);
  const secs = match ? Number(match[1]) : NaN;
  return Number.isFinite(secs) ? Math.ceil(secs) + 2 : 35;
}

const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

// Free-tier TTS is rate-limited (~10 requests per rolling window). On a 429,
// honor the server's retryDelay and try again, up to a few attempts per clip.
async function synthWithRetry(apiKey: string, text: string, voice: string): Promise<Buffer> {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await synthesizeSpeech({ apiKey, text, voice });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimit = message.includes("429") || message.includes("RESOURCE_EXHAUSTED");
      if (!isRateLimit || attempt === maxAttempts) throw err;
      const waitS = parseRetrySeconds(message);
      console.log(`    … rate-limited, waiting ${waitS}s (attempt ${attempt}/${maxAttempts})`);
      await sleep(waitS * 1000);
    }
  }
  throw new Error("unreachable");
}

function encodeWavToM4a(wav: Buffer, m4aPath: string): void {
  const tmpWav = join(tmpdir(), `tts-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}.wav`);
  writeFileSync(tmpWav, wav);
  try {
    const result = spawnSync(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-y", "-i", tmpWav, "-c:a", "aac", "-b:a", "64k", "-ac", "1", m4aPath],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    if (result.error) {
      if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error("ffmpeg not found on PATH. Install it (e.g. `brew install ffmpeg`).");
      }
      throw result.error;
    }
    if (result.status !== 0) throw new Error(`ffmpeg exited with status ${result.status}`);
  } finally {
    try {
      unlinkSync(tmpWav);
    } catch {
      /* already gone */
    }
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required (set it in .env)");

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "public", "tts");
  mkdirSync(outDir, { recursive: true });

  const fixtures: { day: number; fixture: FixtureFile }[] = [
    { day: 1, fixture: day1 as FixtureFile },
    { day: 2, fixture: day2 as FixtureFile },
    { day: 3, fixture: day3 as FixtureFile },
    { day: 4, fixture: day4 as FixtureFile },
  ];
  const clips = fixtures.flatMap(({ day, fixture }) => clipsForDay(day, fixture));

  console.log(`Generating ${clips.length} clips with ${GEMINI_TTS_MODEL}`);

  let total = 0;
  for (const clip of clips) {
    const outPath = join(outDir, clip.file);
    // Idempotent / resumable: a clip already on disk is left untouched, so a
    // re-run after a rate-limit stop only synthesizes the missing files.
    if (existsSync(outPath)) {
      const size = statSync(outPath).size;
      total += size;
      console.log(`  · ${clip.file.padEnd(18)} ${clip.voice.padEnd(8)} (exists, ${(size / 1024).toFixed(0)} KB)`);
      continue;
    }
    const wav = await synthWithRetry(apiKey, clip.text, clip.voice);
    encodeWavToM4a(wav, outPath);
    const size = statSync(outPath).size;
    total += size;
    console.log(`  ✓ ${clip.file.padEnd(18)} ${clip.voice.padEnd(8)} (${(size / 1024).toFixed(0)} KB)`);
  }

  console.log(`\nDone. ${clips.length} m4a files in public/tts/ — total ${(total / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
