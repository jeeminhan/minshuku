import type { SceneRunLog, SceneTemplate } from "../types";

export interface RecentContext {
  lastTemplateId: string | null;
  lastLocation: string | null;
}

export function recentContextFromLogs(
  logs: SceneRunLog[],
  templates: SceneTemplate[],
): RecentContext {
  const last = logs.at(-1);
  if (!last) return { lastTemplateId: null, lastLocation: null };

  const lastTemplateId = last.templateChosen.id || last.templateId || null;
  const lastTemplate = templates.find((t) => t.id === lastTemplateId);

  return {
    lastTemplateId,
    lastLocation: lastTemplate?.location ?? null,
  };
}
