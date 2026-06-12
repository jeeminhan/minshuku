import { GeminiClient } from "@engine/llm/client";
import type { LLMClient } from "@engine/llm/client";
import day1Fixture from "@web/fixtures/episode-demo-learner.json";
import day2Fixture from "@web/fixtures/episode-demo-learner-day2.json";
import day3Fixture from "@web/fixtures/episode-demo-learner-day3.json";
import day4Fixture from "@web/fixtures/episode-demo-learner-day4.json";

export interface FixtureResponse {
  label: string;
  text: string;
}

interface EpisodeFixture {
  description: string;
  responses: FixtureResponse[];
}

// One committed fixture per story day — each is a distinct recorded episode.
// A day with no entry here must fail loud (see createLLMClient), never
// silently replay another day's fixture.
const FIXTURES_BY_DAY: Record<number, { name: string; fixture: EpisodeFixture }> = {
  1: { name: "episode-demo-learner.json", fixture: day1Fixture },
  2: { name: "episode-demo-learner-day2.json", fixture: day2Fixture },
  3: { name: "episode-demo-learner-day3.json", fixture: day3Fixture },
  4: { name: "episode-demo-learner-day4.json", fixture: day4Fixture },
};

// Replays recorded `complete()` responses as an ordered sequence: the Nth
// complete() call gets the Nth recorded response. A fresh client is created
// per request (see createLLMClient), and runScene's call order is fixed for
// a fixed scene plan (1 dialogue-generation call, then one synthetic-player
// call per player turn), so replay is deterministic.
export class FixtureLLMClient implements LLMClient {
  private cursor = 0;

  constructor(
    private readonly responses: readonly FixtureResponse[],
    private readonly fixtureName: string,
  ) {}

  // Sequence-keyed replay ignores the prompt args entirely.
  async complete(): Promise<{ text: string; latencyMs: number }> {
    const next = this.responses[this.cursor];
    if (!next) {
      throw new Error(
        `Fixture exhausted: complete() call #${this.cursor + 1} has no recorded ` +
          `response (fixture holds ${this.responses.length}). The scene plan no ` +
          `longer matches web/fixtures/${this.fixtureName} — re-record it.`,
      );
    }
    this.cursor += 1;
    return { text: next.text, latencyMs: 0 };
  }
}

// Client selection — the only place MINSHUKU_FAKE_LLM is read.
// MINSHUKU_FAKE_LLM=1 → deterministic fixture replay for the given story
// day, no API key needed; a day without a committed fixture is a loud error.
// Otherwise → live Gemini (day-agnostic); the key stays server-side (read by
// GeminiClient from process.env, never exposed through a client-visible env var).
export function createLLMClient(day: number): LLMClient {
  if (process.env.MINSHUKU_FAKE_LLM === "1") {
    const entry = FIXTURES_BY_DAY[day];
    if (!entry) {
      const recorded = Object.keys(FIXTURES_BY_DAY).join(", ");
      throw new Error(
        `No committed fixture for story day ${day} (web/fixtures/ holds days ${recorded}). ` +
          `Refusing to replay another day's episode — record a day-${day} fixture, or ` +
          `delete web/.data/story-state.json to reset the story to day 1.`,
      );
    }
    return new FixtureLLMClient(entry.fixture.responses, entry.name);
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "Live LLM mode requires GEMINI_API_KEY (set it server-side, e.g. in web/.env.local), " +
        "or set MINSHUKU_FAKE_LLM=1 to replay committed fixtures without an API key.",
    );
  }
  return new GeminiClient();
}
