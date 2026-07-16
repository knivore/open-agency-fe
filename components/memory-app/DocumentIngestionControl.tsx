'use client';

import type { DragEvent } from 'react';
import { useId, useRef, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { documentsApi } from '@/lib/api/backend/documents';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type {
  DocumentIngestionResult,
  DocumentMemoryScope,
  DocumentUploadMode,
  DocumentUploadIntelligenceResult,
} from '@/types/documents';
import { Button } from '@/components/library/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import { Input } from '@/components/library/shadcn/input';
import { Label } from '@/components/library/shadcn/label';

const documentScopes: DocumentMemoryScope[] = ['user', 'workspace', 'conversation', 'workflow'];
const documentUploadAccept = '.txt,.md,.markdown,.csv,.json,.log,.html,.htm,.pdf,.docx';
const defaultUploadModes: DocumentUploadMode[] = ['vector'];
const uploadModeLabels: Record<DocumentUploadMode, string> = {
  vector: 'Save for retrieval',
  context: 'Use in this chat',
  both: 'Use now and save',
};

export interface DocumentIngestionOption {
  id: string;
  label: string;
}

interface DocumentIngestionControlProps {
  agents?: DocumentIngestionOption[];
  agentId?: string | null;
  conversations?: DocumentIngestionOption[];
  conversationId?: string | null;
  defaultTags?: string[];
  defaultUploadMode?: DocumentUploadMode;
  description?: string;
  compact?: boolean;
  frame?: 'card' | 'inline';
  lockedAgent?: boolean;
  lockedScope?: boolean;
  onIngested?: (result: DocumentIngestionResult) => Promise<void> | void;
  onSuggestedGovernanceLabels?: (labels: Record<string, string>) => Promise<void> | void;
  purpose?: 'memory' | 'persona_factory' | 'workflow' | 'agent' | 'conversation';
  scope?: DocumentMemoryScope;
  title?: string;
  allowedUploadModes?: DocumentUploadMode[];
  workflows?: DocumentIngestionOption[];
  workflowId?: string | null;
  workspaceId?: string | null;
}

function scopeLabel(scope: DocumentMemoryScope) {
  return scope.charAt(0).toUpperCase() + scope.slice(1);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizedTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function contextLabel(options: DocumentIngestionOption[], id?: string | null) {
  if (!id) {
    return '';
  }
  return options.find((option) => option.id === id)?.label ?? id;
}

function uploadSuccessMessage(result: DocumentIngestionResult) {
  if (result.upload_mode === 'context') {
    return `Attached ${result.filename} for this chat.`;
  }
  if (result.upload_mode === 'both') {
    return `Attached ${result.filename} and saved ${result.chunks_created} memory chunk${
      result.chunks_created === 1 ? '' : 's'
    }.`;
  }
  return `Ingested ${result.filename} into ${result.chunks_created} memory chunk${
    result.chunks_created === 1 ? '' : 's'
  }.`;
}

export default function DocumentIngestionControl({
  agents = [],
  agentId = '',
  conversations = [],
  conversationId = '',
  defaultTags = ['document'],
  defaultUploadMode = 'vector',
  description = 'Drop a file or choose one from your computer. Open Agency will parse and chunk it automatically.',
  compact = false,
  frame = 'card',
  lockedAgent = false,
  lockedScope = false,
  onIngested,
  onSuggestedGovernanceLabels,
  purpose = 'memory',
  scope: initialScope = 'user',
  title = 'Upload document',
  allowedUploadModes = defaultUploadModes,
  workflows = [],
  workflowId = '',
  workspaceId = '',
}: DocumentIngestionControlProps) {
  const queryClient = useQueryClient();
  const idPrefix = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [scope, setScope] = useState<DocumentMemoryScope>(initialScope);
  const [localWorkspaceId, setLocalWorkspaceId] = useState(workspaceId ?? '');
  const [localConversationId, setLocalConversationId] = useState(conversationId ?? '');
  const [localWorkflowId, setLocalWorkflowId] = useState(workflowId ?? '');
  const [localAgentId, setLocalAgentId] = useState(agentId ?? '');
  const [tags, setTags] = useState(defaultTags.join(','));
  const [uploadMode, setUploadMode] = useState<DocumentUploadMode>(
    allowedUploadModes.includes(defaultUploadMode)
      ? defaultUploadMode
      : (allowedUploadModes[0] ?? 'vector')
  );
  const [chunkSize, setChunkSize] = useState('1200');
  const [chunkOverlap, setChunkOverlap] = useState('150');
  const [customChunking, setCustomChunking] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [intelligence, setIntelligence] = useState<DocumentUploadIntelligenceResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clearFile = () => {
    setFile(null);
    setIntelligence(null);
    setIsAnalyzing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleScopeChange = (nextScope: DocumentMemoryScope) => {
    setScope(nextScope);
    if (nextScope !== 'workspace' && !workspaceId) {
      setLocalWorkspaceId('');
    }
    if (nextScope !== 'conversation' && !conversationId) {
      setLocalConversationId('');
    }
    if (nextScope !== 'workflow' && !workflowId) {
      setLocalWorkflowId('');
    }
  };

  const effectiveWorkspaceId = scope === 'workspace' ? workspaceId || localWorkspaceId : '';
  const effectiveConversationId =
    scope === 'conversation' ? conversationId || localConversationId : '';
  const effectiveWorkflowId = scope === 'workflow' ? workflowId || localWorkflowId : '';
  const effectiveAgentId = agentId || localAgentId;
  const missingScopeBinding =
    (scope === 'workspace' && !effectiveWorkspaceId.trim()) ||
    (scope === 'conversation' && !effectiveConversationId.trim()) ||
    (scope === 'workflow' && !effectiveWorkflowId.trim());

  const selectFile = (nextFile: File | null | undefined) => {
    setError(null);
    const selected = nextFile ?? null;
    setFile(selected);
    setIntelligence(null);
    if (selected) {
      void analyzeSelectedFile(selected);
    }
  };

  const analyzeSelectedFile = async (selected: File) => {
    setIsAnalyzing(true);
    try {
      const recommendation = await documentsApi.analyzeUpload({
        file: selected,
        scope,
        workspaceId: effectiveWorkspaceId.trim() || undefined,
        conversationId: effectiveConversationId.trim() || undefined,
        workflowId: effectiveWorkflowId.trim() || undefined,
        agentId: effectiveAgentId.trim() || undefined,
        tags: normalizedTags(tags),
        chunkSize: customChunking ? Number(chunkSize) || undefined : undefined,
        chunkOverlap: customChunking ? Number(chunkOverlap) || undefined : undefined,
        purpose,
      });
      setIntelligence(recommendation);
      applyIntelligence(recommendation);
    } catch (analysisError) {
      setIntelligence({
        filename: selected.name,
        content_type: selected.type || null,
        text_characters: selected.size,
        source: 'unavailable',
        model_profile_id: null,
        document_kind: 'unknown',
        summary: 'Upload assistant could not inspect this file.',
        confidence: 0,
        rationale:
          analysisError instanceof Error
            ? analysisError.message
            : 'Upload assistant is unavailable.',
        recommended: {},
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyIntelligence = (recommendation: DocumentUploadIntelligenceResult) => {
    const recommended = recommendation.recommended ?? {};
    if (!lockedScope && recommended.scope) {
      handleScopeChange(recommended.scope);
      if (recommended.workspace_id) {
        setLocalWorkspaceId(recommended.workspace_id);
      }
      if (recommended.conversation_id) {
        setLocalConversationId(recommended.conversation_id);
      }
      if (recommended.workflow_id) {
        setLocalWorkflowId(recommended.workflow_id);
      }
    }
    if (!lockedAgent && recommended.agent_id) {
      setLocalAgentId(recommended.agent_id);
    }
    if (recommended.tags?.length) {
      setTags((current) =>
        Array.from(new Set([...normalizedTags(current), ...(recommended.tags ?? [])])).join(',')
      );
    }
    if (recommended.chunk_size) {
      setChunkSize(String(recommended.chunk_size));
    }
    if (recommended.chunk_overlap !== undefined && recommended.chunk_overlap !== null) {
      setChunkOverlap(String(recommended.chunk_overlap));
    }
    if (recommended.governance_labels) {
      void onSuggestedGovernanceLabels?.(recommended.governance_labels);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isPending) {
      return;
    }
    selectFile(event.dataTransfer.files?.[0]);
  };

  const handleIngest = () => {
    if (!file) {
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const result = await documentsApi.ingestDocument({
            file,
            scope,
            workspaceId: effectiveWorkspaceId.trim() || undefined,
            conversationId: effectiveConversationId.trim() || undefined,
            workflowId: effectiveWorkflowId.trim() || undefined,
            agentId: effectiveAgentId.trim() || undefined,
            tags: normalizedTags(tags),
            chunkSize:
              customChunking || intelligence?.recommended?.chunk_size
                ? Number(chunkSize) || undefined
                : undefined,
            chunkOverlap:
              customChunking || intelligence?.recommended?.chunk_overlap !== undefined
                ? Number(chunkOverlap) || undefined
                : undefined,
            autoIntelligence: true,
            allowScopeSuggestion: !lockedScope,
            allowAgentSuggestion: !lockedAgent,
            purpose,
            uploadMode,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() });
          await onIngested?.(result);
          clearFile();
          toast.success(uploadSuccessMessage(result), { position: 'top-right' });
        } catch (ingestError) {
          setError(
            ingestError instanceof Error ? ingestError.message : 'Failed to ingest document.'
          );
        }
      })();
    });
  };

  const content = (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={documentUploadAccept}
        className="hidden"
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
        }}
      />
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!isPending) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border border-dashed px-4 py-5 transition ${
          isDragging
            ? 'border-primary-400 bg-primary-50 dark:border-sky-300 dark:bg-sky-500/12'
            : 'border-slate-300 bg-slate-50 hover:border-primary-300 hover:bg-white dark:border-white/12 dark:bg-slate-950/70 dark:hover:border-sky-300/35 dark:hover:bg-slate-950/88'
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-sky-500/12 dark:text-sky-200">
              <Upload className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                {file ? file.name : 'Drop a document here'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isAnalyzing
                  ? 'Main-agent is reading the document...'
                  : file
                    ? formatFileSize(file.size)
                    : 'PDF, DOCX, Markdown, text, CSV, JSON, logs, or HTML'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {file ? 'Change file' : 'Choose file'}
          </Button>
        </div>
        {file ? (
          <div className="mt-3 flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/78">
            <FileText className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="truncate font-medium text-slate-900 dark:text-slate-100">
              {file.name}
            </span>
            <span className="shrink-0 text-slate-500 dark:text-slate-400">
              {formatFileSize(file.size)}
            </span>
            <button
              type="button"
              className="ml-auto rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-slate-100"
              onClick={clearFile}
              aria-label="Remove selected document"
              title="Remove document"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {intelligence ? (
        <div className="rounded-md border border-primary-100 bg-primary-50 px-3 py-3 text-xs text-slate-700 dark:border-sky-300/14 dark:bg-sky-500/10 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-950 dark:text-slate-100">
              {intelligence.source === 'main_agent_llm'
                ? 'Main-agent recommendation'
                : 'Upload recommendation'}
            </span>
            <span>{intelligence.document_kind.replaceAll('_', ' ')}</span>
            <span>{Math.round((intelligence.confidence ?? 0) * 100)}%</span>
          </div>
          <p className="mt-1 line-clamp-2">{intelligence.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {intelligence.recommended.scope ? (
              <span className="rounded-full border border-primary-100 bg-white px-2 py-0.5 dark:border-sky-300/14 dark:bg-slate-950/78 dark:text-slate-200">
                {scopeLabel(intelligence.recommended.scope)}
              </span>
            ) : null}
            {intelligence.recommended.chunk_size ? (
              <span className="rounded-full border border-primary-100 bg-white px-2 py-0.5 dark:border-sky-300/14 dark:bg-slate-950/78 dark:text-slate-200">
                Chunk {intelligence.recommended.chunk_size}
                {intelligence.recommended.chunk_overlap !== undefined
                  ? ` / ${intelligence.recommended.chunk_overlap}`
                  : ''}
              </span>
            ) : null}
            {(intelligence.recommended.tags ?? []).slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-primary-100 bg-white px-2 py-0.5 dark:border-sky-300/14 dark:bg-slate-950/78 dark:text-slate-200"
              >
                {tag}
              </span>
            ))}
            {intelligence.recommended.governance_labels?.sensitivity_level ? (
              <span className="rounded-full border border-primary-100 bg-white px-2 py-0.5 dark:border-sky-300/14 dark:bg-slate-950/78 dark:text-slate-200">
                {intelligence.recommended.governance_labels.sensitivity_level}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {compact ? null : (
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-800 hover:border-primary-200 hover:bg-primary-50 dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-200 dark:hover:border-sky-300/30 dark:hover:bg-slate-950/92"
          onClick={() => setShowAdvanced((current) => !current)}
        >
          <span>Advanced</span>
          <ChevronDown className={`h-4 w-4 transition ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
      )}

      {!compact && showAdvanced ? (
        <div className="grid gap-3 md:grid-cols-4">
          {allowedUploadModes.length > 1 ? (
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`${idPrefix}-document-upload-mode`}>Use document as</Label>
              <select
                id={`${idPrefix}-document-upload-mode`}
                value={uploadMode}
                onChange={(event) => setUploadMode(event.target.value as DocumentUploadMode)}
                disabled={isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-100"
              >
                {allowedUploadModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {uploadModeLabels[mode]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-document-memory-scope`}>Scope</Label>
            {lockedScope ? (
              <Input id={`${idPrefix}-document-memory-scope`} value={scopeLabel(scope)} disabled />
            ) : (
              <select
                id={`${idPrefix}-document-memory-scope`}
                value={scope}
                onChange={(event) => handleScopeChange(event.target.value as DocumentMemoryScope)}
                disabled={isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-100"
              >
                {documentScopes.map((item) => (
                  <option key={item} value={item}>
                    {scopeLabel(item)}
                  </option>
                ))}
              </select>
            )}
          </div>
          {scope === 'workspace' ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-document-workspace-id`}>Workspace ID</Label>
              <Input
                id={`${idPrefix}-document-workspace-id`}
                value={workspaceId ? contextLabel([], workspaceId) : localWorkspaceId}
                onChange={(event) => setLocalWorkspaceId(event.target.value)}
                disabled={isPending || Boolean(workspaceId)}
                placeholder="Required"
              />
            </div>
          ) : null}
          {scope === 'conversation' ? (
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`${idPrefix}-document-conversation-id`}>Conversation</Label>
              {conversationId ? (
                <Input
                  id={`${idPrefix}-document-conversation-id`}
                  value={contextLabel(conversations, conversationId)}
                  disabled
                />
              ) : (
                <select
                  id={`${idPrefix}-document-conversation-id`}
                  value={localConversationId}
                  onChange={(event) => setLocalConversationId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-100"
                >
                  <option value="">Select a conversation</option>
                  {conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>
                      {conversation.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
          {scope === 'workflow' ? (
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`${idPrefix}-document-workflow-id`}>Workflow</Label>
              {workflowId ? (
                <Input
                  id={`${idPrefix}-document-workflow-id`}
                  value={contextLabel(workflows, workflowId)}
                  disabled
                />
              ) : (
                <select
                  id={`${idPrefix}-document-workflow-id`}
                  value={localWorkflowId}
                  onChange={(event) => setLocalWorkflowId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-100"
                >
                  <option value="">Select a workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {!compact && showAdvanced ? (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-document-agent-id`}>Agent binding</Label>
            {lockedAgent ? (
              <Input
                id={`${idPrefix}-document-agent-id`}
                value={contextLabel(agents, effectiveAgentId) || 'Any agent'}
                disabled
              />
            ) : (
              <select
                id={`${idPrefix}-document-agent-id`}
                value={localAgentId}
                onChange={(event) => setLocalAgentId(event.target.value)}
                disabled={isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-100"
              >
                <option value="">Any agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-document-tags`}>Tags</Label>
            <Input
              id={`${idPrefix}-document-tags`}
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              disabled={isPending}
              placeholder="document,policy"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-document-custom-chunking`}>Chunking</Label>
            <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-100">
              <input
                id={`${idPrefix}-document-custom-chunking`}
                type="checkbox"
                checked={customChunking}
                onChange={(event) => setCustomChunking(event.target.checked)}
                disabled={isPending}
              />
              Custom
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-document-chunk-size`}>Chunk size</Label>
            <Input
              id={`${idPrefix}-document-chunk-size`}
              type="number"
              min={200}
              value={chunkSize}
              onChange={(event) => setChunkSize(event.target.value)}
              disabled={isPending || !customChunking}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-document-chunk-overlap`}>Chunk overlap</Label>
            <Input
              id={`${idPrefix}-document-chunk-overlap`}
              type="number"
              min={0}
              value={chunkOverlap}
              onChange={(event) => setChunkOverlap(event.target.value)}
              disabled={isPending || !customChunking}
            />
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        className="agency-gradient text-white hover:brightness-105"
        disabled={isPending || isAnalyzing || !file || missingScopeBinding}
        onClick={handleIngest}
      >
        {isPending ? 'Uploading...' : isAnalyzing ? 'Inspecting...' : 'Upload'}
      </Button>
      {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );

  if (frame === 'inline') {
    return (
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-sky-300/14 dark:bg-[linear-gradient(180deg,rgba(16,30,45,0.9),rgba(9,21,35,0.96))]">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{description}</p>
        </div>
        {content}
      </section>
    );
  }

  return (
    <Card className="border-slate-200 bg-white dark:border-sky-300/14 dark:bg-[linear-gradient(180deg,rgba(16,30,45,0.9),rgba(9,21,35,0.96))]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg dark:text-slate-100">
          <Upload className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription className="dark:text-slate-400">{description}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
