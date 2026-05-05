import type { SceneRunLog } from "../types";

export function renderSceneRunLog(log: SceneRunLog): string {
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push(`Scene Run: ${log.id}`);
  lines.push(`Template:  ${log.templateChosen.id}  (score ${log.templateChosen.finalScore})`);
  lines.push(`Started:   ${log.startedAt}`);
  lines.push(`Ended:     ${log.endedAt}`);
  lines.push("-".repeat(60));
  lines.push("Briefing (coach):");
  lines.push(`  ${log.briefing}`);
  lines.push("-".repeat(60));
  lines.push("Item assignments:");
  for (const a of log.activeTargetsChosen) lines.push(`  [active]  ${a.itemId}`);
  for (const p of log.passiveItemsChosen) lines.push(`  [passive] ${p.itemId}`);
  lines.push("-".repeat(60));
  lines.push("Template candidates:");
  for (const c of log.templateCandidates) {
    lines.push(`  ${c.templateId}  score=${c.finalScore}`);
    for (const r of c.reasons) lines.push(`     - ${r}`);
  }
  lines.push("-".repeat(60));
  lines.push("Dialogue:");
  for (const t of log.turns) {
    lines.push(`  [${t.turn}] ${t.speaker}: ${t.text}`);
    if (t.evaluatorResults) {
      for (const e of t.evaluatorResults) {
        lines.push(`         eval: ${e.itemId} -> ${e.outcome}  (${e.evidence.notes ?? ""})`);
      }
    }
  }
  lines.push("-".repeat(60));
  lines.push("Result (coach):");
  lines.push(`  ${log.result}`);
  lines.push("-".repeat(60));
  lines.push("Outcomes:");
  for (const o of log.itemOutcomes) {
    lines.push(`  ${o.itemId}  ${o.mode}  ${o.outcome}`);
  }
  lines.push("=".repeat(60));

  return lines.join("\n");
}
