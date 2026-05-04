import { loadGrammar, loadVocab } from "../content";
import { containsPattern } from "./conjugation";
import type { ItemAssignment } from "../types";

export async function checkTargetPresence(
  playerText: string,
  target: ItemAssignment,
): Promise<boolean> {
  if (target.itemType === "grammar") {
    const g = loadGrammar().find((x) => x.id === target.itemId);
    if (!g) return false;
    return await containsPattern(playerText, g.pattern);
  } else {
    const v = loadVocab().find((x) => x.id === target.itemId);
    if (!v) return false;
    return await containsPattern(playerText, v.word);
  }
}
