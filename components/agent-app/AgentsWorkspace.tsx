'use client';

import { NativeSelect } from '@/components/library/shadcn/select';
import {useCallback, useEffect, useMemo, useRef, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import ToolAssignmentControls from './ToolAssignmentControls';
import {AgentIdentityFields, AgentInstructionsField} from './AgentDefinitionFields';
import {useQuery} from '@tanstack/react-query';
import {useRegisterAssistantPageContext} from '@/components/assistant/AssistantPageContext';
import {agentsApi} from '@/lib/api/backend/agents';
import {behaviorProfilesApi} from '@/lib/api/backend/behaviorProfiles';
import {conversationsApi} from '@/lib/api/backend/conversations';
import {personasApi} from '@/lib/api/backend/personas';
import {toolsApi} from '@/lib/api/backend/tools';
import {queryKeys} from '@/lib/react-query/queryKeys';
import {toolDisplayName} from '@/lib/tools/displayName';
import type {
  Agent,
  AgentConfig,
  AgentImportHandoffSuggestion,
  AgentImportProposal,
  AgentImportToolSuggestion,
  BehaviorTuningProfile
} from '@/types/agents';
import type {ToolDefinition} from '@/types/tools';
import {Badge} from '../library/shadcn/badge';
import {Tabs, TabsList, TabsTrigger, TabsContent} from '../library/shadcn/tabs';
import {Alert, AlertTitle, AlertDescription} from '../library/shadcn/alert';
import {Button} from '../library/shadcn/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '../library/shadcn/card';
import {DialogClose} from '../library/shadcn/dialog';
import {Input} from '../library/shadcn/input';
import {Label} from '../library/shadcn/label';
import {Textarea} from '../library/shadcn/textarea';
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
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,} from '../library/shadcn/tooltip';
import {EmptyCard, ErrorAlert, LoadingCard} from '@/components/agent-app/StatePanels';
import AppState from '@/components/app-shell/AppState';
import {AppDialog} from '@/components/app-shell/AppOverlay';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import {
  FieldFeedback,
  FormField,
  FormFieldGroup,
  FormSection,
} from '@/components/app-shell/FormSection';
import PageHeader from '@/components/app-shell/PageHeader';
import WorkspaceDirectory, {type WorkspaceDirectoryEntry} from '@/components/app-shell/WorkspaceDirectory';
import DocumentIngestionControl from '@/components/memory-app/DocumentIngestionControl';
import UploadedDocumentsList from '@/components/memory-app/UploadedDocumentsList';
import {toast} from 'sonner';
import {cn} from '@/lib/utils';
import {useUnsavedChangesGuard} from '@/hooks/useUnsavedChangesGuard';
import type {PersonaDefinition} from '@/types/personas';

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function agentRoleLabel(agent: Agent): string {
  const role = agentConfigOrDefaults(agent).role;
  return typeof role === 'string' && role.trim() ? role : 'Specialist agent';
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

function AgentInstructionPreview({ instructions }: { instructions: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const normalizedInstructions = instructions.trim();
  const displayInstructions =
    normalizedInstructions || 'No instructions configured.';
  const lineCount = displayInstructions.split(/\r\n|\r|\n/).length;
  const isLongPrompt = displayInstructions.length > 360 || lineCount > 4;

  return (
    <div className="flex flex-col gap-3">
      <p
        className={cn(
          'whitespace-pre-wrap wrap-break-word text-sm leading-6',
          isLongPrompt && !isExpanded && 'max-h-36 overflow-hidden'
        )}
      >
        {displayInstructions}
      </p>
      <div className="flex items-center justify-between gap-3">
        {isLongPrompt ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp data-icon="inline-start" />
            ) : (
              <ChevronDown data-icon="inline-start" />
            )}
            {isExpanded ? 'Collapse prompt' : 'Show full prompt'}
          </Button>
        ) : null}
        <span
          className="ml-auto text-xs text-muted-foreground"
          title={`${displayInstructions.length.toLocaleString()} chars`}
        >
          {formatPromptLength(displayInstructions.length)}
        </span>
      </div>
    </div>
  );
}

function formatPromptLength(characterCount: number) {
  if (characterCount < 1000) {
    return `${characterCount} chars`;
  }

  return `${(characterCount / 1000).toFixed(1)}k chars`;
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
                           onRequestOpen = (open) => open(),
                           onImported,
                           profiles,
                           tools,
                         }: {
  agents: Agent[];
  onRequestOpen?: (open: () => void) => void;
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
          toast.success(`Agent ${result.status}.`, {position: 'top-right'});
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
            {position: 'top-right'}
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
    <>
      <Button
        type="button"
        variant="outline"
        aria-label="Import agent"
        onClick={() => onRequestOpen(() => {
          setError(null);
          setIsOpen(true);
        })}
      >
        <Upload className="mr-2 size-4" aria-hidden="true"/> Import agent
      </Button>
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
        icon={<Upload className="size-4" aria-hidden="true"/>}
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
            icon={<Upload className="size-4" aria-hidden="true"/>}
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
                  <Save className="mr-2 h-4 w-4"/>
                  {isPending ? 'Importing...' : 'Import reviewed agent'}
                </Button>
              ) : null}
            </div>

            <FieldFeedback error={error}/>
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
                        <AlertTriangle className="ml-2 h-3.5 w-3.5"/>
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
                      <p
                        className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
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
                      <AlertTriangle className="h-4 w-4"/>
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
                    <NativeSelect
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
                    </NativeSelect>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="agent-import-model-profile">Model profile</Label>
                    <NativeSelect
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
                    </NativeSelect>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <Input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setEnabled(event.target.checked)}
                    disabled={isPending}
                  />
                  Enable after import
                </label>

                <AgentInstructionPreview instructions={proposal.agent.instructions ?? ''}/>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <p
                      className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      Suggested tools
                    </p>
                    <div className="mt-3 space-y-2">
                      {proposal.suggested_tool_ids.length > 0 ? (
                        proposal.suggested_tool_ids.map((suggestion) => (
                          <label
                            key={suggestion.tool_id}
                            className="flex items-start gap-2 text-sm text-neutral-700"
                          >
                            <Input
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
                    <p
                      className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
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
                              <Input
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
              <div
                className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-600">
                Preview a Markdown agent to review its Open Agency mapping.
              </div>
            )}
          </div>
        </div>
      </AppDialog>
    </>
  );
}

interface AgentDraft {
  agentId: string;
  name: string;
  description: string;
  instructions: string;
  role: string;
  modelProfileId: string;
  personaId: string;
  toolIds: string[];
}

type MainAgentIdentity = {
  name?: string | null;
  description?: string | null;
  default_model_profile_id?: string | null;
} | null;

function agentDraft(agent: Agent, mainAgent: MainAgentIdentity): AgentDraft {
  const config = agentConfigOrDefaults(agent);
  return {
    agentId: agent.id,
    name: mainAgent?.name ?? agent.name,
    description: agent.description ?? '',
    instructions: config.instructions ?? '',
    role: mainAgent?.description ?? agent.role ?? '',
    modelProfileId: config.modelProfileId ?? '',
    personaId: personaIdForAgent(agent),
    toolIds: config.toolIds,
  };
}

function AgentDetailPanel({
  agent,
  isMainAgent,
  mainAgent,
  draft,
  onDraftChange,
  onCancel,
  isPending,
  dirty,
  onPendingChange,
  onRefresh,
  personas,
  profiles,
  tools,
}: {
  agent: Agent;
  isMainAgent: boolean;
  mainAgent: MainAgentIdentity;
  draft: AgentDraft | null;
  onDraftChange: (draft: AgentDraft | null) => void;
  onCancel: () => void;
  isPending: boolean;
  dirty: boolean;
  onPendingChange: (pending: boolean) => void;
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
  const isEditing = draft !== null;
  const [section, setSection] = useState('overview');
  const values = draft ?? agentDraft(agent, mainAgent);
  const {
    name,
    description,
    instructions,
    role,
    modelProfileId,
    personaId,
    toolIds,
  } = values;
  const updateField = <K extends keyof AgentDraft>(
    field: K,
    value: AgentDraft[K]
  ) => onDraftChange({ ...values, [field]: value });
  const nameRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (isEditing) {
      const control = nameRef.current?.closest('[data-state="active"]')
        ? nameRef.current
        : contentRef.current?.querySelector<HTMLElement>(
            '[data-state="active"] input:not([type="hidden"]):not([type="file"]), [data-state="active"] button:not([disabled])'
          );
      control?.focus({ preventScroll: true });
    } else if (wasEditing.current)
      editRef.current?.focus({ preventScroll: true });
    wasEditing.current = isEditing;
  }, [isEditing]);
  const [error, setError] = useState<string | null>(null);
  const displayName = mainAgent?.name?.trim() || agent.name;
  const tone = agentCardTone(agent, isMainAgent);
  const cardDescription = isMainAgent
    ? mainAgent?.description?.trim() ||
      agent.role ||
      agent.description ||
      'No role or description configured.'
    : agent.role || agent.description || 'No role or description configured.';

  const handleSave = async () => {
    if (isPending) return;
    setError(null);
    const normalizedModelProfileId = modelProfileId.trim();
    if (isMainAgent && !normalizedModelProfileId) {
      setError('The active main agent must use an LLM model preset.');
      return;
    }
    onPendingChange(true);
    try {
      const normalizedName = name.trim();
      const normalizedRole = role.trim();
      const selectedPersona = personas.find(
        (persona) => persona.id === personaId
      );
      const metadata = { ...(config.metadata ?? {}) } as Record<
        string,
        unknown
      >;

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
          setError(
            'The active main agent must have an assistant display name.'
          );
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
          normalizedModelProfileId !==
            (mainAgent?.default_model_profile_id ?? '')
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
      onDraftChange(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to update agent.'
      );
    } finally {
      onPendingChange(false);
    }
  };

  const handleDelete = async () => {
    if (isPending) return;
    setError(null);
    onPendingChange(true);
    try {
      await agentsApi.deleteAgent(agent.id);
      onDraftChange(null);
      await onRefresh();
      toast.success('Agent deleted.', { position: 'top-right' });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete agent.'
      );
    } finally {
      onPendingChange(false);
    }
  };

  return (
    <Tabs value={section} onValueChange={setSection} activationMode="manual">
      <Card
        role="group"
        aria-label={`${displayName} agent`}
        className="min-w-0 border-border bg-card"
      >
        <CardHeader className="sticky top-0 z-10 gap-0 rounded-t-xl border-b bg-card/95 p-0 backdrop-blur-md sm:p-0">
          <div className="flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-lg border',
                  tone.avatar
                )}
              >
                {isMainAgent ? (
                  <Sparkles className="size-5" aria-hidden="true" />
                ) : (
                  <Bot className="size-5" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle
                    className="break-words text-xl leading-6"
                    role="heading"
                    aria-level={2}
                  >
                    {displayName}
                  </CardTitle>
                  <Badge variant={isMainAgent ? 'successful' : 'secondary'}>
                    {isMainAgent ? 'Main orchestrator' : 'Specialist agent'}
                  </Badge>
                  {personaSlug ? (
                    <Badge variant="outline" className={tone.badge}>
                      Persona @{personaSlug}
                    </Badge>
                  ) : null}
                  {generatedPersonaAgent ? (
                    <Badge variant="secondary">Managed persona agent</Badge>
                  ) : null}
                </div>
                <CardDescription className="mt-1 leading-6">
                  {cardDescription}
                </CardDescription>
                {isEditing ? (
                  <p
                    role="status"
                    className={cn(
                      'mt-2 text-xs',
                      dirty
                        ? 'text-amber-700 dark:text-amber-200'
                        : 'text-muted-foreground'
                    )}
                  >
                    {dirty ? 'Unsaved changes' : 'Editing agent'} · Changes
                    apply when you save.
                  </p>
                ) : null}
              </div>
            </div>
            <div
              className="flex shrink-0 flex-wrap items-center gap-2 self-end sm:self-auto"
              aria-label="Agent actions"
            >
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="brand"
                    disabled={isPending || !name.trim() || !instructions.trim()}
                    onClick={() => void handleSave()}
                  >
                    <Save className="mr-2 size-4" aria-hidden="true" />
                    {isPending ? 'Saving...' : 'Save agent'}
                  </Button>
                </>
              ) : (
                <Button
                  ref={editRef}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    onDraftChange(agentDraft(agent, mainAgent));
                  }}
                >
                  <Pencil className="mr-2 size-4" aria-hidden="true" />
                  Edit agent
                </Button>
              )}
            </div>
          </div>
          <TabsList
            aria-label="Agent sections"
            className="w-full border-b-0 px-2 sm:px-6"
          >
          <TabsTrigger value="overview" disabled={isPending} className="px-2 sm:px-3">
              Overview
            </TabsTrigger>
          <TabsTrigger value="capabilities" disabled={isPending} className="px-2 sm:px-3">
              Capabilities{' '}
              <Badge variant="secondary" className="ml-2">
                {isMainAgent ? tools.length : toolCount}
              </Badge>
            </TabsTrigger>
          <TabsTrigger value="documents" disabled={isPending} className="px-2 sm:px-3">
              Documents
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent
          ref={contentRef}
          className="flex flex-col gap-5 pt-5 sm:pt-5"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              {isMainAgent
                ? `${tools.length} available operations`
                : `${toolCount} assigned tool${toolCount === 1 ? '' : 's'}`}
            </Badge>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    aria-label={`${handoffCount} configured agent handoff${handoffCount === 1 ? '' : 's'}`}
                    className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Badge variant="outline" className="gap-1.5">
                      {handoffCount} handoff{handoffCount === 1 ? '' : 's'}
                      <HelpCircle className="size-3.5" aria-hidden="true" />
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-72 text-xs leading-5">
                  Handoffs are configured target agents this agent can delegate
                  work to. This count is configuration, not runtime history.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {generatedPersonaAgent ? (
              <p className="w-full leading-5">
                Publish a new version in Persona Factory to update this agent’s
                persona, then refresh the workflows that use it.
              </p>
            ) : null}
          </div>

          <FieldFeedback error={isEditing ? error : null} />
          <Alert role="note">
            <Sparkles className="size-4" aria-hidden="true" />
            <AlertTitle>
              {isMainAgent
                ? 'All enabled capabilities'
                : 'Explicit capability access'}
            </AlertTitle>
            <AlertDescription>
              {isMainAgent
                ? 'Harness managed. Approval and ownership rules apply to every operation.'
                : 'This specialist uses explicitly assigned operations. Existing ownership checks and approval rules stay enforced.'}
            </AlertDescription>
          </Alert>
          {/* Keep each section mounted so changing tabs preserves form and upload drafts. */}
          <TabsContent
            forceMount
            value="overview"
            hidden={section !== 'overview'}
            className="mt-0 data-[state=inactive]:hidden"
          >
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="flex min-w-0 flex-col gap-5">
                <FormSection
                  title="Identity"
                  description="Give this agent a clear purpose."
                  icon={<Bot className="size-4" aria-hidden="true" />}
                >
                  {isEditing ? (
                    <AgentIdentityFields
                      idPrefix={agent.id}
                      values={values}
                      profiles={profiles}
                      disabled={isPending}
                      mainAgent={isMainAgent}
                      nameRef={nameRef}
                      onChange={(patch) =>
                        onDraftChange({ ...values, ...patch })
                      }
                    >
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
                        <NativeSelect
                          id={`${agent.id}-persona`}
                          value={personaId}
                          onChange={(event) =>
                            updateField('personaId', event.target.value)
                          }
                          disabled={isPending || generatedPersonaAgent}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {personaId &&
                          !personas.some(
                            (persona) => persona.id === personaId
                          ) ? (
                            <option value={personaId}>
                              {personaSlug
                                ? `Persona @${personaSlug}`
                                : 'Linked persona'}
                            </option>
                          ) : null}
                          {!generatedPersonaAgent ? (
                            <option value="">No persona</option>
                          ) : null}
                          {personas.map((persona) => (
                            <option key={persona.id} value={persona.id}>
                              {persona.name} (@{persona.slug})
                            </option>
                          ))}
                        </NativeSelect>
                      </FormField>
                    </AgentIdentityFields>
                  ) : (
                    <dl>
                      <FormFieldGroup columns={2}>
                        {[
                          ['Name', displayName],
                          [
                            'Role',
                            mainAgent?.description ||
                              agent.role ||
                              'Not configured',
                          ],
                          [
                            'Description',
                            agent.description || 'No description configured.',
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className={cn(
                              'min-w-0',
                              label === 'Description' && 'md:col-span-2'
                            )}
                          >
                            <dt className="text-xs text-muted-foreground">
                              {label}
                            </dt>
                            <dd className="mt-1 break-words text-sm leading-6">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </FormFieldGroup>
                    </dl>
                  )}
                </FormSection>
                <FormSection
                  title="Instructions"
                  description="Durable behavior for every conversation and workflow."
                  icon={<FileText className="size-4" aria-hidden="true" />}
                >
                  {isEditing ? (
                    <AgentInstructionsField
                      idPrefix={agent.id}
                      value={instructions}
                      onChange={(value) => updateField('instructions', value)}
                      disabled={isPending}
                    />
                  ) : (
                    <AgentInstructionPreview
                      instructions={instructionSummary}
                    />
                  )}
                </FormSection>
              </div>
              <aside
                className="flex min-w-0 flex-col gap-4"
                aria-label="Agent context"
              >
                <FormSection
                  title="Runtime"
                  description="Reusable defaults for this agent."
                >
                  <dl className="flex flex-col gap-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Model profile
                      </dt>
                      <dd className="mt-1 break-words text-sm leading-5">
                        {profiles.find(
                          (profile) => profile.id === values.modelProfileId
                        )?.name ||
                          values.modelProfileId ||
                          'No profile'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Persona</dt>
                      <dd className="mt-1 break-words text-sm leading-5">
                        {personas.find(
                          (persona) => persona.id === values.personaId
                        )?.name ||
                          ((values.personaId || !isEditing) && personaSlug
                            ? '@' + personaSlug
                            : values.personaId
                              ? 'Linked persona'
                              : 'No persona')}
                      </dd>
                    </div>
                  </dl>
                </FormSection>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Knowledge & context
                    </CardTitle>
                    <CardDescription>
                      Reference files help this agent retrieve the right
                      information.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSection('documents')}
                    >
                      <FileText data-icon="inline-start" />
                      View documents
                    </Button>
                  </CardContent>
                </Card>
                {isEditing && !isMainAgent ? (
                  <div className="rounded-xl border p-4">
                    <h3 className="text-sm font-semibold">Remove agent</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Workflows that use this agent may need a replacement.
                    </p>
                    <ConfirmActionDialog
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-3"
                          disabled={isPending}
                        >
                          <Trash2 className="mr-2 size-4" aria-hidden="true" />
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
                  </div>
                ) : null}
                {isEditing && isMainAgent ? (
                  <p className="px-1 text-xs leading-5 text-muted-foreground">
                    The main agent cannot be deleted here.
                  </p>
                ) : null}
              </aside>
            </div>
          </TabsContent>
          <TabsContent
            forceMount
            value="capabilities"
            hidden={section !== 'capabilities'}
            className="mt-0 data-[state=inactive]:hidden"
          >
            <ToolAssignmentControls
              disabled={isPending}
              readOnly={!isEditing}
              isMainAgent={isMainAgent}
              toolIds={toolIds}
              tools={tools}
              onChange={(ids) => updateField('toolIds', ids)}
            />
          </TabsContent>
          <TabsContent
            forceMount
            value="documents"
            hidden={section !== 'documents'}
            className="mt-0 data-[state=inactive]:hidden"
          >
            <div
              className={cn(
                'grid min-w-0 gap-5',
                isEditing && 'xl:grid-cols-2'
              )}
            >
              {isEditing ? (
                <DocumentIngestionControl
                  frame="inline"
                  title="Upload document"
                  description="Uploads are saved separately from agent edits."
                  scope="user"
                  lockedScope
                  lockedAgent
                  purpose="agent"
                  agentId={agent.id}
                  agents={[{ id: agent.id, label: displayName }]}
                  defaultTags={['agent-rag', `agent:${agent.id}`]}
                />
              ) : null}
              <UploadedDocumentsList
                scope="user"
                agentId={agent.id}
                tagFilter={`agent:${agent.id}`}
                title="Agent documents"
                description="Retrieval context for this agent."
                emptyMessage="No documents attached."
                showActions={isEditing}
              />
            </div>
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  );
}

function CreateAgentCard({
  onRequestOpen = (open) => open(),
  onCreated,
  profiles,
  tools,
}: {
  onCreated: () => Promise<void> | void;
  onRequestOpen?: (open: () => void) => void;
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
  const [touched, setTouched] = useState<Set<'name' | 'instructions'>>(
    new Set()
  );
  const createDirty = Boolean(
    name ||
    description ||
    instructions ||
    role ||
    modelProfileId ||
    toolIds.length
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
  const nameError =
    touched.has('name') && !name.trim() ? 'Enter an agent name.' : null;
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
          setError(
            createError instanceof Error
              ? createError.message
              : 'Failed to create agent.'
          );
        }
      })();
    });
  };

  return (
    <>
      <Button
        type="button"
        onClick={() =>
          onRequestOpen(() => {
            setError(null);
            setIsOpen(true);
          })
        }
      >
        <Bot className="mr-2 size-4" aria-hidden="true" /> New agent
      </Button>
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
          <AgentIdentityFields
            idPrefix="create-agent"
            values={{ name, description, role, modelProfileId }}
            profiles={profiles}
            disabled={isPending}
            nameError={nameError}
            onNameBlur={() =>
              setTouched((current) => new Set(current).add('name'))
            }
            onChange={(patch) => {
              if (patch.name !== undefined) setName(patch.name);
              if (patch.description !== undefined)
                setDescription(patch.description);
              if (patch.role !== undefined) setRole(patch.role);
              if (patch.modelProfileId !== undefined)
                setModelProfileId(patch.modelProfileId);
            }}
          />
        </FormSection>
        <FormSection
          title="Instructions"
          description="The durable behavior this agent should follow."
          icon={<FileText className="size-4" aria-hidden="true" />}
        >
          <AgentInstructionsField
            idPrefix="create-agent"
            value={instructions}
            onChange={setInstructions}
            disabled={isPending}
            error={instructionsError}
            onBlur={() =>
              setTouched((current) => new Set(current).add('instructions'))
            }
          />
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
    </>
  );
}

export default function AgentsWorkspace() {
  const router = useRouter();
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
  const profiles = useMemo(
    () => profilesQuery.data ?? [],
    [profilesQuery.data]
  );
  const personas = useMemo(
    () => personasQuery.data?.items ?? [],
    [personasQuery.data?.items]
  );
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
  const [search, setSearch] = useState('');
  const [agentType, setAgentType] = useState<
    'all' | 'specialists' | 'personas'
  >('all');
  const profileNames = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.name])),
    [profiles]
  );
  const filteredAgents = useMemo(() => {
    const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return displayedAgents.filter(
      (agent) =>
        (agentType !== 'specialists' || agent.id !== activeMainAgentId) &&
        (agentType !== 'personas' ||
          Boolean(personaIdForAgent(agent) || personaSlugForAgent(agent))) &&
        terms.every((term) =>
          [
            agent.id,
            agent.name,
            agent.description,
            agentConfigOrDefaults(agent).role,
            profileNames.get(agentConfigOrDefaults(agent).modelProfileId ?? ''),
            personaSlugForAgent(agent),
            agent.id === activeMainAgentId ? activeMainAgent?.name : '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(term)
        )
    );
  }, [
    displayedAgents,
    search,
    activeMainAgentId,
    activeMainAgent?.name,
    agentType,
    profileNames,
  ]);
  const toDirectoryEntry = useCallback(
    (entry: Agent): WorkspaceDirectoryEntry => {
      const main = entry.id === activeMainAgentId;
      const config = agentConfigOrDefaults(entry);
      const linkedPersona = Boolean(
        personaIdForAgent(entry) || personaSlugForAgent(entry)
      );
      const label = main ? (activeMainAgent?.name ?? entry.name) : entry.name;
      return {
        id: entry.id,
        label,
        actionLabel: 'Inspect ' + label,
        optionLabel: main ? label + ' · Main agent' : label,
        description: main
          ? 'Main agent · Harness managed'
          : agentRoleLabel(entry),
        group: main
          ? 'Main agent'
          : linkedPersona
            ? 'Persona-backed'
            : 'Specialists',
        icon: main ? Sparkles : Bot,
        meta: (
          <span className="flex flex-col">
            <span className="truncate">
              {profileNames.get(config.modelProfileId ?? '') ||
                config.modelProfileId ||
                'No model preset'}
            </span>
            <span>
              {main
                ? 'All capabilities'
                : `${config.toolIds.length} assigned tools`}
            </span>
          </span>
        ),
      };
    },
    [activeMainAgentId, activeMainAgent?.name, profileNames]
  );
  const directoryEntries = useMemo(
    () => filteredAgents.map(toDirectoryEntry),
    [filteredAgents, toDirectoryEntry]
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [editorPending, setEditorPending] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const editingAgentId = draft?.agentId;
  const selectedAgent = useMemo(
    () =>
      displayedAgents.find((agent) => agent.id === editingAgentId) ??
      filteredAgents.find((agent) => agent.id === selectedAgentId) ??
      filteredAgents.find((agent) => agent.id === activeMainAgentId) ??
      filteredAgents[0] ??
      null,
    [
      activeMainAgentId,
      displayedAgents,
      editingAgentId,
      filteredAgents,
      selectedAgentId,
    ]
  );
  const editorDirty = Boolean(
    draft &&
    selectedAgent &&
    JSON.stringify(draft) !==
      JSON.stringify(
        agentDraft(
          selectedAgent,
          selectedAgent.id === activeMainAgentId ? activeMainAgent : null
        )
      )
  );
  const requestNavigation = useCallback(
    (action: () => void) => {
      if (editorPending) return;
      if (editorDirty) setPendingNavigation(() => action);
      else {
        setDraft(null);
        action();
      }
    },
    [editorDirty, editorPending, setDraft, setPendingNavigation]
  );
  const guardLink = useCallback(
    (href: string) => {
      requestNavigation(() => router.push(href));
    },
    [requestNavigation, router]
  );
  useUnsavedChangesGuard(editorDirty || editorPending, guardLink);
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
    await Promise.all([agentsQuery.refetch(), mainAgentQuery.refetch()]);
  };

  if (
    agentsQuery.isLoading ||
    profilesQuery.isLoading ||
    mainAgentQuery.isLoading
  ) {
    return (
      <LoadingCard
        title="Agents"
        description="Loading backend agent definitions."
      />
    );
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
        description="Define how your agents work, the models they use, and the capabilities they can access."
        compact
        meta={
          <>
            <Badge variant="outline">{agents.length} agents</Badge>
            <Badge variant="outline">
              {agents.filter((agent) => agent.id !== activeMainAgentId).length}{' '}
              specialists
            </Badge>
            <Badge variant="outline">
              {
                agents.filter(
                  (agent) =>
                    personaIdForAgent(agent) || personaSlugForAgent(agent)
                ).length
              }{' '}
              persona-backed
            </Badge>
            {mainAgentLookupMessage ? (
              <p className="text-sm text-amber-700">{mainAgentLookupMessage}</p>
            ) : null}
          </>
        }
        actions={
          <>
            <CreateAgentCard
              onRequestOpen={requestNavigation}
              onCreated={async () => {
                await refreshAgents();
                toast.success('Agent created.', { position: 'top-right' });
              }}
              profiles={profiles}
              tools={tools}
            />
            <ImportAgentCard
              onRequestOpen={requestNavigation}
              agents={agents}
              onImported={refreshAgents}
              profiles={profiles}
              tools={tools}
            />

            <Button
              type="button"
              variant="outline"
              aria-label="Refresh"
              onClick={() => requestNavigation(() => void refreshAgents())}
              disabled={agentsQuery.isFetching || editorPending}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${agentsQuery.isFetching ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
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

      {agents.length === 0 ? (
        <EmptyCard
          title="No agents yet"
          description="The transformed backend did not return any canonical agent definitions."
          actionLabel="Refresh"
          onAction={() => agentsQuery.refetch()}
        />
      ) : (
        <div className="grid min-w-0 items-start gap-5 md:grid-cols-[16rem_minmax(0,1fr)]">
          <WorkspaceDirectory
            label="Agent directory"
            title="Your agents"
            entries={directoryEntries}
            selected={
              selectedAgent
                ? (directoryEntries.find(
                    (entry) => entry.id === selectedAgent.id
                  ) ?? toDirectoryEntry(selectedAgent))
                : null
            }
            onSelect={(id) => requestNavigation(() => setSelectedAgentId(id))}
            search={{
              label: 'Search agents',
              placeholder: 'Name, role or model…',
              value: search,
              onChange: setSearch,
            }}
            summary={`${filteredAgents.length} of ${agents.length} agents`}
            selectionLabel="Inspect agent"
            emptyMessage="No matching agents. Adjust your search or agent type."
            disabled={editorPending}
            className="md:sticky md:top-5"
            toolbar={
              <NativeSelect
                aria-label="Filter agents by type"
                disabled={editorPending}
                value={agentType}
                onChange={(event) =>
                  setAgentType(event.target.value as typeof agentType)
                }
                className="h-8 w-auto max-w-full py-1 text-xs"
              >
                <option value="all">All agents</option>
                <option value="specialists">Specialists</option>
                <option value="personas">Persona-backed</option>
              </NativeSelect>
            }
          />
          <div className="min-w-0">
            {selectedAgent ? (
              <AgentDetailPanel
                key={selectedAgent.id}
                agent={selectedAgent}
                isMainAgent={selectedAgent.id === activeMainAgentId}
                mainAgent={
                  selectedAgent.id === activeMainAgentId
                    ? activeMainAgent
                    : null
                }
                draft={draft}
                onDraftChange={(next) => {
                  setSelectedAgentId(selectedAgent.id);
                  setDraft(next);
                }}
                onCancel={() => requestNavigation(() => {})}
                isPending={editorPending}
                dirty={editorDirty}
                onPendingChange={setEditorPending}
                onRefresh={refreshAgents}
                personas={personas}
                profiles={profiles}
                tools={tools}
              />
            ) : (
              <EmptyCard
                title="No matching agents"
                description="Search by name, role, or agent ID."
                actionLabel="Clear search"
                onAction={() => {
                  setSearch('');
                  setAgentType('all');
                }}
              />
            )}
          </div>
        </div>
      )}
      <ConfirmActionDialog
        trigger={null}
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
        title="Discard unsaved changes?"
        description="Your agent edits have not been saved. Discard them to continue, or keep editing."
        cancelLabel="Continue editing"
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => {
          const action = pendingNavigation;
          setPendingNavigation(null);
          setDraft(null);
          action?.();
        }}
      />
    </div>
  );
}
