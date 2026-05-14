// Generate a music file from Google Lyria (models/lyria-realtime-exp) via the
// Gemini API, using mood presets keyed off scene-template location.
//
// Usage:
//   npm run music -- --template bookshop-quiet-browse
//   npm run music -- --location shrine --seconds 90
//   npm run music -- --prompt "downtempo, warm rhodes, vinyl crackle"
//   npm run music -- --location cafe --out public/audio/cafe.m4a
//
// Default output: 48kHz stereo AAC m4a @ 128kbps (encoded from Lyria's PCM via
// ffmpeg). Pass --out path/to/file.wav to skip encoding and keep raw PCM.

import { writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

import { LYRIA_PCM, pcmChunksToWav } from "../src/lib/audio/wav.js";
import {
  type MoodPreset,
  type WeightedPrompt,
  listPresetLocations,
  presetForLocation,
} from "../src/lib/audio/lyriaPrompts.js";
import { loadTemplates } from "../src/lib/content.js";

const MODEL = "models/lyria-realtime-exp";
const DEFAULT_SECONDS = 120;
const BYTES_PER_SECOND =
  (LYRIA_PCM.sampleRate * LYRIA_PCM.channels * LYRIA_PCM.bitsPerSample) / 8;

interface CliOptions {
  templateId: string | null;
  location: string | null;
  prompt: string | null;
  seconds: number;
  out: string | null;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = {
    templateId: null,
    location: null,
    prompt: null,
    seconds: DEFAULT_SECONDS,
    out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = (): string => {
      const val = argv[++i];
      if (!val) throw new Error(`Missing value for ${arg}`);
      return val;
    };
    if (arg === "--template") opts.templateId = take();
    else if (arg === "--location") opts.location = take();
    else if (arg === "--prompt") opts.prompt = take();
    else if (arg === "--seconds") opts.seconds = Number(take());
    else if (arg === "--out") opts.out = take();
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(opts.seconds) || opts.seconds <= 0) {
    throw new Error(`--seconds must be a positive number, got ${opts.seconds}`);
  }
  return opts;
}

function printHelp(): void {
  const locations = listPresetLocations().join(", ");
  // eslint-disable-next-line no-console
  console.log(
    [
      "Generate a WAV from Lyria (Gemini API).",
      "",
      "  --template <id>     Use the location of the named SceneTemplate",
      "  --location <name>   Use a built-in mood preset directly",
      "                      (one of: " + locations + ")",
      "  --prompt <text>     Free-form prompt; bypasses presets",
      "  --seconds <n>       Duration in seconds (default 120)",
      "  --out <path>        Output path (default public/audio/<id>.m4a;",
      "                      .wav skips ffmpeg encoding and keeps raw PCM)",
    ].join("\n"),
  );
}

interface ResolvedSource {
  label: string;
  preset: MoodPreset;
  defaultStem: string;
}

function resolveSource(opts: CliOptions): ResolvedSource {
  if (opts.prompt) {
    return {
      label: `prompt: ${opts.prompt}`,
      preset: { prompts: [{ text: opts.prompt, weight: 1.0 }] },
      defaultStem: "custom",
    };
  }
  if (opts.templateId) {
    const templates = loadTemplates();
    const template = templates.find((t) => t.id === opts.templateId);
    if (!template) {
      const known = templates.map((t) => t.id).join(", ");
      throw new Error(
        `Unknown template "${opts.templateId}". Known: ${known}`,
      );
    }
    return {
      label: `template ${template.id} (location=${template.location})`,
      preset: presetForLocation(template.location),
      defaultStem: template.id,
    };
  }
  if (opts.location) {
    return {
      label: `location ${opts.location}`,
      preset: presetForLocation(opts.location),
      defaultStem: opts.location,
    };
  }
  throw new Error(
    "Must pass one of --template, --location, or --prompt. Use --help for details.",
  );
}

interface AudioChunkLike {
  data?: string;
  mimeType?: string;
}

interface ServerContentLike {
  audioChunks?: readonly AudioChunkLike[];
}

interface ServerMessageLike {
  serverContent?: ServerContentLike;
  filteredPrompt?: { text?: string; filteredReason?: string };
  setupComplete?: unknown;
}

async function generate(
  apiKey: string,
  prompts: readonly WeightedPrompt[],
  config: MoodPreset["config"],
  targetSeconds: number,
): Promise<Buffer> {
  // Lyria requires the v1alpha API surface.
  const ai = new GoogleGenAI({ apiKey, apiVersion: "v1alpha" });

  const targetBytes = BYTES_PER_SECOND * targetSeconds;
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  let firstChunkAt: number | null = null;
  let resolveDone!: () => void;
  let rejectDone!: (err: unknown) => void;
  const done = new Promise<void>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });

  // The SDK exposes Lyria via `ai.live.music`. Some published @google/genai
  // versions ship the type for `live` without surfacing `music` publicly,
  // so we hop through `unknown` rather than `any`.
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

  const session = await live.music.connect({
    model: MODEL,
    callbacks: {
      onmessage: (msg) => {
        if (msg.filteredPrompt?.text) {
          process.stderr.write(
            `[lyria] filtered prompt "${msg.filteredPrompt.text}": ${msg.filteredPrompt.filteredReason ?? "unknown"}\n`,
          );
        }
        const audioChunks = msg.serverContent?.audioChunks;
        if (!audioChunks?.length) return;
        for (const chunk of audioChunks) {
          if (!chunk.data) continue;
          const bytes = new Uint8Array(Buffer.from(chunk.data, "base64"));
          chunks.push(bytes);
          receivedBytes += bytes.byteLength;
        }
        if (firstChunkAt === null) {
          firstChunkAt = Date.now();
          process.stderr.write("[lyria] first audio chunk received\n");
        }
        if (receivedBytes >= targetBytes) {
          resolveDone();
        } else {
          const secs = (receivedBytes / BYTES_PER_SECOND).toFixed(1);
          process.stderr.write(`\r[lyria] buffered ${secs}s / ${targetSeconds}s`);
        }
      },
      onerror: (e) => rejectDone(e),
      onclose: () => {
        if (receivedBytes < targetBytes) {
          rejectDone(
            new Error(
              `Connection closed before reaching ${targetSeconds}s (got ${(receivedBytes / BYTES_PER_SECOND).toFixed(1)}s)`,
            ),
          );
        }
      },
    },
  });

  await session.setWeightedPrompts({ weightedPrompts: [...prompts] });
  if (config) {
    await session.setMusicGenerationConfig({ musicGenerationConfig: { ...config } });
  }
  session.play();

  // Safety: cap wallclock at 2x target seconds. Lyria streams ~1:1 with
  // playback, so 120s of audio costs ~120s wallclock.
  const safetyMs = targetSeconds * 2 * 1000 + 15_000;
  const safety = setTimeout(() => {
    rejectDone(
      new Error(
        `Timed out after ${safetyMs}ms; got ${(receivedBytes / BYTES_PER_SECOND).toFixed(1)}s of audio`,
      ),
    );
  }, safetyMs);

  try {
    await done;
  } finally {
    clearTimeout(safety);
    try {
      session.stop();
    } catch {
      /* already closed */
    }
    try {
      session.close();
    } catch {
      /* already closed */
    }
    process.stderr.write("\n");
  }

  return pcmChunksToWav(chunks);
}

interface LiveMusicLike {
  setWeightedPrompts(params: {
    weightedPrompts: WeightedPrompt[];
  }): Promise<void>;
  setMusicGenerationConfig(params: {
    musicGenerationConfig: NonNullable<MoodPreset["config"]>;
  }): Promise<void>;
  play(): void;
  stop(): void;
  close(): void;
}

function encodeWavToM4a(wavPath: string, m4aPath: string): void {
  const result = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", wavPath, "-c:a", "aac", "-b:a", "128k", m4aPath],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "ffmpeg not found on PATH. Install it (e.g. `brew install ffmpeg`) or pass --out path/to/file.wav to skip encoding.",
      );
    }
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`ffmpeg exited with status ${result.status}`);
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required (set it in .env)");
  }
  const opts = parseArgs(process.argv.slice(2));
  const source = resolveSource(opts);
  const outPath =
    opts.out ?? join(process.cwd(), "public", "audio", `${source.defaultStem}.m4a`);
  const keepRawWav = extname(outPath).toLowerCase() === ".wav";

  process.stderr.write(`[music] source: ${source.label}\n`);
  process.stderr.write(
    `[music] prompts: ${source.preset.prompts.map((p) => `${p.text}(${p.weight})`).join(", ")}\n`,
  );
  process.stderr.write(`[music] target: ${opts.seconds}s → ${outPath}\n`);

  const wav = await generate(
    apiKey,
    source.preset.prompts,
    source.preset.config,
    opts.seconds,
  );

  mkdirSync(dirname(outPath), { recursive: true });

  if (keepRawWav) {
    writeFileSync(outPath, wav);
    process.stderr.write(`[music] wrote ${(wav.byteLength / 1024 / 1024).toFixed(2)} MiB → ${outPath}\n`);
    return;
  }

  const tmpWav = join(tmpdir(), `lyria-${Date.now()}-${process.pid}.wav`);
  writeFileSync(tmpWav, wav);
  try {
    encodeWavToM4a(tmpWav, outPath);
  } finally {
    try {
      unlinkSync(tmpWav);
    } catch {
      /* already gone */
    }
  }
  const { statSync } = await import("node:fs");
  const m4aSize = statSync(outPath).size;
  process.stderr.write(
    `[music] wrote ${(m4aSize / 1024 / 1024).toFixed(2)} MiB → ${outPath} (encoded from ${(wav.byteLength / 1024 / 1024).toFixed(2)} MiB PCM)\n`,
  );
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[music] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
