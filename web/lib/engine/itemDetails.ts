import { loadGrammar, loadVocab } from "@engine/content";
import type { ItemType } from "@engine/types";

// Display fields for one SRS item, joined from the static content packs
// (contract 003 introduced the join for episode items; contract 004 reuses it
// for debrief entries). surface = VocabItem.word | GrammarItem.pattern;
// reading is null for grammar (GrammarItem has no reading). Unknown ids throw
// loudly — the API routes map that to a JSON 500.
export interface ItemDetails {
  surface: string;
  reading: string | null;
  meaning: string;
}

export function lookupItemDetails(itemId: string, itemType: ItemType): ItemDetails {
  if (itemType === "vocab") {
    const item = loadVocab().find((v) => v.id === itemId);
    if (!item) {
      throw new Error(
        `Episode references unknown vocab item "${itemId}" — not in data/vocab.json`,
      );
    }
    return { surface: item.word, reading: item.reading, meaning: item.meaning };
  }
  const item = loadGrammar().find((g) => g.id === itemId);
  if (!item) {
    throw new Error(
      `Episode references unknown grammar item "${itemId}" — not in data/grammar.json`,
    );
  }
  return { surface: item.pattern, reading: null, meaning: item.meaning };
}
