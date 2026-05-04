import { loadGrammar, loadVocab } from "../content";
import type { LLMClient } from "./client";
import type { DialogueLine, ScenePlan } from "../types";

export interface SyntheticPlayerArgs {
  plan: ScenePlan;
  conversationSoFar: DialogueLine[];
  turnNumber: number;
  persona: string;            // free-text persona, e.g., "intermediate-n3-foreign-student"
  client: LLMClient;
}

const PERSONA_DESCRIPTIONS: Record<string, string> = {
  "intermediate-n3-foreign-student":
    "An N3-level Japanese learner from abroad, ~6 months in Japan, comfortable with casual register but occasionally drops particles, prefers shorter sentences than native speakers, pronunciation passable.",
  "perfect-n3":
    "A clean N3-level learner who responds correctly and naturally to prompts at their level.",
};

function describeActiveTargets(plan: ScenePlan): string {
  return plan.activeTargets
    .map((t) => {
      if (t.itemType === "grammar") {
        const g = loadGrammar().find((x) => x.id === t.itemId);
        return g ? `${g.pattern} (${g.meaning})` : t.itemId;
      }
      const v = loadVocab().find((x) => x.id === t.itemId);
      return v ? `${v.word} (${v.meaning})` : t.itemId;
    })
    .join(", ");
}

export async function syntheticPlayerTurn(
  args: SyntheticPlayerArgs,
): Promise<DialogueLine> {
  const personaDesc =
    PERSONA_DESCRIPTIONS[args.persona] ??
    `A Japanese learner described as: "${args.persona}". Respond naturally for that level.`;

  const conv = args.conversationSoFar
    .map((line) => `[${line.speaker}] ${line.text}`)
    .join("\n");

  const activeDesc = describeActiveTargets(args.plan);

  const system = `You are role-playing as a Japanese-language learner in a hands-free practice scene.

Persona: ${personaDesc}

Constraints:
- Reply in Japanese only (one short utterance, 1-2 sentences max).
- Try to use the active target naturally if it fits: ${activeDesc}.
- Do not break character; do not explain in English.
- Output the Japanese text only, no quotes, no prefixes.`;

  const user = `Persona: ${args.persona}
Scene location: ${args.plan.location}
Micro-stake: ${args.plan.microStake}
Conversation so far:
${conv}

It is now turn ${args.turnNumber} (your turn). Respond as the learner.`;

  const { text } = await args.client.complete({ system, user });

  return {
    turn: args.turnNumber,
    speaker: "player",
    text: text.trim(),
    language: "ja",
  };
}
