import {
  applyObservatoryProceduralLayoutRules,
  cloneObservatoryLayout,
  createObservatoryCorridor,
  placeObservatoryRoomTemplate,
} from '@/modules/observatory/engine/world/layoutEditing';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type {
  ObservatoryLayoutDocument,
  ObservatoryLayoutIssue,
} from '@/modules/observatory/engine/world/layoutTypes';
import {
  type ObservatoryRoomTemplateId,
  observatoryRoomTemplates,
} from '@/modules/observatory/engine/world/roomTemplates';
import { validateObservatoryGeneratedLayout } from '@/modules/observatory/generation/proceduralLayoutRules';

export interface ObservatoryPromptLayoutPlan {
  includeCorridor: boolean;
  includeDoors: boolean;
  prompt: string;
  templateIds: ObservatoryRoomTemplateId[];
}

export interface ObservatoryPromptLayoutResult {
  issues: ObservatoryLayoutIssue[];
  layout?: ObservatoryLayoutDocument;
  plan: ObservatoryPromptLayoutPlan;
  valid: boolean;
}

const templateAliases: Array<{
  id: ObservatoryRoomTemplateId;
  terms: string[];
}> = [
  { id: 'engineering-pod', terms: ['engineering', 'engineer', 'dev', 'developer', 'pod'] },
  { id: 'research-room', terms: ['research', 'lab', 'analysis', 'experiment'] },
  { id: 'finance-room', terms: ['finance', 'finops', 'budget', 'accounting'] },
  { id: 'audit-workspace', terms: ['audit', 'compliance', 'control'] },
  { id: 'meeting-room', terms: ['meeting', 'conference', 'sync', 'standup'] },
  { id: 'ops-center', terms: ['ops', 'operations', 'incident', 'war room', 'command'] },
  { id: 'approval-room', terms: ['approval', 'review', 'gate', 'signoff'] },
];

const defaultTemplateIds: ObservatoryRoomTemplateId[] = [
  'engineering-pod',
  'ops-center',
  'meeting-room',
];

export function parseObservatoryLayoutPrompt(prompt: string): ObservatoryPromptLayoutPlan {
  const normalizedPrompt = prompt.trim();
  const lowerPrompt = normalizedPrompt.toLowerCase();
  const wantsAllTemplates = /\ball\b|\bfull\b|\bcomplete\b/.test(lowerPrompt);
  const templateIds = wantsAllTemplates
    ? observatoryRoomTemplates.map((template) => template.id)
    : templateAliases
        .filter((alias) => alias.terms.some((term) => lowerPrompt.includes(term)))
        .map((alias) => alias.id);

  return {
    includeCorridor: !lowerPrompt.includes('no corridor'),
    includeDoors: !lowerPrompt.includes('no doors'),
    prompt: normalizedPrompt,
    templateIds: uniqueTemplateIds(templateIds.length > 0 ? templateIds : defaultTemplateIds),
  };
}

export function generateObservatoryLayoutFromPrompt(
  baseLayout: ObservatoryLayoutDocument,
  prompt: string,
  mapId = baseLayout.world.maps[0]?.id
): ObservatoryPromptLayoutResult {
  const plan = parseObservatoryLayoutPrompt(prompt);

  if (!mapId) {
    return {
      issues: [
        { path: 'world.maps', reason: 'expected at least one map before prompt generation' },
      ],
      plan,
      valid: false,
    };
  }

  let nextLayout = cloneObservatoryLayout(baseLayout);

  for (const templateId of plan.templateIds) {
    const result = placeObservatoryRoomTemplate(nextLayout, mapId, templateId);
    if (!result.changed) {
      return { issues: result.issues, layout: result.layout, plan, valid: false };
    }
    nextLayout = result.layout;
  }

  if (plan.includeCorridor) {
    const result = createObservatoryCorridor(nextLayout, mapId);
    if (!result.changed) {
      return { issues: result.issues, layout: result.layout, plan, valid: false };
    }
    nextLayout = result.layout;
  }

  if (plan.includeDoors) {
    const result = applyObservatoryProceduralLayoutRules(nextLayout, mapId);
    if (!result.changed) {
      return { issues: result.issues, layout: result.layout, plan, valid: false };
    }
    nextLayout = result.layout;
  }

  return validateObservatoryPromptLayout(nextLayout, mapId, plan);
}

export function validateObservatoryPromptLayout(
  layout: ObservatoryLayoutDocument,
  mapId = layout.world.maps[0]?.id,
  plan: ObservatoryPromptLayoutPlan = parseObservatoryLayoutPrompt('')
): ObservatoryPromptLayoutResult {
  const schemaValidation = validateObservatoryLayout(layout);
  if (!schemaValidation.layout) {
    return { issues: schemaValidation.issues, layout, plan, valid: false };
  }

  const map = schemaValidation.layout.world.maps.find((candidate) => candidate.id === mapId);
  if (!map) {
    return {
      issues: [{ path: 'world.maps', reason: `map not found: ${mapId ?? 'unknown'}` }],
      layout: schemaValidation.layout,
      plan,
      valid: false,
    };
  }

  const generatedValidation = validateObservatoryGeneratedLayout(map);
  return {
    issues: generatedValidation.issues,
    layout: schemaValidation.layout,
    plan,
    valid: generatedValidation.valid,
  };
}

function uniqueTemplateIds(templateIds: ObservatoryRoomTemplateId[]) {
  return [...new Set(templateIds)];
}
