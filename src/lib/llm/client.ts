import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

export interface LLMClient {
  complete(args: {
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
  }): Promise<{ text: string; latencyMs: number }>;
}

export class GeminiClient implements LLMClient {
  private client: GoogleGenAI;
  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is required (set it in .env or pass to constructor)");
    }
    this.client = new GoogleGenAI({ apiKey: key });
  }

  async complete(args: {
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
  }): Promise<{ text: string; latencyMs: number }> {
    const start = Date.now();
    const response = await this.client.models.generateContent({
      model: args.model ?? "gemini-2.5-flash",
      contents: args.user,
      config: {
        systemInstruction: args.system,
        maxOutputTokens: args.maxTokens ?? 2048,
      },
    });
    const latencyMs = Date.now() - start;

    const text = response.text;
    if (!text) {
      throw new Error("LLM returned no text content");
    }

    return { text, latencyMs };
  }
}

// Mock client for tests — drop-in replacement.
export class MockLLMClient implements LLMClient {
  constructor(private responder: (args: { system: string; user: string }) => string) {}
  async complete(args: { system: string; user: string }) {
    return { text: this.responder(args), latencyMs: 0 };
  }
}
