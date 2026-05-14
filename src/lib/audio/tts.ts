import { GoogleGenAI } from "@google/genai";
import { GEMINI_TTS_PCM, pcmChunksToWav } from "./wav.js";

export const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
export const GEMINI_TTS_DEFAULT_VOICE = "Kore";

interface InlineDataPart {
  inlineData?: { data?: string; mimeType?: string };
}

interface GenerateContentResponseLike {
  candidates?: ReadonlyArray<{
    content?: { parts?: ReadonlyArray<InlineDataPart> };
  }>;
}

export interface SynthesizeOptions {
  apiKey: string;
  text: string;
  voice?: string;
  model?: string;
}

export async function synthesizeSpeech(opts: SynthesizeOptions): Promise<Buffer> {
  const { apiKey, text } = opts;
  const voice = opts.voice ?? GEMINI_TTS_DEFAULT_VOICE;
  const model = opts.model ?? GEMINI_TTS_MODEL;

  const ai = new GoogleGenAI({ apiKey });

  const response = (await (
    ai.models as unknown as {
      generateContent: (params: {
        model: string;
        contents: string;
        config: {
          responseModalities: string[];
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: string } };
          };
        };
      }) => Promise<GenerateContentResponseLike>;
    }
  ).generateContent({
    model,
    contents: text,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
      },
    },
  })) as GenerateContentResponseLike;

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    const data = part.inlineData?.data;
    if (!data) continue;
    chunks.push(new Uint8Array(Buffer.from(data, "base64")));
  }
  if (chunks.length === 0) {
    throw new Error("No audio returned from Gemini TTS");
  }
  return pcmChunksToWav(chunks, GEMINI_TTS_PCM);
}
