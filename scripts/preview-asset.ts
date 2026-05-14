// Quick preview generator for visual/video asset prompts.
//
// Usage:
//   npm run preview-asset -- --type sprite --character grandpa --style ghibli
//   npm run preview-asset -- --type sprite --character "cafe regular" --style "pixel art"
//   npm run preview-asset -- --type video --scene "minshuku tea room at dusk"
//
// Outputs to assets/preview/<slug>-<timestamp>.{png,mp4}

import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PREVIEW_DIR = join(process.cwd(), "assets", "preview");

interface CliOptions {
  type: "sprite" | "video";
  character?: string;
  scene?: string;
  style: string;
  outPath?: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let type: CliOptions["type"] | undefined;
  let character: string | undefined;
  let scene: string | undefined;
  let style = "studio ghibli";
  let outPath: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--type") {
      const v = argv[++i];
      if (v !== "sprite" && v !== "video") {
        throw new Error(`--type must be "sprite" or "video" (got "${v}")`);
      }
      type = v;
    } else if (a === "--character") {
      character = argv[++i];
    } else if (a === "--scene") {
      scene = argv[++i];
    } else if (a === "--style") {
      style = argv[++i];
    } else if (a === "--out") {
      outPath = argv[++i];
    }
  }
  if (!type) throw new Error("--type is required (sprite or video)");
  if (type === "sprite" && !character) throw new Error("--character is required for --type sprite");
  if (type === "video" && !scene) throw new Error("--scene is required for --type video");
  return { type, character, scene, style, outPath };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function spritePrompt(character: string, style: string): string {
  return `4-frame walking animation sprite sheet of ${character}, side profile view, full body, arranged horizontally as 4 equal panels of identical size.

Frame 1: idle, both feet planted, arms relaxed.
Frame 2: right foot forward mid-step, left arm swinging back, right arm swinging forward.
Frame 3: idle, both feet planted (slight bob different from frame 1).
Frame 4: left foot forward mid-step, right arm swinging back, left arm swinging forward.

Style: ${style}. Transparent background. Consistent character design and proportions across all 4 frames. Even lighting from above. No outlines around the panels. The character should fill each panel vertically with small headroom.`;
}

function videoPrompt(scene: string, style: string): string {
  return `${scene}. Style: ${style}. Warm color palette, gentle camera push-in, soft natural lighting. Cinematic, atmospheric, calm pacing.`;
}

async function generateSprite(
  ai: GoogleGenAI,
  prompt: string,
  outPath: string,
): Promise<void> {
  console.log(`[preview] generating sprite via gemini-3.1-flash-image-preview…`);
  const start = Date.now();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: prompt,
    config: { responseModalities: ["IMAGE"] },
  });
  const latency = Date.now() - start;
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error(
      `No image returned. Response parts:\n${JSON.stringify(parts, null, 2).slice(0, 600)}`,
    );
  }
  const buf = Buffer.from(imagePart.inlineData.data, "base64");
  writeFileSync(outPath, buf);
  console.log(`[preview] wrote ${outPath} (${(buf.length / 1024).toFixed(1)} KB, ${latency}ms)`);
}

async function generateVideo(
  ai: GoogleGenAI,
  prompt: string,
  outPath: string,
): Promise<void> {
  console.log(`[preview] submitting video job via veo-3.1-lite-generate-preview…`);
  const start = Date.now();
  let op = await ai.models.generateVideos({
    model: "veo-3.1-lite-generate-preview",
    prompt,
    config: {
      aspectRatio: "16:9",
      numberOfVideos: 1,
    },
  });
  console.log(`[preview] job submitted, polling…`);
  while (!op.done) {
    await new Promise((r) => setTimeout(r, 5000));
    op = await ai.operations.getVideosOperation({ operation: op });
    process.stdout.write(".");
  }
  process.stdout.write("\n");
  const generated = op.response?.generatedVideos?.[0];
  if (!generated?.video?.uri) {
    throw new Error(`No video URI in response: ${JSON.stringify(op.response).slice(0, 400)}`);
  }
  const url = `${generated.video.uri}&key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Video download failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  const latency = Date.now() - start;
  console.log(
    `[preview] wrote ${outPath} (${(buf.length / 1024 / 1024).toFixed(2)} MB, ${(latency / 1000).toFixed(1)}s)`,
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required (set in .env)");
  }
  if (!existsSync(PREVIEW_DIR)) mkdirSync(PREVIEW_DIR, { recursive: true });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const ts = Date.now();

  if (opts.type === "sprite") {
    const prompt = spritePrompt(opts.character!, opts.style);
    const out = opts.outPath ?? join(PREVIEW_DIR, `sprite-${slug(opts.character!)}-${ts}.png`);
    console.log(`[preview] prompt:\n${prompt}\n`);
    await generateSprite(ai, prompt, out);
  } else {
    const prompt = videoPrompt(opts.scene!, opts.style);
    const out = opts.outPath ?? join(PREVIEW_DIR, `video-${slug(opts.scene!)}-${ts}.mp4`);
    console.log(`[preview] prompt:\n${prompt}\n`);
    await generateVideo(ai, prompt, out);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
