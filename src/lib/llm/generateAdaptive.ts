import { Type } from "@google/genai";
import { z } from "zod";
import { loadGrammar, loadVocab } from "../content.js";
import type { LLMClient } from "./client.js";
import type { DialogueLine, ScenePlan } from "../types.js";

const SingleTurnSchema = {
  type: Type.OBJECT,
  required: ["text"],
  properties: {
    text: { type: Type.STRING },
  },
};

const ResponseSchema = z.object({ text: z.string() });

// Be tolerant of:
//  - markdown fences around JSON
//  - literal control characters (newlines, tabs) inside the JSON string
//  - the model dropping JSON entirely and returning bare text
function extractText(raw: string): string {
  const fenced = raw.trim().replace(/^```(?:json)?\s*\n?|\n?```$/g, "").trim();

  const tryParse = (candidate: string): string | null => {
    try {
      const obj = JSON.parse(candidate);
      const validated = ResponseSchema.safeParse(obj);
      return validated.success ? validated.data.text : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(fenced);
  if (direct !== null) return direct;

  // Escape raw control chars inside JSON string literals, then retry.
  const escaped = fenced.replace(
    /"((?:\\.|[^"\\])*)"/g,
    (_match, body: string) =>
      `"${body
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")}"`,
  );
  const escapedParse = tryParse(escaped);
  if (escapedParse !== null) return escapedParse;

  // Regex-extract the value of "text" when it's well-terminated.
  const textField = fenced.match(/"text"\s*:\s*"([\s\S]*?)"\s*[,}]/);
  if (textField) return textField[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');

  // Truncation fallback: Gemini occasionally cuts off mid-string and returns
  // something like `{"text":"...どうぞ` with no closing quote or brace. Take
  // whatever follows `"text":"` and treat it as the line.
  const unterminated = fenced.match(/"text"\s*:\s*"([\s\S]+)$/);
  if (unterminated) {
    const trailing = unterminated[1]
      .replace(/[}"]+\s*$/, "")
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .trim();
    if (trailing) return trailing;
  }

  // Bare-text fallback: if the model returned plain Japanese, use it as-is.
  if (fenced && !fenced.includes("{")) return fenced;

  throw new Error(`LLM returned unparseable response: ${raw.slice(0, 200)}`);
}

function describeItem(
  it: ScenePlan["activeTargets"][number] | ScenePlan["passiveItems"][number],
): string {
  if (it.itemType === "grammar") {
    const found = loadGrammar().find((g) => g.id === it.itemId);
    if (!found) return it.itemId;
    return `${found.pattern} (${found.meaning})`;
  }
  const found = loadVocab().find((v) => v.id === it.itemId);
  if (!found) return it.itemId;
  return `${found.word} (${found.reading}, ${found.meaning})`;
}

function itemSurface(
  it: ScenePlan["activeTargets"][number] | ScenePlan["passiveItems"][number],
): string {
  if (it.itemType === "grammar") {
    return loadGrammar().find((g) => g.id === it.itemId)?.pattern ?? it.itemId;
  }
  return loadVocab().find((v) => v.id === it.itemId)?.word ?? it.itemId;
}

export interface ConversationLine {
  speaker: string;
  text: string;
}

export interface NextLineArgs {
  plan: ScenePlan;
  conversation: readonly ConversationLine[];
  speaker: string;
  client: LLMClient;
}

export async function generateNextNpcLine(args: NextLineArgs): Promise<DialogueLine> {
  const { plan, conversation, speaker, client } = args;
  const charList = plan.characters.map((c) => `${c.id} (${c.role})`).join(", ");
  const activeSurfaces = plan.activeTargets.map(itemSurface);
  const passiveSurfaces = plan.passiveItems.map(itemSurface);
  const active = plan.activeTargets.map(describeItem).join("\n  - ") || "(none)";
  const passive = plan.passiveItems.map(describeItem).join("\n  - ") || "(none)";

  const system = `You are the dialogue writer for Hanare, a hands-free Japanese learning app set in a soft-magical countryside town.
Produce ONE short Japanese line for the named character — a natural reply to what the player just said.

REGISTER & STYLE
- Match the register (${plan.registerTag}) and the speaker's persona for this location.
- One short utterance, conversational. No paragraphs.
- No markdown. Plain text.

ACTIVE TARGETS — FORBIDDEN in your line
The active targets are what the PLAYER must produce. You must NOT use them or paraphrase them. If the player has not yet produced one, your line should INVITE them to (ask a question whose natural Japanese answer requires the active target).

PASSIVE ITEMS — WEAVE IN NATURALLY
If a passive item hasn't appeared yet in the conversation, try to use it in your line.

OUTPUT
Strict JSON: {"text":"<your single Japanese line>"} — no prose outside the JSON.`;

  const transcript = conversation.length
    ? conversation.map((l) => `${l.speaker}: ${l.text}`).join("\n")
    : "(no turns yet — this is the opener)";

  const user = `Scene:
- Location: ${plan.location}
- Characters: ${charList}
- Micro-stake: ${plan.microStake}
- Register: ${plan.registerTag}

Active targets (player must produce; FORBIDDEN in your line):
  - ${active}
Active surfaces (do NOT use): ${activeSurfaces.length ? activeSurfaces.map((s) => `"${s}"`).join(", ") : "(none)"}

Passive items (weave in naturally):
  - ${passive}
Passive surfaces (use if not yet seen): ${passiveSurfaces.length ? passiveSurfaces.map((s) => `"${s}"`).join(", ") : "(none)"}

Conversation so far:
${transcript}

You are speaking as: ${speaker}
Reply with ONE short Japanese line in JSON: {"text":"..."}.`;

  const { text } = await client.complete({
    system,
    user,
    responseMimeType: "application/json",
    responseSchema: SingleTurnSchema,
    maxTokens: 1024,
  });

  const lineText = extractText(text);
  const cleaned = lineText
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

  return {
    turn: conversation.length + 1,
    speaker,
    text: cleaned,
    language: "ja",
  };
}
