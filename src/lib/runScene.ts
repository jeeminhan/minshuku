import { randomUUID } from "node:crypto";
import { buildScenePlan } from "./generator/buildScenePlan";
import { generateDialogue } from "./llm/generateDialogue";
import { syntheticPlayerTurn } from "./llm/syntheticPlayer";
import { evaluatePlayerTurn } from "./evaluator/evaluate";
import { writeSceneRunLog } from "./log/sceneRunLog";
import type { LLMClient } from "./llm/client";
import type {
  ReviewItem,
  SceneRunLog,
  DialogueLine,
  EvaluatorResult,
} from "./types";

export interface RunSceneArgs {
  reviewItems: ReviewItem[];
  now: Date;
  recentContext: { lastTemplateId: string | null; lastLocation: string | null };
  llmClient: LLMClient;
  logDir?: string;
  persona: string;
  userId?: string;
}

// Aggregate per-turn results into one outcome per active target.
// Order of preference: produced > recognized > produced_with_help > missed.
// (v0 only emits "produced" or "missed", but the comparator handles future v1 outcomes.)
function aggregateOutcomes(
  perTurnResults: EvaluatorResult[][],
  activeTargets: { itemId: string; itemType: "vocab" | "grammar"; mode: "active" | "passive" }[],
): EvaluatorResult[] {
  const RANK: Record<EvaluatorResult["outcome"], number> = {
    mastered: 5,
    produced: 4,
    produced_with_help: 3,
    recognized: 2,
    missed: 1,
  };
  const aggregated: EvaluatorResult[] = [];
  for (const target of activeTargets) {
    const flat = perTurnResults.flat().filter((r) => r.itemId === target.itemId);
    if (flat.length === 0) continue;
    const best = flat.reduce((a, b) => (RANK[b.outcome] > RANK[a.outcome] ? b : a));
    aggregated.push(best);
  }
  return aggregated;
}

export async function runScene(args: RunSceneArgs): Promise<SceneRunLog | null> {
  const built = buildScenePlan(args.reviewItems, args.now, args.recentContext);
  if (!built) return null;

  const startedAt = new Date().toISOString();
  const dialogue = await generateDialogue(built.plan, args.llmClient);

  // Index AI character lines by turn number for stitching.
  const turnsByNumber = new Map<number, DialogueLine>();
  for (const t of dialogue.turns) turnsByNumber.set(t.turn, t);

  // Warn if any expected AI turn is missing from the LLM response (e.g., model
  // renumbered turns 2/4/6 → 1/2/3). This produces an incoherent conversation
  // because player turns then have empty AI context.
  const expectedAiTurns = built.plan.scriptedTurns
    .filter((t) => t.speaker !== "coach" && t.speaker !== "player")
    .map((t) => t.turn);
  const missingAiTurns = expectedAiTurns.filter((n) => !turnsByNumber.has(n));
  if (missingAiTurns.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[runScene] LLM response missing expected AI turns: ${missingAiTurns.join(", ")}. ` +
      `Returned turns: ${[...turnsByNumber.keys()].join(", ")}. ` +
      `Conversation will have gaps. Check llmResponse in the SceneRunLog.`,
    );
  }

  const conversation: DialogueLine[] = [];
  // Per-turn evaluator results so we can both attach to the right turn AND aggregate later.
  const perTurnResults = new Map<number, EvaluatorResult[]>();

  for (const t of built.plan.scriptedTurns) {
    if (t.speaker === "coach") {
      // Coach turns are bookends — briefing/result come from generateDialogue, not the conversation array.
      continue;
    }

    if (t.speaker === "player") {
      const playerLine = await syntheticPlayerTurn({
        plan: built.plan,
        conversationSoFar: conversation,
        turnNumber: t.turn,
        persona: args.persona,
        client: args.llmClient,
      });
      conversation.push(playerLine);

      const evalResults = await evaluatePlayerTurn(playerLine.text, built.plan.activeTargets);
      perTurnResults.set(playerLine.turn, evalResults);
      continue;
    }

    // Otherwise it's an AI character — pull the line generated upfront.
    const aiLine = turnsByNumber.get(t.turn);
    if (aiLine) conversation.push(aiLine);
  }

  const itemOutcomes = aggregateOutcomes(
    Array.from(perTurnResults.values()),
    built.plan.activeTargets,
  );

  const endedAt = new Date().toISOString();

  const log: SceneRunLog = {
    id: `run-${randomUUID().slice(0, 8)}`,
    userId: args.userId ?? "default",
    templateId: built.plan.templateId,
    startedAt,
    endedAt,
    activeTargetsConsidered: built.activeConsidered,
    activeTargetsChosen: built.plan.activeTargets,
    templateCandidates: built.candidatesScored,
    templateChosen: {
      id: built.plan.templateId,
      finalScore:
        built.candidatesScored.find((c) => c.templateId === built.plan.templateId)
          ?.finalScore ?? 0,
    },
    threadAction: "standalone",
    beatFired: null,
    llmPrompt: dialogue.rawPrompt,
    llmResponse: dialogue.rawResponse,
    llmLatencyMs: dialogue.latencyMs,
    briefing: dialogue.briefing,
    result: dialogue.result,
    turns: conversation.map((line) => ({
      turn: line.turn,
      speaker: line.speaker,
      text: line.text,
      evaluatorResults:
        line.speaker === "player" ? perTurnResults.get(line.turn) : undefined,
    })),
    itemOutcomes,
  };

  writeSceneRunLog(log, args.logDir);
  return log;
}
