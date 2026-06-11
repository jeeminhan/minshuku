import type { LLMClient, LLMCompleteArgs } from "@engine/llm/client";

// LLM-client wrapper that injects the story-so-far into the dialogue prompt.
// The engine builds its prompts purely from the ScenePlan, so the only
// engine-untouched injection point is here: runScene's complete() call order
// is fixed (the FIRST call is always generateDialogue's; the synthetic-player
// calls follow), so the wrapper appends the story block to call #1 only and
// delegates everything else unchanged to the inner client (fixture or Gemini).
//
// promptContext is captured INSIDE complete(), from the args actually passed
// to the inner client — it is the exact suffix appended to the outgoing user
// prompt, sliced back out of the delegated args, never assembled separately.
// (log.llmPrompt is recorded upstream of this wrapper, so the injected block
// is intentionally NOT visible there; story.promptContext is its home.)
export class StoryContextLLMClient implements LLMClient {
  private callCount = 0;
  private capturedPromptContext = "";

  constructor(
    private readonly inner: LLMClient,
    private readonly day: number,
    private readonly storySoFar: string, // persisted summary; "" on day 1
  ) {}

  // The exact story-so-far text block injected into the dialogue-generation
  // prompt this run; "" when nothing was injected (day 1, or no call yet).
  get promptContext(): string {
    return this.capturedPromptContext;
  }

  async complete(args: LLMCompleteArgs): Promise<{ text: string; latencyMs: number }> {
    this.callCount += 1;
    if (this.callCount !== 1 || this.storySoFar === "") {
      return this.inner.complete(args);
    }
    const block =
      `Story so far (today is day ${this.day} of the player's stay — keep light ` +
      `continuity with these past events; the dialogue may reference them naturally):\n` +
      this.storySoFar;
    const injectedArgs: LLMCompleteArgs = { ...args, user: `${args.user}\n\n${block}` };
    // Captured from the actual call arguments: the appended block is exactly
    // what extends injectedArgs.user beyond the original prompt + separator.
    this.capturedPromptContext = injectedArgs.user.slice(args.user.length + "\n\n".length);
    return this.inner.complete(injectedArgs);
  }
}
