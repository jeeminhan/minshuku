import { readAllSceneRunLogs } from "../src/lib/log/sceneRunLog.js";
import { renderSceneRunLog } from "../src/lib/log/renderSceneRunLog.js";

function main(): void {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith("--id="));
  const targetId = idArg ? idArg.slice("--id=".length) : null;

  const all = readAllSceneRunLogs();
  if (all.length === 0) {
    console.log("No scene runs logged yet.");
    return;
  }

  const log = targetId ? all.find((l) => l.id === targetId) : all[all.length - 1];
  if (!log) {
    console.log(targetId ? `No log found for id=${targetId}` : "No log found.");
    return;
  }

  console.log(renderSceneRunLog(log));
}

main();
