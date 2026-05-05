import { Type } from "@google/genai";
import { z } from "zod";
import { loadGrammar, loadVocab } from "../content";
import type { LLMClient } from "./client";
import type { ScenePlan, DialogueLine } from "../types";

const DialogueResponseSchema = {
  type: Type.OBJECT,
  required: ["briefing", "turns", "result"],
  propertyOrdering: ["briefing", "turns", "result"],
  properties: {
    briefing: { type: Type.STRING },
    turns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["turn", "speaker", "text", "language"],
        propertyOrdering: ["turn", "speaker", "text", "language"],
        properties: {
          turn: { type: Type.INTEGER },
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
          language: { type: Type.STRING, enum: ["ja"] },
        },
      },
    },
    result: { type: Type.STRING },
  },
};

const ResponseSchema = z.object({
  briefing: z.string(),
  turns: z.array(
    z.object({
      turn: z.number(),
      speaker: z.string(),
      text: z.string(),
      language: z.enum(["ja", "en"]),
    }),
  ),
  result: z.string(),
});

export interface GeneratedDialogue {
  briefing: string;
  turns: DialogueLine[];
  result: string;
  rawPrompt: string;
  rawResponse: string;
  latencyMs: number;
}

function describeItem(it: ScenePlan["activeTargets"][number] | ScenePlan["passiveItems"][number]): string {
  if (it.itemType === "grammar") {
    const found = loadGrammar().find((g) => g.id === it.itemId);
    if (!found) return it.itemId;
    return `${found.pattern} (${found.meaning}) — formation: ${found.formation}`;
  }
  const found = loadVocab().find((v) => v.id === it.itemId);
  if (!found) return it.itemId;
  return `${found.word} (${found.reading}, ${found.meaning})`;
}

function buildPrompt(plan: ScenePlan): { system: string; user: string } {
  const charList = plan.characters.map((c) => `${c.id} (${c.role})`).join(", ");
  const active = plan.activeTargets.map(describeItem).join("\n  - ");
  const passive = plan.passiveItems.map(describeItem).join("\n  - ");

  // Only the AI-character turns are filled by the LLM. Player turns are placeholders
  // that the synthetic player will fill in Task 17.
  const aiTurns = plan.scriptedTurns
    .filter((t) => t.speaker !== "player" && t.speaker !== "coach")
    .map((t) => `  - turn ${t.turn} (${t.speaker})`)
    .join("\n");

  const system = `You are the dialogue writer for Hanare, a hands-free Japanese learning app set in a soft-magical countryside town.
Your job: given a structured scene plan, produce the briefing (English), the AI character lines (Japanese), and the result line (English).

Rules:
- Briefing and result are in English. AI character lines are in Japanese.
- AI character lines must be appropriate for the register (${plan.registerTag}) and natural for the speaker.
- The AI must use the passive items NATURALLY in its own speech (don't force them).
- The AI must NOT use the active target — that's the player's job. The AI should set up situations where the active target is the natural response.
- Each AI turn is one short utterance.
- Output strict JSON only, no prose outside the JSON.`;

  const user = `Scene plan:
- Location: ${plan.location}
- Characters: ${charList}
- Micro-stake: ${plan.microStake}
- Register: ${plan.registerTag}
- Active target (player must produce): ${active || "none"}
- Passive items (AI uses naturally): ${passive || "none"}
- AI character turns to fill:
${aiTurns}

Output JSON shape:
{
  "briefing": "<English briefing, ~1-2 sentences naming location, character, today's stake, and the active target>",
  "turns": [
    { "turn": <number>, "speaker": "<character_id>", "text": "<Japanese line>", "language": "ja" }
  ],
  "result": "<English result line, ~1 sentence summarizing what happened (placeholder — will be replaced by evaluator-driven summary later)>"
}`;

  return { system, user };
}

export async function generateDialogue(
  plan: ScenePlan,
  client: LLMClient,
): Promise<GeneratedDialogue> {
  const { system, user } = buildPrompt(plan);
  const { text, latencyMs } = await client.complete({
    system,
    user,
    responseMimeType: "application/json",
    responseSchema: DialogueResponseSchema,
  });

  // Strip markdown fences if Gemini wrapped the JSON.
  // Matches: ```json\n{...}\n```, ```\n{...}\n```, or no fences at all.
  function stripJsonFences(s: string): string {
    const trimmed = s.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
    return fenceMatch ? fenceMatch[1].trim() : trimmed;
  }

  let parsed;
  const stripped = stripJsonFences(text);
  try {
    parsed = JSON.parse(stripped);
  } catch (e) {
    throw new Error(`LLM returned non-JSON response: ${text.slice(0, 200)}`);
  }

  const validated = ResponseSchema.parse(parsed);
  return {
    briefing: validated.briefing,
    turns: validated.turns as DialogueLine[],
    result: validated.result,
    rawPrompt: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
    rawResponse: text,
    latencyMs,
  };
}
