// Core domain types for Hanare v0.
// Mirrors the data model in docs/superpowers/specs/2026-05-04-foundational-design.md §15.
// Optional fields not used in v0 are commented out for forward compatibility.

export type ItemType = "vocab" | "grammar";

export interface VocabItem {
  id: string;
  word: string;          // e.g., "窓"
  reading: string;       // e.g., "まど"
  meaning: string;       // English gloss
  partOfSpeech: string;  // e.g., "noun"
  jlptLevel: "N5" | "N4" | "N3" | "N2" | "N1";
  frequencyRank?: number;
  scenarioTags: string[];
  exampleSentences: string[];
}

export interface GrammarItem {
  id: string;
  pattern: string;       // e.g., "つもり"
  meaning: string;       // English gloss
  jlptLevel: "N5" | "N4" | "N3" | "N2" | "N1";
  formation: string;     // e.g., "Verb dictionary form + つもりです"
  scenarioTags: string[];
  exampleSentences: string[];
  commonMistakes?: string[];
}

export interface CharacterRef {
  id: string;            // e.g., "kid", "mom", "shrine_keeper"
  role: string;          // e.g., "host_family_kid"
  voiceConfig?: string;  // TTS voice ID, unused in v0
}

export interface ScriptedTurn {
  turn: number;
  speaker: "coach" | "player" | string; // string = character id
}

export interface SceneTemplate {
  id: string;
  location: string;
  characters: CharacterRef[];
  scriptedTurns: ScriptedTurn[];
  microStakeSkeleton: string;
  registerTag: "casual" | "polite" | "elder" | "keigo";
  // Items the template can host as the active target. e.g., ["grammar:つもり", "tag:planning"].
  activeTargetCompatibility: string[];
  // Tags drawn on for passive items. e.g., ["evening", "weather"].
  passiveScenarioTags: string[];
  allowedNudges: string[];
  exitBeat: string;
  flags?: {
    mysteryPorous?: boolean;
    opensThread?: boolean;
    requiresOpenThread?: boolean;
  };
}

export interface ReviewItem {
  itemId: string;
  itemType: ItemType;
  lastReviewedAt: string | null;  // ISO date
  nextReviewAt: string | null;    // ISO date
  ease: number;                    // SM2-ish ease factor
  interval: number;                // days
  lapses: number;
}

export type RecallMode = "active" | "passive";
export type Outcome =
  | "missed"
  | "recognized"
  | "produced_with_help"
  | "produced"
  | "mastered";

export interface ItemAssignment {
  itemId: string;
  itemType: ItemType;
  mode: RecallMode;
}

export interface ScenePlan {
  templateId: string;
  location: string;
  characters: CharacterRef[];
  microStake: string;            // filled-in version of the skeleton
  activeTargets: ItemAssignment[];
  passiveItems: ItemAssignment[];
  registerTag: SceneTemplate["registerTag"];
  scriptedTurns: ScriptedTurn[];
}

export interface DialogueLine {
  turn: number;
  speaker: "coach" | "player" | string;
  text: string;     // for v0, this is the LLM-generated text (player turns are placeholder until synthetic player runs)
  language: "ja" | "en";
}

export interface EvaluatorResult {
  itemId: string;
  mode: RecallMode;
  outcome: Outcome;
  evidence: {
    targetPresent?: boolean;
    morphologyOk?: boolean;
    sttConfidence?: number;       // not used in v0 (no STT), kept for forward compat
    lowConfidence?: boolean;
    notes?: string;
  };
}

export interface TemplateScoringRationale {
  templateId: string;
  finalScore: number;
  reasons: string[];
}

export interface SceneRunLog {
  id: string;                     // run-uuid
  userId: string;                 // "default" for v0 single-user mode
  templateId: string;
  startedAt: string;
  endedAt: string;

  // generator decisions
  activeTargetsConsidered: ItemAssignment[];
  activeTargetsChosen: ItemAssignment[];
  templateCandidates: TemplateScoringRationale[];
  templateChosen: { id: string; finalScore: number };

  // narrative state — empty in v0 (threads + beats arrive in later plans)
  threadAction: "standalone";
  beatFired: null;

  // generation
  llmPrompt: string;
  llmResponse: string;
  llmCost?: number;
  llmLatencyMs?: number;

  // execution
  briefing: string;               // English coach text from generateDialogue
  result: string;                 // English coach text from generateDialogue
  turns: Array<{
    turn: number;
    speaker: string;
    text: string;
    evaluatorResults?: EvaluatorResult[];  // present only on player turns
  }>;

  // outcomes — aggregated per active item (best outcome across all player turns)
  itemOutcomes: EvaluatorResult[];
}
