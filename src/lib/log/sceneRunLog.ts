import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SceneRunLog } from "../types";

const DEFAULT_DIR = join(process.cwd(), "logs");
const FILENAME = "scene-runs.jsonl";

export function writeSceneRunLog(
  log: SceneRunLog,
  dir: string = DEFAULT_DIR
): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, FILENAME);
  appendFileSync(path, JSON.stringify(log) + "\n", "utf8");
}

export function readAllSceneRunLogs(dir: string = DEFAULT_DIR): SceneRunLog[] {
  const path = join(dir, FILENAME);
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf8");
  return content
    .trim()
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as SceneRunLog);
}
