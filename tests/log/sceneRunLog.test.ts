import { describe, it, expect, beforeEach } from "vitest";
import { rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { writeSceneRunLog, readAllSceneRunLogs } from "@/lib/log/sceneRunLog";
import type { SceneRunLog } from "@/lib/types";

const TEST_DIR = join(process.cwd(), "logs", "test-tmp");

const sample: SceneRunLog = {
  id: "run-001",
  userId: "default",
  templateId: "minshuku-evening-with-kid",
  startedAt: "2026-05-04T12:00:00.000Z",
  endedAt: "2026-05-04T12:05:00.000Z",
  activeTargetsConsidered: [],
  activeTargetsChosen: [],
  templateCandidates: [],
  templateChosen: { id: "minshuku-evening-with-kid", finalScore: 10 },
  threadAction: "standalone",
  beatFired: null,
  llmPrompt: "...",
  llmResponse: "...",
  briefing: "Evening at the minshuku.",
  result: "Nice scene.",
  turns: [],
  itemOutcomes: [],
};

describe("sceneRunLog writer", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  it("appends one line per write to the JSONL file", () => {
    writeSceneRunLog(sample, TEST_DIR);
    writeSceneRunLog({ ...sample, id: "run-002" }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, "scene-runs.jsonl"), "utf8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).id).toBe("run-001");
    expect(JSON.parse(lines[1]).id).toBe("run-002");
  });

  it("readAllSceneRunLogs returns parsed entries", () => {
    writeSceneRunLog(sample, TEST_DIR);
    const all = readAllSceneRunLogs(TEST_DIR);
    expect(all.length).toBe(1);
    expect(all[0].id).toBe("run-001");
  });
});
