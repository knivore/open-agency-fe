import type { TaskDefinition, WorkflowCapabilityTag } from '@/types/workflows';

export type AgenticTaskTemplateId =
  | 'research'
  | 'critique'
  | 'implementation'
  | 'validation'
  | 'report';

interface TaskTemplateDefinition {
  id: AgenticTaskTemplateId;
  label: string;
  addTaskLabel: string;
  addTaskDescription: string;
  name: string;
  description: string;
  instructions: string;
  expectedOutput: string;
}

const CAPABILITY_TASK_TEMPLATES: Record<
  WorkflowCapabilityTag,
  {
    label: string;
    addTaskLabel: string;
    addTaskDescription: string;
    name: string;
    description: string;
    instructions: string;
    expectedOutput: string;
  }
> = {
  'home-control': {
    label: 'Smart Home control',
    addTaskLabel: 'Add Smart Home Task',
    addTaskDescription: 'Add a starter task for Smart Home reads, room context, or safe actions.',
    name: 'Smart Home control task',
    description: 'Inspect or control rooms, devices, scenes, or speakers through Smart Home.',
    instructions:
      'Use canonical agency.device.* tools for device orchestration, state reads, and safe actions. Use home_assistant.* only for explicit Home Assistant entity, service, or vendor-specific diagnostics.',
    expectedOutput: 'Structured smart-home status or safe action result',
  },
  vision: {
    label: 'Vision',
    addTaskLabel: 'Add Vision Task',
    addTaskDescription:
      'Add a starter task for image analysis, camera review, or scene understanding.',
    name: 'Vision task',
    description:
      'Analyze imagery, camera snapshots, or visual state with Open Agency vision capabilities.',
    instructions:
      'Use Open Agency vision capabilities to inspect the relevant image or camera input and return a structured summary for the workflow.',
    expectedOutput: 'Structured scene analysis or visual summary',
  },
  voice: {
    label: 'Speech',
    addTaskLabel: 'Add Speech Task',
    addTaskDescription:
      'Add a starter task for speech input, announcements, or conversational continuation.',
    name: 'Speech task',
    description:
      'Handle speech input, spoken output, or conversational continuation with Open Agency speech capabilities.',
    instructions:
      'Use Open Agency speech capabilities to listen, speak, or continue a conversational turn as part of the workflow.',
    expectedOutput: 'Transcript, spoken response, or conversational continuation state',
  },
};

export const AGENTIC_TASK_TEMPLATES: TaskTemplateDefinition[] = [
  {
    id: 'research',
    label: 'Research',
    addTaskLabel: 'Add Research Task',
    addTaskDescription: 'Add a research task that gathers evidence and cites useful findings.',
    name: 'Research task',
    description: 'Gather facts, sources, constraints, and open questions for the workflow.',
    instructions:
      'Research the assigned topic, collect relevant evidence, call out uncertainty, and produce concise findings that downstream tasks can use.',
    expectedOutput: 'Evidence summary with sources, assumptions, and open questions',
  },
  {
    id: 'critique',
    label: 'Critique',
    addTaskLabel: 'Add Critique Task',
    addTaskDescription: 'Add a critique task that reviews quality, risks, and gaps.',
    name: 'Critique task',
    description: 'Review prior work for gaps, risks, contradictions, and quality issues.',
    instructions:
      'Critique the available output against the workflow goal. Prioritize concrete risks, missing evidence, and changes that would improve the result.',
    expectedOutput: 'Prioritized critique with risks, gaps, and recommended fixes',
  },
  {
    id: 'implementation',
    label: 'Implementation',
    addTaskLabel: 'Add Implementation Task',
    addTaskDescription: 'Add an implementation task that turns the plan into a concrete change.',
    name: 'Implementation task',
    description: 'Implement the selected plan or change using the available workflow context.',
    instructions:
      'Carry out the implementation using the approved plan and available context. Keep changes scoped, preserve constraints, and note any follow-up needed.',
    expectedOutput: 'Implemented change summary with files, outputs, or artifacts produced',
  },
  {
    id: 'validation',
    label: 'Validation',
    addTaskLabel: 'Add Validation Task',
    addTaskDescription: 'Add a validation task that checks correctness and readiness.',
    name: 'Validation task',
    description: 'Verify that the workflow output satisfies the goal and required constraints.',
    instructions:
      'Validate the preceding output. Run available checks, inspect edge cases, and report pass/fail evidence with any remaining risk.',
    expectedOutput: 'Validation result with checks performed, evidence, and residual risk',
  },
  {
    id: 'report',
    label: 'Report',
    addTaskLabel: 'Add Report Task',
    addTaskDescription: 'Add a report task that turns findings into a final handoff.',
    name: 'Report task',
    description: 'Synthesize workflow results into a clear final report or handoff.',
    instructions:
      'Summarize the completed workflow for the target reader. Include outcomes, decisions, evidence, limitations, and recommended next actions.',
    expectedOutput: 'Final report with outcomes, evidence, limitations, and next actions',
  },
];

export function agenticTaskTemplate(templateId: AgenticTaskTemplateId) {
  return AGENTIC_TASK_TEMPLATES.find((template) => template.id === templateId) ?? null;
}
export function workflowTaskStarterTemplate(
  workflowCapabilityTags: WorkflowCapabilityTag[],
  index: number
) {
  if (workflowCapabilityTags.length === 0) {
    return null;
  }

  const tag = workflowCapabilityTags[index % workflowCapabilityTags.length];
  return CAPABILITY_TASK_TEMPLATES[tag] ?? null;
}

export function createCapabilityStarterTaskDraft(
  workflowCapabilityTags: WorkflowCapabilityTag[],
  index: number
): Partial<TaskDefinition> {
  const template = workflowTaskStarterTemplate(workflowCapabilityTags, index);
  if (!template) {
    return {};
  }

  return {
    name: `${template.name} ${index + 1}`,
    description: template.description,
    instructions: template.instructions,
    expected_output: template.expectedOutput,
  };
}

export function createAgenticTaskTemplateDraft(
  templateId: AgenticTaskTemplateId,
  index: number
): Partial<TaskDefinition> {
  const template = agenticTaskTemplate(templateId);
  if (!template) {
    return {};
  }

  return {
    name: `${template.name} ${index + 1}`,
    description: template.description,
    instructions: template.instructions,
    expected_output: template.expectedOutput,
    metadata: {
      task_template_id: template.id,
      task_template_label: template.label,
    },
  };
}
