import type { SceneTemplate, TemplateScoringRationale } from "../types";

interface ScoringContext {
  lastTemplateId: string | null;
  lastLocation: string | null;
}

// For v0, scoring is intentionally minimal:
//   - base score 10
//   - -5 if this template ran most recently
//   - -2 if this template's location matches the most recent location
// (v1 will add thread-advancer preference, beat compatibility, etc.)
export function scoreTemplates(
  templates: SceneTemplate[],
  ctx: ScoringContext,
): TemplateScoringRationale[] {
  return templates.map((tpl) => {
    let score = 10;
    const reasons: string[] = ["base score 10"];

    if (ctx.lastTemplateId === tpl.id) {
      score -= 5;
      reasons.push("-5: same template as most recent run");
    }
    if (ctx.lastLocation && ctx.lastLocation === tpl.location) {
      score -= 2;
      reasons.push("-2: same location as most recent run");
    }

    return { templateId: tpl.id, finalScore: score, reasons };
  });
}

export function pickBestTemplate(
  scored: TemplateScoringRationale[],
): TemplateScoringRationale | null {
  if (scored.length === 0) return null;
  return [...scored].sort((a, b) => b.finalScore - a.finalScore)[0];
}
