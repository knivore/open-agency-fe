'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { documentsApi } from '@/lib/api/backend/documents';
import { memoriesApi } from '@/lib/api/backend/memory';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { JsonValue } from '@/types/api';
import type {
  DocumentMemoryScope,
  DocumentUploadMode,
  UploadedDocumentDeleteResponse,
  UploadedDocumentRecord,
} from '@/types/documents';
import type { MemoryDocumentDeleteResponse, MemoryRecord } from '@/types/memory';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';

interface UploadedDocumentsListProps {
  agentId?: string | null;
  className?: string;
  conversationId?: string | null;
  description?: string;
  emptyMessage?: string;
  limit?: number;
  scope: DocumentMemoryScope;
  showActions?: boolean;
  tagFilter?: string;
  title?: string;
  workflowId?: string | null;
  workspaceId?: string | null;
}

interface UploadedDocumentSummary {
  chunkCount: number;
  documentId: string;
  estimatedTokens?: number;
  filename: string;
  hasUploadedDocument: boolean;
  latestAt?: string;
  mode: DocumentUploadMode;
  observedChunkCount?: number;
  observedProjection?: boolean;
  recommendationSource?: string;
  source?: string;
  tags: string[];
  textCharacters?: number;
}

function stringMetadataValue(memory: MemoryRecord, key: string) {
  const value: JsonValue | undefined = memory.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function numberMetadataValue(memory: MemoryRecord, key: string) {
  const value: JsonValue | undefined = memory.metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArrayMetadataValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function uploadedDocumentTags(document: UploadedDocumentRecord) {
  const metadata = document.metadata ?? {};
  return stringArrayMetadataValue(metadata.tags);
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function metadataBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function uploadObservability(document: UploadedDocumentRecord) {
  return metadataObject(document.metadata?.upload_observability);
}

function uploadIntelligenceSource(document: UploadedDocumentRecord) {
  const uploadIntelligence = metadataObject(document.metadata?.upload_intelligence);
  const source = uploadIntelligence.source;
  return typeof source === 'string' && source.trim().length > 0 ? source : undefined;
}

function uploadModeLabel(mode: DocumentUploadMode) {
  switch (mode) {
    case 'context':
      return 'Context only';
    case 'both':
      return 'Context + retrieval';
    case 'vector':
    default:
      return 'Retrieval';
  }
}

function uploadModeBadgeClass(mode: DocumentUploadMode) {
  switch (mode) {
    case 'context':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/18 dark:bg-sky-500/12 dark:text-sky-100';
    case 'both':
      return 'border-primary-200 bg-primary-50 text-primary-800 dark:border-primary-300/18 dark:bg-primary-500/12 dark:text-slate-100';
    case 'vector':
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/18 dark:bg-emerald-500/12 dark:text-emerald-100';
  }
}

function formatUploadedAt(value?: string) {
  if (!value) {
    return 'Unknown time';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function memoryFilename(memory: MemoryRecord) {
  return (
    stringMetadataValue(memory, 'filename') ||
    stringMetadataValue(memory, 'file_name') ||
    memory.summary ||
    memory.content.slice(0, 80) ||
    'Uploaded document'
  );
}

function summarizeDocuments(memories: MemoryRecord[]) {
  const grouped = new Map<string, UploadedDocumentSummary>();

  memories.forEach((memory) => {
    const documentId = stringMetadataValue(memory, 'document_id') || memory.id;
    const existing = grouped.get(documentId);
    const chunkCount = numberMetadataValue(memory, 'chunk_count');
    const latestAt = memory.updated_at || memory.created_at;
    const nextTags = new Set([...(existing?.tags ?? []), ...(memory.tags ?? [])]);
    const nextChunkCount = Math.max(existing?.chunkCount ?? 0, chunkCount ?? 0, 1);

    grouped.set(documentId, {
      documentId,
      filename: existing?.filename || memoryFilename(memory),
      chunkCount: Math.max(existing?.chunkCount ?? 0, nextChunkCount),
      hasUploadedDocument: existing?.hasUploadedDocument ?? false,
      mode: existing?.mode ?? 'vector',
      latestAt:
        existing?.latestAt && latestAt
          ? new Date(existing.latestAt).getTime() > new Date(latestAt).getTime()
            ? existing.latestAt
            : latestAt
          : existing?.latestAt || latestAt,
      source: existing?.source || stringMetadataValue(memory, 'storage_uri'),
      tags: Array.from(nextTags),
    });
  });

  return Array.from(grouped.values()).sort((left, right) => {
    const leftTime = left.latestAt ? new Date(left.latestAt).getTime() : 0;
    const rightTime = right.latestAt ? new Date(right.latestAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function summarizeUploadedDocuments(
  documents: UploadedDocumentRecord[],
  memories: MemoryRecord[],
  tagFilter?: string
) {
  const grouped = new Map<string, UploadedDocumentSummary>();

  for (const document of documents) {
    const tags = uploadedDocumentTags(document);
    if (tagFilter && !tags.includes(tagFilter)) {
      continue;
    }
    const observability = uploadObservability(document);
    grouped.set(document.id, {
      documentId: document.id,
      filename: document.filename,
      chunkCount: 0,
      estimatedTokens: document.estimated_tokens,
      hasUploadedDocument: true,
      latestAt: document.updated_at || document.created_at,
      mode: document.upload_mode,
      observedChunkCount: metadataNumber(observability.chunks_created),
      observedProjection: metadataBoolean(observability.projection_event_created),
      recommendationSource: uploadIntelligenceSource(document),
      source: document.storage_uri ?? undefined,
      tags,
      textCharacters: document.text_characters,
    });
  }

  for (const memorySummary of summarizeDocuments(memories)) {
    const existing = grouped.get(memorySummary.documentId);
    grouped.set(memorySummary.documentId, {
      ...memorySummary,
      ...existing,
      chunkCount: Math.max(existing?.chunkCount ?? 0, memorySummary.chunkCount),
      filename: existing?.filename || memorySummary.filename,
      hasUploadedDocument: existing?.hasUploadedDocument ?? memorySummary.hasUploadedDocument,
      latestAt:
        existing?.latestAt && memorySummary.latestAt
          ? new Date(existing.latestAt).getTime() > new Date(memorySummary.latestAt).getTime()
            ? existing.latestAt
            : memorySummary.latestAt
          : existing?.latestAt || memorySummary.latestAt,
      mode: existing?.mode ?? memorySummary.mode,
      source: existing?.source || memorySummary.source,
      tags: Array.from(new Set([...(existing?.tags ?? []), ...memorySummary.tags])),
    });
  }

  return Array.from(grouped.values()).sort((left, right) => {
    const leftTime = left.latestAt ? new Date(left.latestAt).getTime() : 0;
    const rightTime = right.latestAt ? new Date(right.latestAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function documentDetailText(document: UploadedDocumentSummary) {
  const parts = [];
  if (document.chunkCount > 0) {
    parts.push(`${document.chunkCount} memory chunk${document.chunkCount === 1 ? '' : 's'}`);
  } else {
    parts.push('No retrieval chunks');
  }
  if (document.estimatedTokens !== undefined) {
    parts.push(`${document.estimatedTokens.toLocaleString()} est. tokens`);
  } else if (document.textCharacters !== undefined) {
    parts.push(`${document.textCharacters.toLocaleString()} chars`);
  }
  parts.push(formatUploadedAt(document.latestAt));
  return parts.join(' · ');
}

function documentObservabilityText(document: UploadedDocumentSummary) {
  const parts = [];
  if (document.hasUploadedDocument) {
    parts.push('Tracked source file');
  }
  if (document.observedChunkCount !== undefined) {
    parts.push(
      `${document.observedChunkCount.toLocaleString()} stored chunk${document.observedChunkCount === 1 ? '' : 's'}`
    );
  }
  if (document.observedProjection !== undefined) {
    parts.push(document.observedProjection ? 'Graph projection queued' : 'No graph projection');
  }
  if (document.recommendationSource) {
    parts.push(`Classified by ${document.recommendationSource.replaceAll('_', ' ')}`);
  }
  return parts.join(' · ');
}

function deletedMemoryCount(result: UploadedDocumentDeleteResponse | MemoryDocumentDeleteResponse) {
  if ('deleted_memory_count' in result && typeof result.deleted_memory_count === 'number') {
    return result.deleted_memory_count;
  }
  if ('deleted_count' in result && typeof result.deleted_count === 'number') {
    return result.deleted_count;
  }
  return 0;
}

export default function UploadedDocumentsList({
  agentId,
  className = '',
  conversationId,
  description = 'Recently uploaded files available to this context.',
  emptyMessage = 'No uploaded documents yet.',
  limit = 100,
  scope,
  showActions = true,
  tagFilter,
  title = 'Uploaded documents',
  workflowId,
  workspaceId,
}: UploadedDocumentsListProps) {
  const queryClient = useQueryClient();
  const queryTags = useMemo(() => (tagFilter ? [tagFilter] : undefined), [tagFilter]);
  const enabled =
    (scope === 'user' && (!agentId || agentId.trim().length > 0)) ||
    (scope === 'workspace' && Boolean(workspaceId?.trim())) ||
    (scope === 'conversation' && Boolean(conversationId?.trim())) ||
    (scope === 'workflow' && Boolean(workflowId?.trim()));

  const query = useQuery({
    queryKey: [
      ...queryKeys.backendMemories(),
      'uploaded-documents',
      scope,
      workspaceId ?? '',
      conversationId ?? '',
      workflowId ?? '',
      agentId ?? '',
      tagFilter ?? '',
      limit,
    ],
    enabled,
    queryFn: async () => {
      const [documentsResponse, memoriesResponse] = await Promise.all([
        documentsApi.listDocuments({
          scope,
          workspaceId: workspaceId || undefined,
          conversationId: conversationId || undefined,
          workflowId: workflowId || undefined,
          agentId: agentId || undefined,
          limit,
        }),
        memoriesApi.listMemories({
          scope,
          workspace_id: workspaceId || undefined,
          conversation_id: conversationId || undefined,
          workflow_id: workflowId || undefined,
          agent_id: agentId || undefined,
          source: 'document_upload',
          memory_type: ['archive'],
          tags: queryTags,
          status: ['active'],
          limit,
        }),
      ]);
      return summarizeUploadedDocuments(documentsResponse.items, memoriesResponse.items, tagFilter);
    },
  });

  const deleteMutation = useMutation<
    UploadedDocumentDeleteResponse | MemoryDocumentDeleteResponse,
    Error,
    UploadedDocumentSummary
  >({
    mutationFn: (document: UploadedDocumentSummary) => {
      if (document.hasUploadedDocument) {
        return documentsApi.deleteDocument(document.documentId);
      }
      return memoriesApi.deleteDocumentMemories(document.documentId, {
        scope,
        workspace_id: workspaceId || undefined,
        conversation_id: conversationId || undefined,
        workflow_id: workflowId || undefined,
        agent_id: agentId || undefined,
        tags: queryTags,
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() });
      const removedChunks = deletedMemoryCount(result);
      const message =
        removedChunks > 0
          ? `Removed document and ${removedChunks} retrieval chunk${removedChunks === 1 ? '' : 's'}.`
          : 'Removed uploaded document.';
      toast.success(message, {
        position: 'top-right',
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to remove document memories.', {
        position: 'top-right',
      });
    },
  });

  const documentSummaries = useMemo(() => {
    return query.data ?? [];
  }, [query.data]);

  const handleDelete = (document: UploadedDocumentSummary) => {
    const target =
      document.mode === 'context'
        ? 'Remove this context-only upload? Its extracted text will no longer be available to this chat.'
        : `Remove ${document.filename}? This deletes the uploaded document${
            document.chunkCount > 0
              ? ` and ${document.chunkCount} retrieval chunk${document.chunkCount === 1 ? '' : 's'}`
              : ''
          }.`;
    if (!window.confirm(target)) {
      return;
    }
    deleteMutation.mutate(document);
  };

  return (
    <section className={`space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-teal-300/14 dark:bg-[linear-gradient(180deg,rgba(11,28,33,0.84),rgba(8,18,31,0.92))] ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{description}</p>
        </div>
        {showActions ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!enabled || query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
            title="Refresh uploaded documents"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        ) : null}
      </div>

      {!enabled ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Select a context before viewing uploads.</p>
      ) : query.isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading uploaded documents...</p>
      ) : query.isError ? (
        <p className="text-sm text-red-600 dark:text-red-300">Failed to load uploaded documents.</p>
      ) : documentSummaries.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {documentSummaries.map((document) => (
            <div
              key={document.documentId}
              className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-slate-950/72"
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {document.filename}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{documentDetailText(document)}</p>
                    {documentObservabilityText(document) ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {documentObservabilityText(document)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Badge variant="outline" className={uploadModeBadgeClass(document.mode)}>
                  {uploadModeLabel(document.mode)}
                </Badge>
                {document.source ? (
                  <span
                    className="max-w-52 truncate text-xs text-slate-500 dark:text-slate-400"
                    title={document.source}
                  >
                    {document.source}
                  </span>
                ) : null}
                {showActions && (document.hasUploadedDocument || document.chunkCount > 0) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(document)}
                    title="Remove uploaded document"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
              {document.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {document.tags.slice(0, 6).map((tag) => (
                    <Badge key={tag} variant="outline" className="bg-white dark:border-white/10 dark:bg-white/6 dark:text-slate-200">
                      {tag}
                    </Badge>
                  ))}
                  {document.tags.length > 6 ? (
                    <Badge variant="secondary">+{document.tags.length - 6}</Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
