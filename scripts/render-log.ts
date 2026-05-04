import { readAllSceneRunLogs } from "../src/lib/log/sceneRunLog.js";

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

  console.log("=".repeat(60));
  console.log(`Scene Run: ${log.id}`);
  console.log(`Template:  ${log.templateChosen.id}  (score ${log.templateChosen.finalScore})`);
  console.log(`Started:   ${log.startedAt}`);
  console.log(`Ended:     ${log.endedAt}`);
  console.log("-".repeat(60));
  console.log("Briefing (coach):");
  console.log(`  ${log.briefing}`);
  console.log("-".repeat(60));
  console.log("Item assignments:");
  for (const a of log.activeTargetsChosen) console.log(`  [active]  ${a.itemId}`);
  console.log("-".repeat(60));
  console.log("Template candidates:");
  for (const c of log.templateCandidates) {
    console.log(`  ${c.templateId}  score=${c.finalScore}`);
    for (const r of c.reasons) console.log(`     • ${r}`);
  }
  console.log("-".repeat(60));
  console.log("Dialogue:");
  for (const t of log.turns) {
    console.log(`  [${t.turn}] ${t.speaker}: ${t.text}`);
    if (t.evaluatorResults) {
      for (const e of t.evaluatorResults) {
        console.log(`         eval: ${e.itemId} → ${e.outcome}  (${e.evidence.notes ?? ""})`);
      }
    }
  }
  console.log("-".repeat(60));
  console.log("Result (coach):");
  console.log(`  ${log.result}`);
  console.log("-".repeat(60));
  console.log("Outcomes:");
  for (const o of log.itemOutcomes) {
    console.log(`  ${o.itemId}  ${o.mode}  ${o.outcome}`);
  }
  console.log("=".repeat(60));
}

main();
