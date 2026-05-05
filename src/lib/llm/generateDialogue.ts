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

// Surface form the AI must avoid (active) or use (passive) in its lines.
function itemSurface(it: ScenePlan["activeTargets"][number] | ScenePlan["passiveItems"][number]): string {
  if (it.itemType === "grammar") {
    const found = loadGrammar().find((g) => g.id === it.itemId);
    return found?.pattern ?? it.itemId;
  }
  const found = loadVocab().find((v) => v.id === it.itemId);
  return found?.word ?? it.itemId;
}

function buildPrompt(plan: ScenePlan): { system: string; user: string } {
  const charList = plan.characters.map((c) => `${c.id} (${c.role})`).join(", ");
  const active = plan.activeTargets.map(describeItem).join("\n  - ");
  const passive = plan.passiveItems.map(describeItem).join("\n  - ");
  const activeSurfaces = plan.activeTargets.map(itemSurface);
  const passiveSurfaces = plan.passiveItems.map(itemSurface);
  const forbiddenList = activeSurfaces.length
    ? activeSurfaces.map((s) => `  - "${s}"`).join("\n")
    : "  (none)";
  const requiredList = passiveSurfaces.length
    ? passiveSurfaces.map((s) => `  - "${s}"`).join("\n")
    : "  (none)";

  // Only the AI-character turns are filled by the LLM. Player turns are placeholders
  // that the synthetic player will fill in Task 17.
  const aiTurns = plan.scriptedTurns
    .filter((t) => t.speaker !== "player" && t.speaker !== "coach")
    .map((t) => `  - turn ${t.turn} (${t.speaker})`)
    .join("\n");

  const system = `You are the dialogue writer for Hanare, a hands-free Japanese learning app set in a soft-magical countryside town.
Your job: given a structured scene plan, produce the briefing (English), the AI character lines (Japanese), and the result line (English).

REGISTER & STYLE
- Briefing and result are in English. AI character lines are in Japanese.
- AI lines must match the register (${plan.registerTag}) and feel natural for the speaker IN THE CONTEXT described by the micro-stake. A countryside-village clerk is plain polite ですます, NOT department-store keigo (no かしこまりました/でございます stack). A grandfather is slow, weighted ですます with occasional older expressions. Match the persona, not a generic register label.
- Each AI turn is one short utterance, conversational — not a paragraph.
- NO markdown formatting in dialogue text. No **bold**, no *italic*, no backticks. Plain text only.

ACTIVE TARGETS — FORBIDDEN in AI lines
The active targets are what the PLAYER must produce. The AI must NOT use any of the active target forms in its own lines (no paraphrasing either). If you find yourself reaching for one, rephrase using a different construction.

ACTIVE TARGETS — INVITATION REQUIRED
At least one AI turn must ask a question whose natural answer in Japanese requires the player to produce the active target. For example, if the active is ～間 (during), ask a question about timing or what happens during a period. If the active is a vocab word like 合図 (signal), ask a question whose natural answer references that signal. Do NOT just bring up the topic and hope the player guesses; explicitly invite the form.

PASSIVE ITEMS — REQUIRED in AI lines
Every passive item must appear at least once across the AI's lines, woven in naturally. Spread them across multiple turns. If a passive item doesn't fit naturally, adjust your turn to make it fit — do not omit it.

OUTPUT
Strict JSON only, no prose outside the JSON.`;

  const user = `Scene plan:
- Location: ${plan.location}
- Characters: ${charList}
- Micro-stake: ${plan.microStake}
- Register: ${plan.registerTag}

Active target (player must produce): ${active || "none"}
Active surfaces FORBIDDEN in AI lines:
${forbiddenList}

Passive items (AI uses naturally): ${passive || "none"}
Passive surfaces REQUIRED in AI lines (each must appear at least once):
${requiredList}

AI character turns to fill:
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
    maxTokens: 4096,
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
  // Strip markdown emphasis from dialogue text. LLMs sometimes bold passive
  // items, which leaks them as flashcard targets and breaks immersion.
  const cleanedTurns = validated.turns.map((t) => ({
    ...t,
    text: t.text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1"),
  }));
  return {
    briefing: validated.briefing,
    turns: cleanedTurns as DialogueLine[],
    result: validated.result,
    rawPrompt: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
    rawResponse: text,
    latencyMs,
  };
}
