'use client';

import { useMemo, useState, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRegisterAssistantPageContext } from '@/components/assistant/AssistantPageContext';
import { agentsApi } from '@/lib/api/backend/agents';
import { behaviorProfilesApi } from '@/lib/api/backend/behaviorProfiles';
import { conversationsApi } from '@/lib/api/backend/conversations';
import { personasApi } from '@/lib/api/backend/personas';
import { toolsApi } from '@/lib/api/backend/tools';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toolDisplayName } from '@/lib/tools/displayName';
import type { Agent, AgentConfig, BehaviorTuningProfile } from '@/types/agents';
import type { ToolDefinition } from '@/types/tools';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../library/shadcn/accordion';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import { DialogClose } from '../library/shadcn/dialog';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../library/shadcn/tooltip';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import AppState from '@/components/app-shell/AppState';
import { AppDialog } from '@/components/app-shell/AppOverlay';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import {
  FieldFeedback,
  FormField,
  FormFieldGroup,
  FormSection,
} from '@/components/app-shell/FormSection';
import PageHeader from '@/components/app-shell/PageHeader';
import DocumentIngestionControl from '@/components/memory-app/DocumentIngestionControl';
import UploadedDocumentsList from '@/components/memory-app/UploadedDocumentsList';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type {
  AgentImportHandoffSuggestion,
  AgentImportProposal,
  AgentImportToolSuggestion,
} from '@/types/agents';
import type { PersonaDefinition } from '@/types/personas';

interface ToolCategory {
  id: string;
  label: string;
  description: string;
  keywords: string[];
}

const toolCategories: ToolCategory[] = [
  {
    id: 'browser',
    label: 'Browser and Screenshots',
    description: 'Page control, visual inspection, screenshots, and browser extraction.',
    keywords: ['browser', 'screenshot', 'page', 'click', 'visual', 'extract', 'web', 'url'],
  },
  {
    id: 'system',
    label: 'System and Command',
    description: 'CLI commands, shell access, computer control, and runtime operations.',
    keywords: ['cli', 'command', 'computer', 'runtime', 'shell', 'terminal'],
  },
  {
    id: 'communication',
    label: 'Communication and Human Input',
    description: 'Human handoff, questions, notifications, and outbound messages.',
    keywords: [
      'ask human',
      'clarification',
      'email',
      'human',
      'message',
      'notification',
      'operator',
      'question',
      'slack',
    ],
  },
  {
    id: 'workflow',
    label: 'Workflows and Runs',
    description: 'Workflow definitions, executions, run state, and execution artifacts.',
    keywords: ['execution', 'run', 'workflow', 'task', 'approval'],
  },
  {
    id: 'memory',
    label: 'Memory and Knowledge',
    description: 'Memory storage, retrieval, search, embeddings, and knowledge lookup.',
    keywords: ['embedding', 'knowledge', 'memory', 'retrieval', 'search', 'vector'],
  },
  {
    id: 'files',
    label: 'Files and Documents',
    description: 'Document conversion, spreadsheets, uploads, and file artifacts.',
    keywords: [
      'artifact',
      'csv',
      'docx',
      'document',
      'excel',
      'file',
      'image',
      'json',
      'markdown',
      'pdf',
      'sheet',
      'word',
    ],
  },
  {
    id: 'other',
    label: 'Other Tools',
    description: 'Tools that do not match the primary operational groups.',
    keywords: [],
  },
];

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function agentConfigOrDefaults(agent: Agent): AgentConfig {
  const legacyAgent = agent as Agent & {
    instructions?: unknown;
    model_profile_id?: unknown;
    system_prompt?: unknown;
    tool_ids?: unknown;
    toolIds?: unknown;
    handoff_agent_ids?: unknown;
    handoffAgentIds?: unknown;
  };
  const config = agent.config;

  return {
    instructions:
      config?.instructions ??
      (typeof legacyAgent.instructions === 'string' ? legacyAgent.instructions : null),
    systemPrompt:
      config?.systemPrompt ??
      (typeof legacyAgent.system_prompt === 'string' ? legacyAgent.system_prompt : null),
    modelProfileId:
      config?.modelProfileId ??
      (typeof legacyAgent.model_profile_id === 'string' ? legacyAgent.model_profile_id : null),
    toolIds:
      config?.toolIds ??
      (stringArray(legacyAgent.tool_ids).length > 0
        ? stringArray(legacyAgent.tool_ids)
        : stringArray(legacyAgent.toolIds)),
    handoffAgentIds:
      config?.handoffAgentIds ??
      (stringArray(legacyAgent.handoff_agent_ids).length > 0
        ? stringArray(legacyAgent.handoff_agent_ids)
        : stringArray(legacyAgent.handoffAgentIds)),
    metadata: config?.metadata,
  };
}

function toolSearchText(tool: ToolDefinition) {
  return [
    tool.id,
    tool.name,
    tool.display_name,
    toolDisplayName(tool),
    tool.description,
    tool.tool_type,
    ...(tool.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
}

function categoryForTool(tool: ToolDefinition) {
  const searchText = toolSearchText(tool);
  const fallbackCategory = toolCategories[toolCategories.length - 1];
  let bestCategory = fallbackCategory;
  let bestScore = 0;

  toolCategories.forEach((category) => {
    if (category.id === fallbackCategory.id) {
      return;
    }

    const score = category.keywords.reduce(
      (total, keyword) => total + (searchText.includes(keyword) ? 1 : 0),
      0
    );

    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  });

  return bestCategory;
}

function personaSlugForAgent(agent: Agent) {
  const metadata = agentConfigOrDefaults(agent).metadata;
  const slug = metadata?.persona_slug;
  const generatedFromPersonaFactory = metadata?.generated_from_persona_factory === true;
  return typeof slug === 'string' && slug.trim()
    ? slug.trim()
    : generatedFromPersonaFactory
      ? agent.name
      : null;
}

function personaIdForAgent(agent: Agent) {
  const value = agentConfigOrDefaults(agent).metadata?.persona_id;
  return typeof value === 'string' ? value : '';
}

function isGeneratedPersonaAgent(agent: Agent) {
  return agentConfigOrDefaults(agent).metadata?.generated_from_persona_factory === true;
}

function agentCardTone(agent: Agent, isMainAgent: boolean) {
  if (isMainAgent) {
    return {
      accent: 'bg-linear-to-r from-success-500 via-primary-500 to-secondary-500',
      avatar: 'border-success-300 bg-white text-success-800 ring-4 ring-success-100',
      badge: 'border-success-300 bg-success-50 text-success-900',
      selected: 'border-success-400 ring-success-200/90',
    };
  }
  if (personaSlugForAgent(agent)) {
    return {
      accent: 'bg-secondary-500',
      avatar: 'border-secondary-200 bg-secondary-50 text-secondary-800',
      badge: 'border-secondary-200 bg-secondary-50 text-secondary-800',
      selected: 'border-secondary-300 ring-secondary-200/80',
    };
  }
  return {
    accent: 'bg-primary-500',
    avatar: 'border-primary-200 bg-primary-50 text-primary-800',
    badge: 'border-primary-200 bg-primary-50 text-primary-800',
    selected: 'border-primary-300 ring-primary-200/80',
  };
}

function sortToolsByAssignmentAndName(toolIds: string[]) {
  const selectedIds = new Set(toolIds);

  return (left: ToolDefinition, right: ToolDefinition) => {
    const leftSelected = selectedIds.has(left.id);
    const rightSelected = selectedIds.has(right.id);

    if (leftSelected !== rightSelected) {
      return leftSelected ? -1 : 1;
    }

    return toolDisplayName(left).localeCompare(toolDisplayName(right));
  };
}

function ToolAssignmentControls({
  disabled,
  onChange,
  toolIds,
  tools,
}: {
  disabled: boolean;
  onChange: (toolIds: string[]) => void;
  toolIds: string[];
  tools: ToolDefinition[];
}) {
  const allToolIds = tools.map((tool) => tool.id);
  const assignmentMode =
    toolIds.length === 0 ? 'none' : toolIds.length === allToolIds.length ? 'all' : 'selected';
  const selectedToolIds = new Set(toolIds);
  const groupedTools = toolCategories
    .map((category) => {
      const categoryTools = tools
        .filter((tool) => categoryForTool(tool).id === category.id)
        .sort(sortToolsByAssignmentAndName(toolIds));

      return {
        ...category,
        assignedCount: categoryTools.filter((tool) => selectedToolIds.has(tool.id)).length,
        tools: categoryTools,
      };
    })
    .filter((category) => category.tools.length > 0);
  const toggleTool = (toolId: string, checked: boolean) => {
    onChange(
      checked
        ? Array.from(new Set([...toolIds, toolId]))
        : toolIds.filter((value) => value !== toolId)
    );
  };
  const selectCategory = (categoryToolIds: string[]) => {
    onChange(Array.from(new Set([...toolIds, ...categoryToolIds])));
  };
  const clearCategory = (categoryToolIds: string[]) => {
    const categoryToolIdSet = new Set(categoryToolIds);
    onChange(toolIds.filter((toolId) => !categoryToolIdSet.has(toolId)));
  };

  if (tools.length === 0) {
    return <p className="text-xs text-neutral-500">No canonical tools available.</p>;
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-slate-950/72">
      <Accordion type="single" collapsible>
        <AccordionItem value="tool-assignment" className="border-0 px-4">
          <AccordionTrigger className="gap-3 py-3 text-left hover:no-underline">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                  Tool assignment
                </p>
                <Badge variant="secondary">
                  {toolIds.length} / {tools.length}
                </Badge>
              </div>
              <p className="mt-1 text-xs font-normal leading-5 text-neutral-500 dark:text-slate-400">
                Tools are optional. Open this section to choose individual tools or whole groups.
              </p>
            </div>
          </AccordionTrigger>

          <AccordionContent className="space-y-4 pb-4 pt-0">
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant={assignmentMode === 'none' ? 'default' : 'outline'}
                disabled={disabled}
                onClick={() => onChange([])}
              >
                No tools
              </Button>
              <Button
                type="button"
                variant={assignmentMode === 'selected' ? 'default' : 'outline'}
                disabled={disabled}
                onClick={() => onChange(toolIds)}
              >
                Selected tools
              </Button>
              <Button
                type="button"
                variant={assignmentMode === 'all' ? 'default' : 'outline'}
                disabled={disabled}
                onClick={() => onChange(allToolIds)}
              >
                All tools
              </Button>
            </div>

            <Accordion type="multiple" className="space-y-3">
              {groupedTools.map((category) => (
                <AccordionItem
                  key={category.id}
                  value={category.id}
                  className="rounded-lg border border-neutral-200 bg-white px-3 dark:border-white/10 dark:bg-slate-950/78"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <AccordionTrigger className="min-w-64 flex-1 justify-start gap-2 py-3 text-left hover:no-underline">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                            {category.label}
                          </p>
                          <Badge variant="secondary">
                            {category.assignedCount} / {category.tools.length}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs font-normal leading-5 text-neutral-500 dark:text-slate-400">
                          {category.description}
                        </p>
                      </div>
                    </AccordionTrigger>
                    <div className="flex flex-wrap gap-2 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || category.assignedCount === category.tools.length}
                        onClick={() => selectCategory(category.tools.map((tool) => tool.id))}
                      >
                        Select group
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || category.assignedCount === 0}
                        onClick={() => clearCategory(category.tools.map((tool) => tool.id))}
                      >
                        Clear group
                      </Button>
                    </div>
                  </div>
                  <AccordionContent className="pb-3 pt-0">
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {category.tools.map((tool) => (
                        <label
                          key={tool.id}
                          className="flex min-w-0 items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-white/10 dark:bg-white/4 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={selectedToolIds.has(tool.id)}
                            onChange={(event) => toggleTool(tool.id, event.target.checked)}
                            disabled={disabled}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-neutral-900 dark:text-slate-100">
                              {toolDisplayName(tool)}
                            </span>
                            <span className="line-clamp-3 block text-xs leading-5 text-neutral-500 dark:text-slate-400">
                              {tool.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

function AgentInstructionPreview({ instructions }: { instructions: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const normalizedInstructions = instructions.trim();
  const displayInstructions = normalizedInstructions || 'No instructions configured.';
  const lineCount = displayInstructions.split(/\r\n|\r|\n/).length;
  const isLongPrompt = displayInstructions.length > 360 || lineCount > 4;

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-primary-700" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
            Prompt
          </p>
        </div>
        <span
          className="shrink-0 text-xs text-neutral-500 dark:text-slate-400"
          title={`${displayInstructions.length.toLocaleString()} chars`}
        >
          {formatPromptLength(displayInstructions.length)}
        </span>
      </div>
      <div className="relative">
        <p
          className={`whitespace-pre-wrap wrap-break-word px-3 py-3 text-sm leading-6 text-neutral-700 dark:text-slate-300 ${
            isLongPrompt && !isExpanded ? 'max-h-28 overflow-hidden' : ''
          }`}
        >
          {displayInstructions}
        </p>
        {isLongPrompt && !isExpanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-neutral-50 to-transparent dark:from-[#09111f]" />
        ) : null}
      </div>
      {isLongPrompt ? (
        <div className="border-t border-neutral-200 px-3 py-2 dark:border-white/10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-xs font-semibold text-primary-700 hover:bg-transparent hover:text-primary-800"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isExpanded ? 'Collapse prompt' : 'Show full prompt'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatPromptLength(characterCount: number) {
  if (characterCount < 1000) {
    return `${characterCount} chars`;
  }

  return `${(characterCount / 1000).toFixed(1)}k chars`;
}

function AssignedToolsSummary({
  assignedTools,
  toolCount,
  tools,
}: {
  assignedTools: Array<{ id: string; label: string }>;
  toolCount: number;
  tools: ToolDefinition[];
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
          Assigned tools
        </p>
        <span className="text-xs text-neutral-500 dark:text-slate-400">
          {toolCount} / {tools.length}
        </span>
      </div>
      {assignedTools.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {assignedTools.map((tool) => (
            <Badge key={tool.id} variant="outline" title={tool.id}>
              {tool.label}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-500 dark:text-slate-400">No tools assigned.</p>
      )}
      {tools.length === 0 ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          No assignable tools loaded from the backend.
        </p>
      ) : null}
    </div>
  );
}

function suggestionToolLabel(suggestion: AgentImportToolSuggestion, tools: ToolDefinition[]) {
  const tool = tools.find((candidate) => candidate.id === suggestion.tool_id);
  return tool ? toolDisplayName(tool) : suggestion.tool_id;
}

function suggestionHandoffLabel(suggestion: AgentImportHandoffSuggestion, agents: Agent[]) {
  const matchedId = suggestion.matched_agent_id ?? suggestion.agent_id;
  const agent = agents.find((candidate) => candidate.id === matchedId);
  return agent ? agent.name : suggestion.agent_id;
}

const highRiskImportWarningCodes = new Set([
  'prompt_injection_detected',
  'secret_like_value_detected',
  'shell_snippet_detected',
  'tool_grant_instruction_detected',
]);

function proposalAgentKind(proposal: AgentImportProposal) {
  const value = proposal.agent.metadata?.agent_kind;
  return typeof value === 'string' ? value : null;
}

function proposalRequiresIndividualReview(proposal: AgentImportProposal) {
  return (
    proposalAgentKind(proposal) === 'orchestrator' ||
    proposal.suggested_tool_ids.some((item) => item.high_risk) ||
    proposal.warnings.some(
      (item) => item.severity === 'error' || highRiskImportWarningCodes.has(item.code)
    )
  );
}

function ImportAgentCard({
  agents,
  onImported,
  profiles,
  tools,
}: {
  agents: Agent[];
  onImported: () => Promise<void> | void;
  profiles: BehaviorTuningProfile[];
  tools: ToolDefinition[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<'paste' | 'file' | 'url'>('paste');
  const [markdownText, setMarkdownText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [proposals, setProposals] = useState<AgentImportProposal[]>([]);
  const [selectedProposalIndex, setSelectedProposalIndex] = useState(0);
  const [batchErrors, setBatchErrors] = useState<Array<{ code: string; message: string }>>([]);
  const [conflictStrategy, setConflictStrategy] = useState<
    'create_only' | 'update_existing' | 'duplicate_as_new'
  >('create_only');
  const [modelProfileId, setModelProfileId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [approvedToolIds, setApprovedToolIds] = useState<string[]>([]);
  const [approvedHandoffIds, setApprovedHandoffIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const proposal = proposals[selectedProposalIndex] ?? null;
  const safeBatchProposals = proposals.filter((item) => !proposalRequiresIndividualReview(item));
  const riskyBatchProposals = proposals.filter(proposalRequiresIndividualReview);

  const reset = () => {
    setSourceMode('paste');
    setMarkdownText('');
    setSourceUrl('');
    setFiles([]);
    setProposals([]);
    setSelectedProposalIndex(0);
    setBatchErrors([]);
    setConflictStrategy('create_only');
    setModelProfileId('');
    setEnabled(false);
    setApprovedToolIds([]);
    setApprovedHandoffIds([]);
    setError(null);
  };

  const previewDisabled =
    isPending ||
    (sourceMode === 'paste' && !markdownText.trim()) ||
    (sourceMode === 'file' && files.length === 0) ||
    (sourceMode === 'url' && !sourceUrl.trim());
  const importIsDirty = Boolean(
    markdownText.trim() ||
    sourceUrl.trim() ||
    files.length ||
    proposals.length ||
    batchErrors.length ||
    conflictStrategy !== 'create_only' ||
    modelProfileId ||
    enabled ||
    approvedToolIds.length ||
    approvedHandoffIds.length
  );

  const applyProposalDefaults = (nextProposal: AgentImportProposal | null) => {
    setConflictStrategy(nextProposal?.conflicts.length ? 'update_existing' : 'create_only');
    setModelProfileId(nextProposal?.agent.model_profile_id ?? '');
    setEnabled(false);
    setApprovedToolIds([]);
    setApprovedHandoffIds([]);
  };

  const handlePreview = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const next =
            sourceMode === 'file'
              ? await agentsApi.previewAgentImportFiles(files)
              : {
                  proposals: [
                    await agentsApi.previewAgentImport({
                      markdownText: sourceMode === 'paste' ? markdownText : undefined,
                      sourceUrl: sourceMode === 'url' ? sourceUrl.trim() : undefined,
                    }),
                  ],
                  errors: [],
                };
          setProposals(next.proposals);
          setBatchErrors(next.errors);
          setSelectedProposalIndex(0);
          applyProposalDefaults(next.proposals[0] ?? null);
        } catch (previewError) {
          setError(
            previewError instanceof Error ? previewError.message : 'Failed to preview agent import.'
          );
        }
      })();
    });
  };

  const selectProposal = (index: number) => {
    setSelectedProposalIndex(index);
    applyProposalDefaults(proposals[index] ?? null);
  };

  const handleCommit = () => {
    if (!proposal) {
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const result = await agentsApi.commitAgentImport({
            proposal,
            conflictStrategy,
            approvedToolIds,
            approvedHandoffAgentIds: approvedHandoffIds,
            modelProfileId,
            enabled,
          });
          await onImported();
          toast.success(`Agent ${result.status}.`, { position: 'top-right' });
          reset();
          setIsOpen(false);
        } catch (commitError) {
          setError(commitError instanceof Error ? commitError.message : 'Failed to import agent.');
        }
      })();
    });
  };

  const handleCommitAll = () => {
    if (safeBatchProposals.length === 0) {
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const result = await agentsApi.commitAgentImportBatch(
            safeBatchProposals.map((item) => ({
              proposal: item,
              conflictStrategy: item.conflicts.length > 0 ? 'update_existing' : 'create_only',
              approvedToolIds: [],
              approvedHandoffAgentIds: [],
              modelProfileId: item.agent.model_profile_id ?? null,
              enabled: false,
            }))
          );
          const skippedRiskyImports = riskyBatchProposals.map((item) => ({
            code: 'requires_individual_review',
            message: `${item.agent.name} requires individual review before commit.`,
          }));
          await onImported();
          toast.success(
            `Imported ${result.results.length} agent${result.results.length === 1 ? '' : 's'}.`,
            { position: 'top-right' }
          );
          if (result.errors.length > 0 || skippedRiskyImports.length > 0) {
            setBatchErrors([...skippedRiskyImports, ...result.errors]);
            setError(
              `${result.errors.length + skippedRiskyImports.length} import${
                result.errors.length + skippedRiskyImports.length === 1 ? '' : 's'
              } need review or failed.`
            );
            return;
          }
          reset();
          setIsOpen(false);
        } catch (commitError) {
          setError(commitError instanceof Error ? commitError.message : 'Failed to import agents.');
        }
      })();
    });
  };

  const toggleId = (ids: string[], id: string, checked: boolean) =>
    checked ? Array.from(new Set([...ids, id])) : ids.filter((value) => value !== id);

  return (
    <Card className="min-w-0 overflow-hidden border-primary-100 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="h-1 bg-primary-400" />
      <CardHeader className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-800 dark:border-cyan-400/20 dark:bg-white/10 dark:text-cyan-100">
              <Upload className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-base">Import Markdown agent</CardTitle>
              <CardDescription className="hidden sm:block">
                Preview agent Markdown before creating canonical definitions.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            aria-label="Import agent"
            onClick={() => {
              setError(null);
              setIsOpen(true);
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            <span className="sm:hidden">Import</span>
            <span className="hidden sm:inline">Import agent</span>
          </Button>
        </div>
      </CardHeader>
      <AppDialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open && !isPending) {
            reset();
          }
        }}
        dirty={importIsDirty}
        busy={isPending}
        onDiscard={reset}
        size="xl"
        icon={<Upload className="size-4" aria-hidden="true" />}
        title="Import Markdown agent"
        description="Review parsed instructions, conflicts, tools, and handoffs before committing the agent definition."
        bodyClassName="flex flex-col gap-5"
        footer={
          <>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            {proposals.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending || safeBatchProposals.length === 0}
                onClick={handleCommitAll}
              >
                {isPending
                  ? 'Importing batch...'
                  : riskyBatchProposals.length > 0
                    ? 'Commit safe imports'
                    : 'Commit all without tools'}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="brand"
              disabled={isPending || !proposal}
              onClick={handleCommit}
            >
              {isPending && proposal ? 'Importing...' : 'Commit import'}
            </Button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
          <FormSection
            title="Import source"
            description="Paste Markdown, upload one or more files, or load a trusted raw URL."
            icon={<Upload className="size-4" aria-hidden="true" />}
            contentClassName="flex flex-col gap-4"
          >
            <div className="grid gap-2 sm:grid-cols-3">
              {(['paste', 'file', 'url'] as const).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={sourceMode === mode ? 'brand' : 'outline'}
                  disabled={isPending}
                  onClick={() => {
                    setSourceMode(mode);
                    setProposals([]);
                    setBatchErrors([]);
                    setSelectedProposalIndex(0);
                    setError(null);
                  }}
                >
                  {mode === 'paste' ? 'Paste' : mode === 'file' ? 'Upload' : 'URL'}
                </Button>
              ))}
            </div>

            {sourceMode === 'paste' ? (
              <FormField label="Markdown" htmlFor="agent-import-markdown" required>
                <Textarea
                  id="agent-import-markdown"
                  required
                  value={markdownText}
                  onChange={(event) => {
                    setMarkdownText(event.target.value);
                    setProposals([]);
                    setBatchErrors([]);
                  }}
                  disabled={isPending}
                  className="min-h-72"
                />
              </FormField>
            ) : null}

            {sourceMode === 'file' ? (
              <FormField
                label="Markdown files"
                htmlFor="agent-import-file"
                description={
                  files.length > 0
                    ? `${files.length} file${files.length === 1 ? '' : 's'} selected.`
                    : 'Select one or more Markdown files.'
                }
                required
              >
                <Input
                  id="agent-import-file"
                  type="file"
                  required
                  multiple
                  accept=".md,.markdown,text/markdown,text/plain"
                  disabled={isPending}
                  onChange={(event) => {
                    setFiles(Array.from(event.target.files ?? []));
                    setProposals([]);
                    setBatchErrors([]);
                  }}
                  aria-describedby="agent-import-file-feedback"
                />
              </FormField>
            ) : null}

            {sourceMode === 'url' ? (
              <FormField
                label="Source URL"
                htmlFor="agent-import-url"
                description="Use a direct, trusted URL that returns Markdown or plain text."
                required
              >
                <Input
                  id="agent-import-url"
                  required
                  value={sourceUrl}
                  onChange={(event) => {
                    setSourceUrl(event.target.value);
                    setProposals([]);
                    setBatchErrors([]);
                  }}
                  disabled={isPending}
                  placeholder="https://raw.githubusercontent.com/..."
                  aria-describedby="agent-import-url-feedback"
                />
              </FormField>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" disabled={previewDisabled} onClick={handlePreview}>
                {isPending && !proposal ? 'Previewing...' : 'Preview import'}
              </Button>
              {proposal ? (
                <Button type="button" variant="brand" disabled={isPending} onClick={handleCommit}>
                  <Save className="mr-2 h-4 w-4" />
                  {isPending ? 'Importing...' : 'Import reviewed agent'}
                </Button>
              ) : null}
            </div>

            <FieldFeedback error={error} />
            {batchErrors.length > 0 ? (
              <div className="space-y-1 rounded-md border border-red-200 bg-red-50 p-3">
                {batchErrors.map((item) => (
                  <p key={`${item.code}-${item.message}`} className="text-xs text-red-700">
                    {item.message}
                  </p>
                ))}
              </div>
            ) : null}
          </FormSection>

          <div className="space-y-4">
            {proposals.length > 1 ? (
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  Batch preview
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {proposals.map((item, index) => (
                    <Button
                      key={`${item.source.sha256}-${item.agent.id}`}
                      type="button"
                      variant={index === selectedProposalIndex ? 'default' : 'outline'}
                      size="sm"
                      disabled={isPending}
                      onClick={() => selectProposal(index)}
                    >
                      {item.agent.name}
                      {proposalRequiresIndividualReview(item) ? (
                        <AlertTriangle className="ml-2 h-3.5 w-3.5" />
                      ) : null}
                    </Button>
                  ))}
                </div>
                {riskyBatchProposals.length > 0 ? (
                  <p className="mt-3 text-xs text-amber-700">
                    {riskyBatchProposals.length} import
                    {riskyBatchProposals.length === 1 ? '' : 's'} require individual review.
                  </p>
                ) : null}
              </div>
            ) : null}

            {proposal ? (
              <>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        Preview
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-neutral-900">
                        {proposal.agent.name}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        {proposal.agent.description ||
                          proposal.agent.role ||
                          'No description parsed.'}
                      </p>
                    </div>
                    <Badge variant="secondary">{proposal.detected_format}</Badge>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-neutral-500">ID</dt>
                      <dd className="mt-1 break-all text-neutral-800">{proposal.agent.id}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-neutral-500">
                        Source
                      </dt>
                      <dd className="mt-1 break-all text-neutral-800">
                        {proposal.source.filename ||
                          proposal.source.url ||
                          proposal.source.source_type}
                      </dd>
                    </div>
                  </dl>
                </div>

                {proposal.warnings.length > 0 || proposal.conflicts.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                      <AlertTriangle className="h-4 w-4" />
                      Review required
                    </div>
                    {[
                      ...proposal.conflicts.map((item) => item.message),
                      ...proposal.warnings.map((item) => item.message),
                    ].map((message) => (
                      <p key={message} className="text-xs leading-5 text-amber-800">
                        {message}
                      </p>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="agent-import-conflict-strategy">Commit mode</Label>
                    <select
                      id="agent-import-conflict-strategy"
                      value={conflictStrategy}
                      onChange={(event) =>
                        setConflictStrategy(
                          event.target.value as
                            | 'create_only'
                            | 'update_existing'
                            | 'duplicate_as_new'
                        )
                      }
                      disabled={isPending}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="create_only">Create only</option>
                      <option value="update_existing">Update existing</option>
                      <option value="duplicate_as_new">Duplicate as new</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="agent-import-model-profile">Model profile</Label>
                    <select
                      id="agent-import-model-profile"
                      value={modelProfileId}
                      onChange={(event) => setModelProfileId(event.target.value)}
                      disabled={isPending}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">No profile</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setEnabled(event.target.checked)}
                    disabled={isPending}
                  />
                  Enable after import
                </label>

                <AgentInstructionPreview instructions={proposal.agent.instructions ?? ''} />

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      Suggested tools
                    </p>
                    <div className="mt-3 space-y-2">
                      {proposal.suggested_tool_ids.length > 0 ? (
                        proposal.suggested_tool_ids.map((suggestion) => (
                          <label
                            key={suggestion.tool_id}
                            className="flex items-start gap-2 text-sm text-neutral-700"
                          >
                            <input
                              type="checkbox"
                              checked={approvedToolIds.includes(suggestion.tool_id)}
                              disabled={isPending || !suggestion.exists}
                              onChange={(event) =>
                                setApprovedToolIds((current) =>
                                  toggleId(current, suggestion.tool_id, event.target.checked)
                                )
                              }
                              className="mt-1"
                            />
                            <span>
                              <span className="font-medium text-neutral-900">
                                {suggestionToolLabel(suggestion, tools)}
                              </span>
                              <span className="block text-xs leading-5 text-neutral-500">
                                {suggestion.reason}
                              </span>
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="text-xs text-neutral-500">No tool suggestions.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      Suggested handoffs
                    </p>
                    <div className="mt-3 space-y-2">
                      {proposal.suggested_handoff_agent_ids.length > 0 ? (
                        proposal.suggested_handoff_agent_ids.map((suggestion) => {
                          const handoffId = suggestion.matched_agent_id ?? suggestion.agent_id;
                          return (
                            <label
                              key={`${suggestion.agent_id}-${handoffId}`}
                              className="flex items-start gap-2 text-sm text-neutral-700"
                            >
                              <input
                                type="checkbox"
                                checked={approvedHandoffIds.includes(handoffId)}
                                disabled={isPending || !suggestion.exists}
                                onChange={(event) =>
                                  setApprovedHandoffIds((current) =>
                                    toggleId(current, handoffId, event.target.checked)
                                  )
                                }
                                className="mt-1"
                              />
                              <span>
                                <span className="font-medium text-neutral-900">
                                  {suggestionHandoffLabel(suggestion, agents)}
                                </span>
                                <span className="block text-xs leading-5 text-neutral-500">
                                  {suggestion.reason}
                                </span>
                              </span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="text-xs text-neutral-500">No handoff suggestions.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-600">
                Preview a Markdown agent to review its Open Agency mapping.
              </div>
            )}
          </div>
        </div>
      </AppDialog>
    </Card>
  );
}

function AgentCard({
  agent,
  isMainAgent,
  isSelected,
  mainAgent,
  onSelect,
  onRefresh,
  personas,
  profiles,
  tools,
}: {
  agent: Agent;
  isMainAgent: boolean;
  isSelected: boolean;
  mainAgent: {
    name?: string | null;
    description?: string | null;
    default_model_profile_id?: string | null;
  } | null;
  onSelect: () => void;
  onRefresh: () => void | Promise<void>;
  personas: PersonaDefinition[];
  profiles: BehaviorTuningProfile[];
  tools: ToolDefinition[];
}) {
  const config = agentConfigOrDefaults(agent);
  const toolCount = config.toolIds.length;
  const handoffCount = config.handoffAgentIds.length;
  const personaSlug = personaSlugForAgent(agent);
  const generatedPersonaAgent = isGeneratedPersonaAgent(agent);
  const instructionSummary = config.instructions ?? '';
  const assignedTools = config.toolIds.map((toolId) => {
    const tool = tools.find((candidate) => candidate.id === toolId);
    return {
      id: toolId,
      label: tool ? toolDisplayName(tool) : toolId,
    };
  });
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(mainAgent?.name ?? agent.name);
  const [description, setDescription] = useState(agent.description ?? '');
  const [instructions, setInstructions] = useState(config.instructions ?? '');
  const [role, setRole] = useState(mainAgent?.description ?? agent.role ?? '');
  const [modelProfileId, setModelProfileId] = useState(config.modelProfileId ?? '');
  const [personaId, setPersonaId] = useState(personaIdForAgent(agent));
  const [toolIds, setToolIds] = useState<string[]>(config.toolIds);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const editDirty =
    name !== (mainAgent?.name ?? agent.name) ||
    description !== (agent.description ?? '') ||
    instructions !== (config.instructions ?? '') ||
    role !== (mainAgent?.description ?? agent.role ?? '') ||
    modelProfileId !== (config.modelProfileId ?? '') ||
    personaId !== personaIdForAgent(agent) ||
    JSON.stringify(toolIds) !== JSON.stringify(config.toolIds);
  const displayName = isMainAgent
    ? name.trim() || mainAgent?.name?.trim() || agent.name
    : agent.name;
  const tone = agentCardTone(agent, isMainAgent);
  const cardDescription = isMainAgent
    ? role.trim() ||
      mainAgent?.description?.trim() ||
      agent.role ||
      agent.description ||
      'No role or description configured.'
    : agent.role || agent.description || 'No role or description configured.';

  const resetForm = () => {
    setName(mainAgent?.name ?? agent.name);
    setDescription(agent.description ?? '');
    setInstructions(config.instructions ?? '');
    setRole(mainAgent?.description ?? agent.role ?? '');
    setModelProfileId(config.modelProfileId ?? '');
    setPersonaId(personaIdForAgent(agent));
    setToolIds(config.toolIds);
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    const normalizedModelProfileId = modelProfileId.trim();
    if (isMainAgent && !normalizedModelProfileId) {
      setError('The active main agent must use an LLM model preset.');
      return;
    }
    startTransition(() => {
      void (async () => {
        try {
          const normalizedName = name.trim();
          const normalizedRole = role.trim();
          const selectedPersona = personas.find((persona) => persona.id === personaId);
          const metadata = { ...(config.metadata ?? {}) } as Record<string, unknown>;

          if (selectedPersona) {
            metadata.persona_id = selectedPersona.id;
            metadata.persona_slug = selectedPersona.slug;
            metadata.persona_name = selectedPersona.name;
            metadata.persona_status = selectedPersona.status;
          } else if (!personaId) {
            delete metadata.persona_id;
            delete metadata.persona_slug;
            delete metadata.persona_name;
            delete metadata.persona_status;
          }

          if (isMainAgent) {
            const mainAgentPatch: Record<string, unknown> = {};

            if (!normalizedName) {
              setError('The active main agent must have an assistant display name.');
              return;
            }

            if (normalizedName !== (mainAgent?.name?.trim() ?? '')) {
              mainAgentPatch.name = normalizedName;
            }
            if (normalizedRole !== (mainAgent?.description?.trim() ?? '')) {
              mainAgentPatch.description = normalizedRole || null;
            }
            if (
              normalizedModelProfileId &&
              normalizedModelProfileId !== (mainAgent?.default_model_profile_id ?? '')
            ) {
              mainAgentPatch.default_model_profile_id = normalizedModelProfileId;
            }

            if (Object.keys(mainAgentPatch).length > 0) {
              await conversationsApi.updateMainAgent(mainAgentPatch);
            }
          }
          await agentsApi.updateAgent(agent.id, {
            name: normalizedName,
            description: description.trim() || null,
            instructions: instructions.trim(),
            role: normalizedRole || null,
            model_profile_id: normalizedModelProfileId || null,
            tool_ids: toolIds,
            metadata,
          });
          await onRefresh();
          toast.success('Agent updated.', { position: 'top-right' });
          setIsEditing(false);
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Failed to update agent.');
        }
      })();
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await agentsApi.deleteAgent(agent.id);
          await onRefresh();
          toast.success('Agent deleted.', { position: 'top-right' });
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete agent.');
        }
      })();
    });
  };

  return (
    <>
      <Card
        role="group"
        aria-label={`${displayName} agent`}
        tabIndex={0}
        onClick={onSelect}
        onFocus={onSelect}
        className={cn(
          'group relative min-w-0 overflow-hidden border-neutral-200 bg-white outline-none transition hover:border-primary-200 hover:shadow-md hover:shadow-primary/10 focus:ring-2 focus:ring-primary/20 lg:grid lg:grid-cols-[minmax(17rem,0.75fr)_minmax(0,1.6fr)] dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/20 dark:hover:shadow-cyan-950/30',
          isMainAgent &&
            'border-success-300 bg-linear-to-br from-success-50 via-white to-primary-50 shadow-md shadow-success-200/50 hover:border-success-400 hover:shadow-lg hover:shadow-success-200/70 dark:border-emerald-400/20 dark:bg-linear-to-br dark:from-emerald-950/30 dark:via-slate-950 dark:to-cyan-950/30 dark:shadow-emerald-950/30',
          isSelected && 'ring-2',
          isSelected && tone.selected
        )}
      >
        <span className={cn('absolute inset-x-0 top-0 h-1', tone.accent)} />
        <CardHeader className="space-y-3 border-b border-neutral-200 lg:border-r lg:border-b-0 dark:border-white/10">
          <div className="flex min-w-0 gap-3">
            <span
              className={cn(
                'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border shadow-sm',
                tone.avatar
              )}
            >
              {isMainAgent ? <Sparkles className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            </span>
            <div className="min-w-0 space-y-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg leading-6">{displayName}</CardTitle>
                  {isMainAgent ? (
                    <Badge
                      variant="successful"
                      className="border-success-300 bg-white/80 dark:border-emerald-400/20 dark:bg-slate-950/80"
                    >
                      Main orchestrator
                    </Badge>
                  ) : null}
                  {personaSlug ? (
                    <Badge variant="outline" className={tone.badge}>
                      Persona @{personaSlug}
                    </Badge>
                  ) : null}
                  {generatedPersonaAgent ? (
                    <Badge variant="secondary">Managed persona agent</Badge>
                  ) : null}
                </div>
                <CardDescription className="mt-1 line-clamp-2">{cardDescription}</CardDescription>
              </div>
              <Badge
                variant={config.modelProfileId ? 'secondary' : 'outline'}
                className={cn(
                  'max-w-full shrink-0 whitespace-normal text-left',
                  !config.modelProfileId && 'border-warning-200 bg-warning-50 text-warning-900'
                )}
              >
                {profiles.find((profile) => profile.id === config.modelProfileId)?.name ||
                  config.modelProfileId ||
                  'No profile'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 py-5 text-sm text-neutral-600 sm:pt-5 dark:text-slate-300">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={
                toolCount
                  ? 'border-primary-200 bg-primary-50 text-primary-800'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600'
              }
            >
              {toolCount} assigned tool{toolCount === 1 ? '' : 's'}
            </Badge>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    aria-label={`${handoffCount} configured agent handoff${handoffCount === 1 ? '' : 's'}`}
                    className="inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-primary/25"
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1.5',
                        handoffCount
                          ? 'border-secondary-200 bg-secondary-50 text-secondary-800'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-600'
                      )}
                    >
                      {handoffCount} handoff{handoffCount === 1 ? '' : 's'}
                      <HelpCircle className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-72 text-xs leading-5">
                  Handoffs are configured target agents this agent can delegate work to. This count
                  is configuration, not runtime history.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {generatedPersonaAgent ? (
            <div className="rounded-md border border-secondary-200 bg-secondary-50/80 p-3 text-xs leading-5 text-secondary-900">
              Generated from Persona Factory. Publish a new persona version to change persona
              behavior, then refresh workflow snapshots that should use the newer version.
            </div>
          ) : null}
          <AgentInstructionPreview instructions={instructionSummary} />
          <Accordion
            type="single"
            collapsible
            className="rounded-lg border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/3"
          >
            <AccordionItem value="agent-details" className="border-0">
              <AccordionTrigger className="min-h-11 px-3 py-2.5 text-sm font-medium hover:no-underline">
                Tools, documents, and editing
              </AccordionTrigger>
              <AccordionContent
                forceMount
                contentClassName="data-[state=closed]:hidden"
                className="space-y-3 border-t border-neutral-200 px-3 pt-3 dark:border-white/10"
              >
                <AssignedToolsSummary
                  assignedTools={assignedTools}
                  toolCount={toolCount}
                  tools={tools}
                />
                <UploadedDocumentsList
                  scope="user"
                  agentId={agent.id}
                  tagFilter={`agent:${agent.id}`}
                  title="Agent documents"
                  description="Files currently attached to this agent's retrieval context."
                  emptyMessage="No documents attached."
                  limit={3}
                  showActions={false}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onSelect();
              resetForm();
              setIsEditing(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit agent
          </Button>
        </CardContent>
      </Card>

      <AppDialog
        open={isEditing}
        onOpenChange={setIsEditing}
        onDiscard={resetForm}
        dirty={editDirty}
        busy={isPending}
        size="xl"
        icon={<Pencil className="size-4" aria-hidden="true" />}
        title={`Edit ${displayName}`}
        description="Update the agent identity and instructions first. Tools and documents remain available as supporting context."
        bodyClassName="space-y-4"
        footer={
          <>
            {!isMainAgent ? (
              <ConfirmActionDialog
                trigger={
                  <Button type="button" variant="outline" disabled={isPending}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete agent
                  </Button>
                }
                title={`Delete ${displayName}?`}
                description="This permanently removes the agent definition. Workflows that reference it may require another agent before they can run."
                cancelLabel="Keep agent"
                confirmLabel="Delete agent"
                pendingLabel="Deleting..."
                pending={isPending}
                destructive
                onConfirm={handleDelete}
              />
            ) : (
              <span className="mr-auto text-xs text-(--agency-shell-muted)">
                The main agent cannot be deleted here.
              </span>
            )}
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="brand"
              disabled={isPending || !name.trim() || !instructions.trim()}
              onClick={handleSave}
            >
              <Save className="mr-2 h-4 w-4" />
              {isPending ? 'Saving...' : 'Save agent'}
            </Button>
          </>
        }
      >
        <FormSection
          title="Agent definition"
          description="Give the agent a recognizable purpose and choose the model and persona it should use."
          icon={<Bot className="size-4" aria-hidden="true" />}
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
            <div className="flex flex-col gap-4">
              <FormField label="Name" htmlFor={`${agent.id}-name`} required>
                <Input
                  id={`${agent.id}-name`}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isPending}
                />
              </FormField>
              <FormField label="Description" htmlFor={`${agent.id}-description`} optional>
                <Input
                  id={`${agent.id}-description`}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isPending}
                />
              </FormField>
              <FormField label="Role" htmlFor={`${agent.id}-role`} optional>
                <Input
                  id={`${agent.id}-role`}
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  disabled={isPending}
                />
              </FormField>
              <FormField label="Model profile" htmlFor={`${agent.id}-model-profile`} optional>
                <select
                  id={`${agent.id}-model-profile`}
                  value={modelProfileId}
                  onChange={(event) => setModelProfileId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {!isMainAgent ? <option value="">No profile</option> : null}
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Persona"
                htmlFor={`${agent.id}-persona`}
                description={
                  generatedPersonaAgent
                    ? 'Managed in Persona. Refresh workflows after publishing a newer persona version.'
                    : 'Binding a persona adds reusable identity and expertise.'
                }
                optional={!generatedPersonaAgent}
                disabled={generatedPersonaAgent}
              >
                <select
                  id={`${agent.id}-persona`}
                  value={personaId}
                  onChange={(event) => setPersonaId(event.target.value)}
                  disabled={isPending || generatedPersonaAgent}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {personaId && !personas.some((persona) => persona.id === personaId) ? (
                    <option value={personaId}>
                      {personaSlug ? `Persona @${personaSlug}` : 'Linked persona'}
                    </option>
                  ) : null}
                  {!generatedPersonaAgent ? <option value="">No persona</option> : null}
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name} (@{persona.slug})
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Instructions"
                htmlFor={`${agent.id}-instructions`}
                description="Write the durable behavior this agent should follow in every workflow."
                required
              >
                <Textarea
                  id={`${agent.id}-instructions`}
                  required
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  disabled={isPending}
                  className="min-h-48"
                />
              </FormField>
            </div>

            <div className="space-y-3 rounded-xl border border-transparent dark:border-sky-300/12 dark:bg-[linear-gradient(180deg,rgba(15,29,44,0.92),rgba(9,21,35,0.94))] dark:p-3">
              <DocumentIngestionControl
                frame="inline"
                title="Agent documents"
                description="Upload retrieval material for this agent."
                scope="user"
                lockedScope
                lockedAgent
                purpose="agent"
                agentId={agent.id}
                agents={[{ id: agent.id, label: displayName }]}
                defaultTags={['agent-rag', `agent:${agent.id}`]}
              />
              <UploadedDocumentsList
                scope="user"
                agentId={agent.id}
                tagFilter={`agent:${agent.id}`}
                title="Attached documents"
                description="Files currently attached to this agent's retrieval context."
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Tool access"
          description="Optional capabilities this agent may call while it works."
          icon={<Sparkles className="size-4" aria-hidden="true" />}
          advanced
        >
          <ToolAssignmentControls
            disabled={isPending}
            onChange={setToolIds}
            toolIds={toolIds}
            tools={tools}
          />
        </FormSection>

        <FieldFeedback error={error} />
      </AppDialog>
    </>
  );
}

function CreateAgentCard({
  onCreated,
  profiles,
  tools,
}: {
  onCreated: () => Promise<void> | void;
  profiles: BehaviorTuningProfile[];
  tools: ToolDefinition[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [role, setRole] = useState('');
  const [modelProfileId, setModelProfileId] = useState('');
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [touched, setTouched] = useState<Set<'name' | 'instructions'>>(new Set());
  const createDirty = Boolean(
    name || description || instructions || role || modelProfileId || toolIds.length
  );

  const reset = () => {
    setName('');
    setDescription('');
    setInstructions('');
    setRole('');
    setModelProfileId('');
    setToolIds([]);
    setError(null);
    setTouched(new Set());
  };
  const nameError = touched.has('name') && !name.trim() ? 'Enter an agent name.' : null;
  const instructionsError =
    touched.has('instructions') && !instructions.trim()
      ? 'Describe the durable behavior this agent should follow.'
      : null;

  const handleCreate = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await agentsApi.createAgent({
            name: name.trim(),
            description: description.trim() || null,
            instructions: instructions.trim(),
            role: role.trim() || null,
            model_profile_id: modelProfileId.trim() || null,
            tool_ids: toolIds,
            handoff_agent_ids: [],
          });
          await onCreated();
          reset();
          setIsOpen(false);
        } catch (createError) {
          setError(createError instanceof Error ? createError.message : 'Failed to create agent.');
        }
      })();
    });
  };

  return (
    <Card className="min-w-0 overflow-hidden border-dashed border-secondary-300 bg-secondary-50/40 dark:border-cyan-400/20 dark:bg-cyan-400/6">
      <div className="h-1 bg-secondary-400" />
      <CardHeader className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-secondary-200 bg-white text-secondary-800 dark:border-cyan-400/20 dark:bg-white/10 dark:text-cyan-100">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-base">Create agent</CardTitle>
              <CardDescription className="hidden sm:block">
                Create a standalone runtime role. Persona-backed agents stay managed in Persona.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              setError(null);
              setIsOpen(true);
            }}
          >
            New agent
          </Button>
        </div>
      </CardHeader>
      <AppDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        onDiscard={reset}
        dirty={createDirty}
        busy={isPending}
        size="lg"
        icon={<Bot className="size-4" aria-hidden="true" />}
        title="Create agent"
        description="Start with a clear role and durable instructions. Model and tool access can be refined later."
        bodyClassName="space-y-4"
        footer={
          <>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={isPending || !name.trim() || !instructions.trim()}
              onClick={handleCreate}
            >
              {isPending ? 'Creating...' : 'Create agent'}
            </Button>
          </>
        }
      >
        <FormSection
          title="Identity and purpose"
          description="Use a name and role people can distinguish in workflows and handoffs."
          icon={<Bot className="size-4" aria-hidden="true" />}
        >
          <FormFieldGroup columns={2}>
            <FormField label="Name" htmlFor="create-agent-name" error={nameError} required>
              <Input
                id="create-agent-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setTouched((current) => new Set(current).add('name'))}
                disabled={isPending}
                aria-invalid={Boolean(nameError)}
                aria-describedby="create-agent-name-feedback"
              />
            </FormField>
            <FormField
              label="Description"
              htmlFor="create-agent-description"
              description="Short summary shown in the agent directory."
              optional
            >
              <Input
                id="create-agent-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isPending}
                aria-describedby="create-agent-description-feedback"
              />
            </FormField>
            <FormField
              label="Instructions"
              htmlFor="create-agent-instructions"
              description="Describe the durable behavior this agent should follow whenever it runs."
              error={instructionsError}
              required
              className="sm:col-span-2"
            >
              <Textarea
                id="create-agent-instructions"
                required
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                onBlur={() => setTouched((current) => new Set(current).add('instructions'))}
                disabled={isPending}
                className="min-h-36"
                aria-invalid={Boolean(instructionsError)}
                aria-describedby="create-agent-instructions-feedback"
              />
            </FormField>
            <FormField
              label="Role"
              htmlFor="create-agent-role"
              description="Optional specialty used in workflow handoffs."
              optional
            >
              <Input
                id="create-agent-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={isPending}
                aria-describedby="create-agent-role-feedback"
              />
            </FormField>
            <FormField
              label="Model profile"
              htmlFor="create-agent-model-profile"
              description="Can be assigned later from Models."
              optional
            >
              <select
                id="create-agent-model-profile"
                value={modelProfileId}
                onChange={(event) => setModelProfileId(event.target.value)}
                disabled={isPending}
                aria-describedby="create-agent-model-profile-feedback"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </FormField>
          </FormFieldGroup>
        </FormSection>

        <FormSection
          title="Tool access"
          description="Optional. Keep this closed unless the agent needs additional capabilities."
          icon={<Sparkles className="size-4" aria-hidden="true" />}
          advanced
        >
          <ToolAssignmentControls
            disabled={isPending}
            onChange={setToolIds}
            toolIds={toolIds}
            tools={tools}
          />
        </FormSection>
        <FieldFeedback error={error} />
      </AppDialog>
    </Card>
  );
}

export default function AgentsWorkspace() {
  const agentsQuery = useQuery({
    queryKey: queryKeys.backendAgentCatalog(),
    queryFn: () => agentsApi.listAgentCatalog(),
  });
  const profilesQuery = useQuery({
    queryKey: queryKeys.backendBehaviorProfiles(),
    queryFn: () => behaviorProfilesApi.listProfiles(),
  });
  const personasQuery = useQuery({
    queryKey: queryKeys.backendPersonas(),
    queryFn: () => personasApi.listPersonas(),
  });
  const toolsQuery = useQuery({
    queryKey: queryKeys.tools(),
    queryFn: async () => {
      const response = await toolsApi.listTools();
      return response.items;
    },
  });
  const mainAgentQuery = useQuery({
    queryKey: queryKeys.backendMainAgent(),
    queryFn: () => conversationsApi.getMainAgent(),
  });

  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);
  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const personas = useMemo(() => personasQuery.data?.items ?? [], [personasQuery.data?.items]);
  const tools = useMemo(() => toolsQuery.data ?? [], [toolsQuery.data]);
  const activeMainAgentId = mainAgentQuery.data?.agent_id ?? null;
  const activeMainAgent = mainAgentQuery.data ?? null;
  const displayedAgents = useMemo(() => {
    if (!activeMainAgentId) {
      return agents;
    }

    return [...agents].sort((left, right) => {
      if (left.id === activeMainAgentId) {
        return -1;
      }
      if (right.id === activeMainAgentId) {
        return 1;
      }
      return 0;
    });
  }, [activeMainAgentId, agents]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const selectedAgent = useMemo(
    () =>
      agents.find((agent) => agent.id === selectedAgentId) ??
      agents.find((agent) => agent.id === activeMainAgentId) ??
      agents[0] ??
      null,
    [activeMainAgentId, agents, selectedAgentId]
  );
  const mainAgentLookupMessage = mainAgentQuery.isError
    ? 'The active main-agent lookup is currently unavailable.'
    : null;

  const assistantPageContext = useMemo(
    () => ({
      surface: 'agent.list' as const,
      title: 'Agents',
      description: 'AI agents and their definitions.',
      entities: selectedAgent
        ? [
            {
              type: 'agent',
              id: selectedAgent.id,
              name:
                selectedAgent.id === activeMainAgentId
                  ? (activeMainAgent?.name ?? selectedAgent.name)
                  : selectedAgent.name,
            },
          ]
        : undefined,
      selection: {
        agentId: selectedAgent?.id ?? null,
      },
      summary: {
        agentCount: agents.length,
        modelProfileCount: profiles.length,
        toolCount: tools.length,
        mainAgentLookupAvailable: !mainAgentQuery.isError,
        selectedAgentName: selectedAgent?.name ?? null,
        selectedAgentIsMain: selectedAgent?.id === activeMainAgentId,
      },
      allowedActions: [
        'agent.inspect',
        'agent.propose_update',
        'agent.apply_update',
        'agent.configure_main_agent',
        'agent.assign_tools',
      ],
    }),
    [
      activeMainAgent?.name,
      activeMainAgentId,
      agents.length,
      mainAgentQuery.isError,
      profiles.length,
      selectedAgent,
      tools.length,
    ]
  );
  useRegisterAssistantPageContext(assistantPageContext);
  const refreshAgents = async () => {
    await agentsQuery.refetch();
    await mainAgentQuery.refetch();
  };

  if (agentsQuery.isLoading || profilesQuery.isLoading) {
    return <LoadingCard title="Agents" description="Loading backend agent definitions." />;
  }

  if (agentsQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load agents"
        message={agentsQuery.error.message}
        onRetry={() => agentsQuery.refetch()}
      />
    );
  }

  if (profilesQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load behavior profiles"
        message={profilesQuery.error.message}
        onRetry={() => profilesQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bot}
        tone="agent"
        title="Agents"
        description="Runtime actors used by chat and workflows. Persona-backed agents are generated from published personas."
        meta={
          mainAgentLookupMessage ? (
            <p className="text-sm text-amber-700">{mainAgentLookupMessage}</p>
          ) : null
        }
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => agentsQuery.refetch()}
            disabled={agentsQuery.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${agentsQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {toolsQuery.isError ? (
        <AppState
          variant="partial"
          compact
          title="Tool assignments are temporarily unavailable"
          description="You can still review and edit agent identity and instructions. Existing tool references remain attached while the tool catalog is unavailable."
          actionLabel="Retry tools"
          onAction={() => void toolsQuery.refetch()}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <CreateAgentCard
          onCreated={async () => {
            await refreshAgents();
            toast.success('Agent created.', { position: 'top-right' });
          }}
          profiles={profiles}
          tools={tools}
        />
        <ImportAgentCard
          agents={agents}
          onImported={refreshAgents}
          profiles={profiles}
          tools={tools}
        />
      </div>

      {agents.length === 0 ? (
        <EmptyCard
          title="No agents yet"
          description="The transformed backend did not return any canonical agent definitions."
          actionLabel="Refresh"
          onAction={() => agentsQuery.refetch()}
        />
      ) : (
        <div className="grid gap-4">
          {displayedAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isMainAgent={agent.id === activeMainAgentId}
              isSelected={selectedAgent?.id === agent.id}
              mainAgent={agent.id === activeMainAgentId ? activeMainAgent : null}
              onSelect={() => setSelectedAgentId(agent.id)}
              onRefresh={refreshAgents}
              personas={personas}
              profiles={profiles}
              tools={tools}
            />
          ))}
        </div>
      )}
    </div>
  );
}
