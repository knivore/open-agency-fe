import type { JsonObject } from '@/types/api';

export type AssistantPageSurface =
  | 'assistant'
  | 'workflow.list'
  | 'workflow.detail'
  | 'agent.list'
  | 'operator.list'
  | 'operator.create'
  | 'operator.detail'
  | 'goal.list'
  | 'goal.detail'
  | 'persona.list'
  | 'persona.detail'
  | 'runs.list'
  | 'runs.detail'
  | 'model.list'
  | 'integrations'
  | 'integrations.operations'
  | 'smart-home'
  | 'agency.graph'
  | 'profile'
  | 'faq'
  | 'memory'
  | 'monitor'
  | 'diagnostics'
  | 'devices'
  | 'observatory.builder'
  | 'runtime'
  | 'marketplace'
  | 'unknown';

export interface AssistantSuggestedPrompt extends JsonObject {
  id: string;
  label: string;
  prompt: string;
  intent: 'configure' | 'diagnose' | 'navigate' | 'optimize' | 'understand';
  mutates: false;
}

export interface AssistantRouteContext {
  surface: AssistantPageSurface;
  title: string | null;
  description?: string;
  allowedActions?: string[];
  suggestedPrompts?: AssistantSuggestedPrompt[];
}

interface AssistantRouteContextDefinition extends AssistantRouteContext {
  matches: (pathname: string) => boolean;
}

function prompt(
  id: string,
  label: string,
  value: string,
  intent: AssistantSuggestedPrompt['intent']
): AssistantSuggestedPrompt {
  return { id, label, prompt: value, intent, mutates: false };
}

function exact(route: string) {
  return (pathname: string) => pathname === route;
}

function under(route: string) {
  return (pathname: string) => pathname === route || pathname.startsWith(`${route}/`);
}

const assistantRouteContexts: AssistantRouteContextDefinition[] = [
  {
    matches: exact('/workflows'),
    surface: 'workflow.list',
    title: 'Workflows',
    description: 'Create, find, validate, and run LLM workflows.',
    allowedActions: ['workflow.create', 'workflow.import', 'workflow.search', 'workflow.open'],
    suggestedPrompts: [
      prompt(
        'workflow-list-next',
        'Choose my next workflow',
        'Review the workflows on this page and help me choose the best one to run next.',
        'navigate'
      ),
      prompt(
        'workflow-list-attention',
        'Find what needs attention',
        'Check which workflows need attention and explain the most important next action.',
        'diagnose'
      ),
      prompt(
        'workflow-list-create',
        'Plan a new workflow',
        'Help me turn my goal into the smallest useful workflow I can test safely.',
        'configure'
      ),
    ],
  },
  {
    matches: under('/workflows'),
    surface: 'workflow.detail',
    title: 'Workflow',
    description: 'Configure, validate, and operate the selected workflow.',
    allowedActions: ['workflow.inspect', 'workflow.validate', 'workflow.run'],
    suggestedPrompts: [
      prompt(
        'workflow-readiness',
        'Check readiness',
        'Check whether this workflow is ready to run and list only the missing or risky items.',
        'diagnose'
      ),
      prompt(
        'workflow-explain',
        'Explain this workflow',
        'Explain this workflow in plain language, including its trigger, agents, model, tools, and expected result.',
        'understand'
      ),
      prompt(
        'workflow-improve',
        'Suggest one improvement',
        'Review this workflow and suggest the single highest-value improvement without changing it yet.',
        'optimize'
      ),
    ],
  },
  {
    matches: under('/agents'),
    surface: 'agent.list',
    title: 'Agents',
    description: 'Create, inspect, and assign focused runtime agents.',
    allowedActions: ['agent.inspect', 'agent.create', 'agent.propose_update'],
    suggestedPrompts: [
      prompt(
        'agent-choose',
        'Choose an agent',
        'Help me choose the right agent for the workflow I am building.',
        'navigate'
      ),
      prompt(
        'agent-gaps',
        'Find role gaps',
        'Review the available agents and identify any important role or capability gap.',
        'diagnose'
      ),
      prompt(
        'agent-design',
        'Design a focused agent',
        'Help me define a focused agent with a clear role, boundaries, tools, and handoff behavior.',
        'configure'
      ),
    ],
  },
  {
    matches: exact('/operators'),
    surface: 'operator.list',
    title: 'Operators',
    description: 'Supervise persistent, governed responsibility owners.',
    allowedActions: ['operator.inspect', 'operator.propose_create', 'operator.health'],
    suggestedPrompts: [
      prompt(
        'operator-attention',
        'Find what needs attention',
        'Review Operator health and explain which responsibility needs owner attention first.',
        'diagnose'
      ),
      prompt(
        'operator-no-action',
        'Explain recent silence',
        'Explain which Operators recently chose no action and why that was the correct bounded result.',
        'understand'
      ),
    ],
  },
  {
    matches: exact('/operators/create'),
    surface: 'operator.create',
    title: 'Create operator',
    description: 'Propose and review a persistent responsibility and its boundaries.',
    allowedActions: ['operator.propose_create', 'operator.validate_proposal'],
    suggestedPrompts: [
      prompt(
        'operator-scope',
        'Tighten this responsibility',
        'Help me make this Operator responsibility narrower, measurable, and safe to supervise.',
        'configure'
      ),
    ],
  },
  {
    matches: under('/operators'),
    surface: 'operator.detail',
    title: 'Operator',
    description: 'Inspect decision lineage, goals, capabilities, waits, delivery, and lifecycle.',
    allowedActions: ['operator.inspect', 'operator.pause', 'operator.wake', 'operator.stop'],
    suggestedPrompts: [
      prompt(
        'operator-decision',
        'Explain the latest decision',
        'Explain the latest Operator wake reason, evidence, decision, and resulting authoritative action.',
        'understand'
      ),
      prompt(
        'operator-boundary',
        'Check the boundaries',
        'Review this Operator’s grants, autonomy, approvals, and budgets for any unsafe or missing boundary.',
        'diagnose'
      ),
    ],
  },
  {
    matches: exact('/goals'),
    surface: 'goal.list',
    title: 'Goals',
    description: 'Supervise durable objectives across workflow attempts, evidence, and approvals.',
    allowedActions: ['goal.inspect', 'goal.create', 'goal.pause', 'goal.resume'],
    suggestedPrompts: [
      prompt(
        'goal-attention',
        'Find blocked work',
        'Review these goals and explain which blocked, stale, or missing-evidence objective needs attention first.',
        'diagnose'
      ),
      prompt(
        'goal-progress',
        'Summarize progress',
        'Summarize active goal progress, linked workflow attempts, and the next supervisor action.',
        'understand'
      ),
    ],
  },
  {
    matches: under('/goals'),
    surface: 'goal.detail',
    title: 'Goal',
    description:
      'Inspect one durable objective, its plan, runs, waits, evidence, and supervision history.',
    allowedActions: ['goal.inspect', 'goal.pause', 'goal.resume', 'goal.evaluate'],
    suggestedPrompts: [
      prompt(
        'goal-next-action',
        'Explain the next action',
        'Explain this goal’s current plan, blockers, active runs, and safest next action.',
        'understand'
      ),
      prompt(
        'goal-evidence-gap',
        'Find evidence gaps',
        'Review this goal’s success criteria and evidence and identify the smallest missing proof.',
        'diagnose'
      ),
    ],
  },
  {
    matches: exact('/persona'),
    surface: 'persona.list',
    title: 'Persona',
    description: 'Create reusable identity and expertise for agents.',
    allowedActions: ['persona.inspect', 'persona.create', 'persona.publish'],
    suggestedPrompts: [
      prompt(
        'persona-explain',
        'Explain personas',
        'Explain when I should use a persona instead of configuring an agent directly.',
        'understand'
      ),
      prompt(
        'persona-source',
        'Choose source material',
        'Help me choose the smallest useful source material for a new persona.',
        'configure'
      ),
      prompt(
        'persona-review',
        'Review persona coverage',
        'Review the personas on this page and identify overlapping or missing expertise.',
        'diagnose'
      ),
    ],
  },
  {
    matches: under('/persona'),
    surface: 'persona.detail',
    title: 'Persona',
    description: 'Review and publish the selected reusable persona.',
    allowedActions: ['persona.inspect', 'persona.publish'],
    suggestedPrompts: [
      prompt(
        'persona-detail-explain',
        'Explain this persona',
        'Summarize this persona, its expertise, and where it should be used.',
        'understand'
      ),
      prompt(
        'persona-detail-readiness',
        'Check publish readiness',
        'Check whether this persona is ready to publish and identify any weak or conflicting guidance.',
        'diagnose'
      ),
      prompt(
        'persona-detail-improve',
        'Improve the boundaries',
        'Suggest clearer persona boundaries and exclusions without applying changes.',
        'optimize'
      ),
    ],
  },
  {
    matches: exact('/runs'),
    surface: 'runs.list',
    title: 'Runs',
    description: 'Inspect active, waiting, failed, and completed executions.',
    allowedActions: ['run.search', 'run.inspect', 'run.filter'],
    suggestedPrompts: [
      prompt(
        'runs-attention',
        'Summarize what needs attention',
        'Review recent runs and summarize failed, waiting, or repeatedly unhealthy activity.',
        'diagnose'
      ),
      prompt(
        'runs-priority',
        'Prioritize failures',
        'Prioritize the failed runs by likely impact and tell me which one to inspect first.',
        'diagnose'
      ),
      prompt(
        'runs-patterns',
        'Find repeated patterns',
        'Look for repeated run failures or slowdowns and explain the likely shared cause.',
        'optimize'
      ),
    ],
  },
  {
    matches: under('/runs'),
    surface: 'runs.detail',
    title: 'Run',
    description: 'Inspect evidence and recover the selected execution safely.',
    allowedActions: ['run.inspect', 'run.retry', 'run.resume', 'run.cancel'],
    suggestedPrompts: [
      prompt(
        'run-failure',
        'Explain the failure',
        'Explain why this run failed using the first actionable error and supporting evidence.',
        'diagnose'
      ),
      prompt(
        'run-recovery',
        'Recommend recovery',
        'Recommend the safest recovery step for this run, but do not retry or mutate anything yet.',
        'diagnose'
      ),
      prompt(
        'run-timeline',
        'Summarize the timeline',
        'Summarize this run timeline and highlight the point where behavior first became abnormal.',
        'understand'
      ),
    ],
  },
  {
    matches: under('/models'),
    surface: 'model.list',
    title: 'Models',
    description: 'Configure and verify LLM connections and model profiles.',
    allowedActions: ['model.inspect', 'model.configure', 'model.test'],
    suggestedPrompts: [
      prompt(
        'model-health',
        'Check model health',
        'Review the model connections on this page and identify anything unavailable or misconfigured.',
        'diagnose'
      ),
      prompt(
        'model-choice',
        'Choose a model',
        'Help me choose the most appropriate configured model for my workflow requirements.',
        'navigate'
      ),
      prompt(
        'model-configure',
        'Configure a model',
        'Guide me through configuring and testing a model connection using the fields on this page.',
        'configure'
      ),
    ],
  },
  {
    matches: under('/integrations/smart-home'),
    surface: 'smart-home',
    title: 'Smart Home',
    description: 'Connect and verify Home Assistant entities and permissions.',
    allowedActions: ['integration.inspect', 'integration.configure', 'integration.test'],
    suggestedPrompts: [
      prompt(
        'smart-home-status',
        'Check connection status',
        'Check the Smart Home connection status and explain the next required setup step.',
        'diagnose'
      ),
      prompt(
        'smart-home-permissions',
        'Review permissions',
        'Explain which Home Assistant permissions and entity access this setup needs.',
        'configure'
      ),
      prompt(
        'smart-home-test',
        'Plan a safe test',
        'Help me plan a safe read-only test before enabling any device-changing actions.',
        'configure'
      ),
    ],
  },
  {
    matches: under('/integrations'),
    surface: 'integrations',
    title: 'Integrations',
    description: 'Connect, test, and monitor external providers and MCP servers.',
    allowedActions: ['integration.inspect', 'integration.configure', 'integration.test'],
    suggestedPrompts: [
      prompt(
        'integration-next',
        'Choose an integration',
        'Help me choose the integration required for the workflow I want to run.',
        'navigate'
      ),
      prompt(
        'integration-health',
        'Check connector health',
        'Review connector health and explain the first actionable problem.',
        'diagnose'
      ),
      prompt(
        'integration-setup',
        'Guide this setup',
        'Guide me through configuring and testing the selected integration using the fields shown here.',
        'configure'
      ),
    ],
  },
  {
    matches: under('/memory-graph'),
    surface: 'agency.graph',
    title: 'Agency Graph',
    description: 'Explore operational relationships, executions, incidents, and memory.',
    allowedActions: ['graph.search', 'graph.focus', 'graph.explain'],
    suggestedPrompts: [
      prompt(
        'graph-explain',
        'Explain this graph',
        'Explain the visible Agency Graph and the most important relationship or incident it shows.',
        'understand'
      ),
      prompt(
        'graph-failure',
        'Focus problem nodes',
        'Help me identify which failed or unhealthy graph nodes I should inspect first.',
        'diagnose'
      ),
      prompt(
        'graph-search',
        'Find a relationship',
        'Help me find the relationship between a workflow, its agents, recent runs, and memory.',
        'navigate'
      ),
    ],
  },
  {
    matches: under('/operations/memory'),
    surface: 'memory',
    title: 'Memory Ops',
    description: 'Inspect, ingest, compact, summarize, and maintain memory.',
    allowedActions: ['memory.search', 'memory.inspect', 'memory.maintain'],
    suggestedPrompts: [
      prompt(
        'memory-explain',
        'Explain memory scope',
        'Explain the memory scopes visible here and when each should be used.',
        'understand'
      ),
      prompt(
        'memory-health',
        'Check memory health',
        'Review memory health and identify stale, duplicated, or risky content that needs attention.',
        'diagnose'
      ),
      prompt(
        'memory-maintain',
        'Plan maintenance',
        'Recommend a safe memory maintenance plan without deleting or compacting anything yet.',
        'optimize'
      ),
    ],
  },
  {
    matches: under('/operations/main-agent-monitor'),
    surface: 'monitor',
    title: 'Main-agent monitor',
    description: 'Inspect supervisory activity, findings, proposals, and human attention.',
    allowedActions: ['monitor.inspect', 'monitor.filter', 'monitor.explain'],
    suggestedPrompts: [
      prompt(
        'monitor-attention',
        'Summarize human attention',
        'Summarize the items that currently need human attention and rank them by urgency.',
        'diagnose'
      ),
      prompt(
        'monitor-health',
        'Explain operational health',
        'Explain the current operational health and any degraded or stale signals.',
        'understand'
      ),
      prompt(
        'monitor-patterns',
        'Find recurring findings',
        'Look for recurring findings or steering requests and suggest the best systemic fix.',
        'optimize'
      ),
    ],
  },
  {
    matches: under('/operations/diagnostics'),
    surface: 'diagnostics',
    title: 'Diagnostics',
    description: 'Inspect backend, database, runtime, and service health.',
    allowedActions: ['diagnostics.inspect', 'diagnostics.refresh'],
    suggestedPrompts: [
      prompt(
        'diagnostics-summary',
        'Summarize degraded services',
        'Summarize every degraded or unavailable diagnostic and identify the first dependency to fix.',
        'diagnose'
      ),
      prompt(
        'diagnostics-explain',
        'Explain this diagnostic',
        'Explain the selected diagnostic in plain language and what healthy behavior should look like.',
        'understand'
      ),
      prompt(
        'diagnostics-plan',
        'Plan a recovery check',
        'Give me a safe sequence of checks to recover the unhealthy service.',
        'diagnose'
      ),
    ],
  },
  {
    matches: (pathname) =>
      under('/operations/devices')(pathname) || under('/operations/physical-devices')(pathname),
    surface: 'devices',
    title: 'Devices',
    description: 'Inspect and operate connected physical and smart-home devices.',
    allowedActions: ['device.inspect', 'device.test'],
    suggestedPrompts: [
      prompt(
        'device-health',
        'Check device health',
        'Review device health and explain any unavailable, stale, or unsafe state.',
        'diagnose'
      ),
      prompt(
        'device-safe-test',
        'Plan a safe device test',
        'Plan the safest available device test and explain what it will and will not change.',
        'configure'
      ),
      prompt(
        'device-audit',
        'Review recent commands',
        'Review recent device commands and identify failures or unexpected behavior.',
        'diagnose'
      ),
    ],
  },
  {
    matches: under('/profile'),
    surface: 'profile',
    title: 'Profile',
    description: 'Manage identity, sessions, and backend API tokens.',
    allowedActions: ['profile.inspect', 'token.inspect'],
    suggestedPrompts: [
      prompt(
        'profile-explain',
        'Explain account access',
        'Explain the identity, session, and API token information shown on this page.',
        'understand'
      ),
      prompt(
        'profile-token-scope',
        'Review token scope',
        'Help me choose the minimum API token scopes required for my intended automation.',
        'configure'
      ),
      prompt(
        'profile-security',
        'Check access hygiene',
        'Review the visible access information and point out stale or unnecessarily broad access.',
        'diagnose'
      ),
    ],
  },
  {
    matches: under('/help/faq'),
    surface: 'faq',
    title: 'Frequently asked questions',
    description: 'Find concise guidance for using this Open Agency install.',
    allowedActions: ['faq.search', 'assistant.ask'],
    suggestedPrompts: [
      prompt(
        'faq-start',
        'Tell me where to start',
        'Ask me what I am trying to achieve, then direct me to the smallest useful next step in Open Agency.',
        'navigate'
      ),
      prompt(
        'faq-integration',
        'Help with an integration',
        'Help me identify and configure the integration my workflow needs.',
        'configure'
      ),
      prompt(
        'faq-concept',
        'Explain an Open Agency concept',
        'Explain the Open Agency concept I ask about in practical terms with one example.',
        'understand'
      ),
    ],
  },
  {
    matches: under('/observatory/builder'),
    surface: 'observatory.builder',
    title: 'Observatory Builder',
    description: 'Design the live run visualization used by Observatory.',
    allowedActions: ['observatory.inspect', 'observatory.preview'],
    suggestedPrompts: [
      prompt(
        'observatory-explain',
        'Explain this layout',
        'Explain how this Observatory layout represents live runs and agent activity.',
        'understand'
      ),
      prompt(
        'observatory-improve',
        'Improve the layout',
        'Suggest a clearer Observatory layout for the workflows and agents in this install.',
        'optimize'
      ),
      prompt(
        'observatory-validate',
        'Check layout clarity',
        'Check whether this layout makes status, failures, and human attention easy to understand.',
        'diagnose'
      ),
    ],
  },
  {
    matches: under('/assistant'),
    surface: 'assistant',
    title: 'Assistant',
    description: 'Ask the main agent for help, analysis, approvals, and workflow orchestration.',
    allowedActions: ['assistant.ask', 'assistant.review_approvals'],
  },
];

export function resolveAssistantRouteContext(pathname: string): AssistantRouteContext {
  const context = assistantRouteContexts.find((candidate) => candidate.matches(pathname));
  if (!context) {
    return {
      surface: 'unknown',
      title: null,
      description: 'Ask the main agent for help with the current Open Agency page.',
      allowedActions: ['assistant.ask'],
      suggestedPrompts: [
        prompt(
          'page-explain',
          'Explain this page',
          'Explain what I can do on this page and recommend the safest next step.',
          'understand'
        ),
      ],
    };
  }

  // Return fresh arrays so page-specific registrations cannot mutate the shared catalog.
  return {
    surface: context.surface,
    title: context.title,
    description: context.description,
    allowedActions: context.allowedActions ? [...context.allowedActions] : undefined,
    suggestedPrompts: context.suggestedPrompts
      ? context.suggestedPrompts.map((suggestion) => ({ ...suggestion }))
      : undefined,
  };
}
