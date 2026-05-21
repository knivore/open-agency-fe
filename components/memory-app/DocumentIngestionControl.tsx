'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { documentsApi } from '@/lib/api/backend';
import type { DocumentMemoryScope } from '@/types/documents';
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
  description?: string;
  frame?: 'card' | 'inline';
  lockedAgent?: boolean;
  lockedScope?: boolean;
  onIngested?: () => Promise<void> | void;
  scope?: DocumentMemoryScope;
  title?: string;
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

export default function DocumentIngestionControl({
  agents = [],
  agentId = '',
  conversations = [],
  conversationId = '',
  defaultTags = ['document'],
  description = 'Upload source material into durable archive memory for retrieval.',
  frame = 'card',
  lockedAgent = false,
  lockedScope = false,
  onIngested,
  scope: initialScope = 'user',
  title = 'Ingest document',
  workflows = [],
  workflowId = '',
  workspaceId = '',
}: DocumentIngestionControlProps) {
  const idPrefix = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [scope, setScope] = useState<DocumentMemoryScope>(initialScope);
  const [localWorkspaceId, setLocalWorkspaceId] = useState(workspaceId ?? '');
  const [localConversationId, setLocalConversationId] = useState(conversationId ?? '');
  const [localWorkflowId, setLocalWorkflowId] = useState(workflowId ?? '');
  const [localAgentId, setLocalAgentId] = useState(agentId ?? '');
  const [tags, setTags] = useState(defaultTags.join(','));
  const [chunkSize, setChunkSize] = useState('1200');
  const [chunkOverlap, setChunkOverlap] = useState('150');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clearFile = () => {
    setFile(null);
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
            chunkSize: Number(chunkSize) || undefined,
            chunkOverlap: Number(chunkOverlap) || undefined,
          });
          await onIngested?.();
          clearFile();
          toast.success(
            `Ingested ${result.filename} into ${result.chunks_created} memory chunks.`,
            { position: 'top-right' }
          );
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
          setError(null);
          setFile(event.target.files?.[0] ?? null);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Select document
        </Button>
        {file ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="truncate font-medium text-slate-900">{file.name}</span>
            <span className="shrink-0 text-slate-500">{formatFileSize(file.size)}</span>
            <button
              type="button"
              className="ml-auto rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              onClick={clearFile}
              aria-label="Remove selected document"
              title="Remove document"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
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
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
          <Label htmlFor={`${idPrefix}-document-chunk-size`}>Chunk size</Label>
          <Input
            id={`${idPrefix}-document-chunk-size`}
            type="number"
            min={200}
            value={chunkSize}
            onChange={(event) => setChunkSize(event.target.value)}
            disabled={isPending}
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
            disabled={isPending}
          />
        </div>
      </div>

      <Button
        type="button"
        className="agency-gradient text-white hover:brightness-105"
        disabled={isPending || !file || missingScopeBinding}
        onClick={handleIngest}
      >
        {isPending ? 'Ingesting...' : 'Ingest into memory'}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );

  if (frame === 'inline') {
    return (
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        {content}
      </section>
    );
  }

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
