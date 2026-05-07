// Pure helpers for register + domain fit between an item and a template.
// Both fields are optional during the migration: when missing, the helper
// returns true (no constraint) so existing data keeps loading and existing
// runs don't change behavior. Once data is fully tagged, callers can flip
// to strict mode by treating "missing" as "fail" themselves.

import type { Domain, Register, SceneTemplate, VocabItem, GrammarItem } from "../types.js";

// Default register acceptances when a template doesn't declare its own.
// Derived from the template's registerTag — a casual scene shouldn't host
// formal/literary words; a keigo scene shouldn't host casual.
// `literary` is intentionally excluded from keigo's defaults: existing keigo
// templates (package-delivery, station-directions) are service-register, not
// speech/ceremony. Items tagged `literary` (e.g. ～ようではないか, a rallying
// exhortation) are un-hostable until a speech/ceremony template exists; that
// scope gap is preferable to forcing them into service interactions.
const DEFAULT_ACCEPTED_REGISTERS: Record<SceneTemplate["registerTag"], Register[]> = {
  casual: ["casual", "neutral"],
  polite: ["neutral", "polite"],
  elder: ["polite", "formal"],
  keigo: ["polite", "formal"],
};

export type ItemWithFit = (VocabItem | GrammarItem) & { register?: Register; domain?: Domain[] };

export function acceptedRegisters(template: SceneTemplate): Register[] {
  return template.acceptedRegisters ?? DEFAULT_ACCEPTED_REGISTERS[template.registerTag];
}

// Register fit: does the item's register match the template's accepted
// registers? Returns true if either side is missing (graceful degradation).
export function registerFits(item: ItemWithFit, template: SceneTemplate): boolean {
  if (!item.register) return true;
  return acceptedRegisters(template).includes(item.register);
}

// Domain fit: does the item share at least one domain with the template?
// Returns true if either side is missing.
export function domainFits(item: ItemWithFit, template: SceneTemplate): boolean {
  if (!item.domain || item.domain.length === 0) return true;
  if (!template.acceptedDomains || template.acceptedDomains.length === 0) return true;
  const accepted = new Set<Domain>(template.acceptedDomains);
  return item.domain.some((d) => accepted.has(d));
}

// Combined gate. Used by passive picker (and later active filter) to drop
// items that violate either constraint.
export function fitsTemplate(item: ItemWithFit, template: SceneTemplate): boolean {
  return registerFits(item, template) && domainFits(item, template);
}
