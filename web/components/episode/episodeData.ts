import { z } from "zod";

// Client-side shape of GET /api/episode — validated at the fetch boundary
// (never trust external data, even our own API). Mirrors the parts of
// EpisodeResult (web/lib/engine/runEpisode.ts) the UI consumes; zod strips
// the rest (llmPrompt, scoring rationale, story.summary, …).

export const OUTCOMES = [
  "missed",
  "recognized",
  "produced_with_help",
  "produced",
  "mastered",
] as const;

export type Outcome = (typeof OUTCOMES)[number];

const evaluatorResultSchema = z.object({
  itemId: z.string(),
  mode: z.enum(["active", "passive"]),
  outcome: z.enum(OUTCOMES),
});

export type TurnEvaluatorResult = z.infer<typeof evaluatorResultSchema>;

const dialogueTurnSchema = z.object({
  turn: z.number().int(),
  speaker: z.string(),
  text: z.string(),
  evaluatorResults: z.array(evaluatorResultSchema).optional(),
});

export type DialogueTurn = z.infer<typeof dialogueTurnSchema>;

const episodeItemSchema = z.object({
  itemId: z.string(),
  itemType: z.enum(["vocab", "grammar"]),
  mode: z.enum(["active", "passive"]),
  surface: z.string(),
  reading: z.string().nullable(),
  meaning: z.string(),
});

export type EpisodeItem = z.infer<typeof episodeItemSchema>;

export const episodeResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("completed"),
    log: z.object({
      briefing: z.string(),
      result: z.string(),
      turns: z.array(dialogueTurnSchema),
    }),
    story: z.object({ day: z.number().int() }),
    items: z.array(episodeItemSchema),
  }),
  z.object({
    status: z.literal("skipped"),
    message: z.string(),
  }),
]);

export type EpisodeResponse = z.infer<typeof episodeResponseSchema>;
export type CompletedEpisode = Extract<EpisodeResponse, { status: "completed" }>;

export const completeResponseSchema = z.object({ day: z.number().int() });
