import { GeminiClient } from "@engine/llm/client";
import type { LLMClient } from "@engine/llm/client";
import episodeFixture from "@web/fixtures/episode-demo-learner.json";

export interface FixtureResponse {
  label: string;
  text: string;
}

// Replays recorded `complete()` responses as an ordered sequence: the Nth
// complete() call gets the Nth recorded response. A fresh client is created
// per request (see createLLMClient), and runScene's call order is fixed for
// a fixed scene plan (1 dialogue-generation call, then one synthetic-player
// call per player turn), so replay is deterministic.
export class FixtureLLMClient implements LLMClient {
  private cursor = 0;

  constructor(private readonly responses: readonly FixtureResponse[]) {}

  // Sequence-keyed replay ignores the prompt args entirely.
  async complete(): Promise<{ text: string; latencyMs: number }> {
    const next = this.responses[this.cursor];
    if (!next) {
      throw new Error(
        `Fixture exhausted: complete() call #${this.cursor + 1} has no recorded ` +
          `response (fixture holds ${this.responses.length}). The scene plan no ` +
          `longer matches web/fixtures/episode-demo-learner.json — re-record it.`,
      );
    }
    this.cursor += 1;
    return { text: next.text, latencyMs: 0 };
  }
}

// Client selection — the only place MINSHUKU_FAKE_LLM is read.
// MINSHUKU_FAKE_LLM=1 → deterministic fixture replay, no API key needed.
// Otherwise → live Gemini; the key stays server-side (read by GeminiClient
// from process.env, never exposed through a client-visible env var).
export function createLLMClient(): LLMClient {
  if (process.env.MINSHUKU_FAKE_LLM === "1") {
    return new FixtureLLMClient(episodeFixture.responses);
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "Live LLM mode requires GEMINI_API_KEY (set it server-side, e.g. in web/.env.local), " +
        "or set MINSHUKU_FAKE_LLM=1 to replay committed fixtures without an API key.",
    );
  }
  return new GeminiClient();
}
