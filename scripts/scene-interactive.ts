// Interactive mini scene player.
// Pick a template → LLM generates the scene → each NPC line is spoken via
// Gemini TTS in the character's voice while the location's ambient bed loops
// underneath. Player turns prompt for input via readline.
//
// Usage:
//   npm run scene:play -- --template shrine-afternoon-keeper
//   npm run scene:play -- --template minshuku-evening-with-kid --no-music

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import "dotenv/config";

import { loadTemplates } from "../src/lib/content.js";
import { GeminiClient } from "../src/lib/llm/client.js";
import { generateDialogue } from "../src/lib/llm/generateDialogue.js";
import {
  generateNextNpcLine,
  type ConversationLine,
} from "../src/lib/llm/generateAdaptive.js";
import { synthesizeSpeech } from "../src/lib/audio/tts.js";
import type {
  CharacterRef,
  ItemAssignment,
  ScenePlan,
  SceneTemplate,
} from "../src/lib/types.js";

// voiceConfig → Gemini prebuilt voice. Tune to taste after the voices tour.
const VOICE_MAP: Record<string, string> = {
  "ja-elder-male": "Charon",
  "ja-formal-female": "Gacrux",
  "ja-formal-male": "Iapetus",
  "ja-friendly-young-adult": "Puck",
  "ja-soft-ambiguous": "Aoede",
  "ja-warm-female": "Leda",
  "ja-warm-middle-aged": "Kore",
  "ja-young-casual": "Zephyr",
};
const FALLBACK_VOICE = "Kore";

// location → ambient bed file (relative to repo root). null = silent.
const BED_MAP: Record<string, string | null> = {
  shrine: "tmp/sample-shrine.wav",
  minshuku: "tmp/sample-minshuku.wav",
  cafe: "tmp/sample-cafe.wav",
  bookshop: "tmp/sample-bookshop.wav",
  station: null,
  town_outskirts: null,
};
const BED_VOLUME = "0.2";

interface CliOptions {
  templateId: string;
  noMusic: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let templateId = "shrine-afternoon-keeper";
  let noMusic = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = (): string => {
      const val = argv[++i];
      if (!val) throw new Error(`Missing value for ${arg}`);
      return val;
    };
    if (arg === "--template") templateId = take();
    else if (arg === "--no-music") noMusic = true;
    else if (arg === "--help" || arg === "-h") {
      stdout.write(
        [
          "Interactive scene player.",
          "",
          "  --template <id>   Scene template id (default: shrine-afternoon-keeper)",
          "  --no-music        Disable the ambient bed",
          "",
          "Available templates:",
          ...loadTemplates().map((t) => `  - ${t.id}  (${t.location})`),
          "",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { templateId, noMusic };
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
      /* swallow — scene continues silently */
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

// Example seed: small set of N3-friendly targets so the NPC actually
// pressures the player to produce specific grammar/vocab.
const SEED_ACTIVE: readonly ItemAssignment[] = [
  { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
];
const SEED_PASSIVE: readonly ItemAssignment[] = [
  { itemId: "vocab.mado", itemType: "vocab", mode: "passive" },
  { itemId: "vocab.yakusoku", itemType: "vocab", mode: "passive" },
];

function templateToPlan(template: SceneTemplate): ScenePlan {
  return {
    templateId: template.id,
    location: template.location,
    characters: template.characters as CharacterRef[],
    microStake: template.microStakeSkeleton,
    activeTargets: [...SEED_ACTIVE],
    passiveItems: [...SEED_PASSIVE],
    registerTag: template.registerTag,
    scriptedTurns: template.scriptedTurns,
  };
}

function voiceFor(speaker: string, characters: readonly CharacterRef[]): string {
  const ref = characters.find((c) => c.id === speaker);
  if (!ref?.voiceConfig) return FALLBACK_VOICE;
  return VOICE_MAP[ref.voiceConfig] ?? FALLBACK_VOICE;
}

function prefetchLine(
  apiKey: string,
  text: string,
  voice: string,
  scratchDir: string,
): Promise<string> {
  return synthesizeSpeech({ apiKey, text, voice }).then((wav) => {
    const path = join(scratchDir, `${randomUUID()}.wav`);
    writeFileSync(path, wav);
    return path;
  });
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required (set it in .env)");

  const opts = parseArgs(process.argv.slice(2));
  const templates = loadTemplates();
  const template = templates.find((t) => t.id === opts.templateId);
  if (!template) {
    const known = templates.map((t) => t.id).join(", ");
    throw new Error(
      `Unknown template "${opts.templateId}". Known: ${known}`,
    );
  }

  const plan = templateToPlan(template);
  const scratchDir = join(tmpdir(), "minshuku-scene");
  mkdirSync(scratchDir, { recursive: true });

  const bedRel = BED_MAP[template.location] ?? null;
  const bedPath = bedRel ? resolve(process.cwd(), bedRel) : null;
  const wantMusic = !opts.noMusic && bedPath && existsSync(bedPath);

  stdout.write(
    `\n=== ${template.id} · ${template.location} · ${template.registerTag} ===\n`,
  );
  for (const c of plan.characters) {
    const v = c.voiceConfig ? (VOICE_MAP[c.voiceConfig] ?? FALLBACK_VOICE) : FALLBACK_VOICE;
    stdout.write(`  cast: ${c.id} (${c.role}) → ${v}\n`);
  }
  stdout.write(`  bed: ${wantMusic ? bedRel : "none"}\n`);
  stdout.write(`\nGenerating dialogue...\n`);

  const llm = new GeminiClient(apiKey);
  const dialogue = await generateDialogue(plan, llm);

  const bed = wantMusic && bedPath ? loopBed(bedPath) : null;
  const cleanup = (): void => {
    if (bed) bed.stop();
  };
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  // Prefetch ONLY the opener's audio so the first NPC line plays instantly
  // while the player is still reading the briefing. Every subsequent NPC turn
  // is regenerated live in response to what the player actually said.
  const npcTurns = plan.scriptedTurns.filter(
    (t) => t.speaker !== "coach" && t.speaker !== "player",
  );
  const openerScripted = npcTurns[0];
  const openerCanned = openerScripted
    ? dialogue.turns.find((d) => d.turn === openerScripted.turn) ?? null
    : null;
  const openerAudio: Promise<string> | null =
    openerScripted && openerCanned
      ? prefetchLine(
          apiKey,
          openerCanned.text,
          voiceFor(openerScripted.speaker, plan.characters),
          scratchDir,
        )
      : null;
  if (openerAudio) openerAudio.catch(() => {});

  const transcript: ConversationLine[] = [];
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    stdout.write(`\n— Briefing —\n${dialogue.briefing}\n\n`);

    for (const t of plan.scriptedTurns) {
      if (t.speaker === "coach") continue;

      if (t.speaker === "player") {
        const reply = (await rl.question("» ")).trim();
        if (!reply) continue;
        transcript.push({ speaker: "player", text: reply });
        continue;
      }

      const voice = voiceFor(t.speaker, plan.characters);
      const isOpener = openerScripted?.turn === t.turn;

      let lineText: string;
      let wavPath: string | null = null;
      try {
        if (isOpener && openerCanned && openerAudio) {
          lineText = openerCanned.text;
          wavPath = await openerAudio;
        } else {
          const live = await generateNextNpcLine({
            plan,
            conversation: transcript,
            speaker: t.speaker,
            client: llm,
          });
          lineText = live.text;
          wavPath = await prefetchLine(apiKey, lineText, voice, scratchDir);
        }
      } catch (err) {
        stdout.write(
          `  ↳ generation error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        continue;
      }

      stdout.write(`\n${t.speaker} [${voice}]: ${lineText}\n`);
      transcript.push({ speaker: t.speaker, text: lineText });
      try {
        await playWav(wavPath);
      } catch (err) {
        stdout.write(
          `  ↳ tts error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }

    stdout.write(`\n— Result —\n${dialogue.result}\n\n`);
    stdout.write(`— Transcript —\n`);
    for (const line of transcript) {
      stdout.write(`  ${line.speaker}: ${line.text}\n`);
    }
    stdout.write("\n");
  } finally {
    rl.close();
    cleanup();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[scene:play] failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
