'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, RefreshCw, Search, Trash2, X } from 'lucide-react';
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
import { Input } from '@/components/library/shadcn/input';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import { AppInlineState } from '@/components/app-shell/AppState';
import { appFeedback } from '@/lib/appFeedback';

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

interface BulkDocumentDeleteResult {
  failed: Array<{ document: UploadedDocumentSummary; error: unknown }>;
  removed: Array<{
    document: UploadedDocumentSummary;
    result: UploadedDocumentDeleteResponse | MemoryDocumentDeleteResponse;
  }>;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
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

  const deleteDocument = (document: UploadedDocumentSummary) => {
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
  };

  const deleteMutation = useMutation<
    UploadedDocumentDeleteResponse | MemoryDocumentDeleteResponse,
    Error,
    UploadedDocumentSummary
  >({
    mutationFn: deleteDocument,
    onSuccess: async (result, document) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() });
      setSelectedDocumentIds((current) =>
        current.filter((documentId) => documentId !== document.documentId)
      );
      const removedChunks = deletedMemoryCount(result);
      const message =
        removedChunks > 0
          ? `Removed document and ${removedChunks} retrieval chunk${removedChunks === 1 ? '' : 's'}.`
          : 'Removed uploaded document.';
      appFeedback.success(message);
    },
    onError: (error, document) => {
      appFeedback.error('Document could not be removed.', {
        description:
          error instanceof Error ? error.message : 'Failed to remove the uploaded document.',
        action: {
          label: 'Retry',
          onClick: () => deleteMutation.mutate(document),
        },
      });
    },
  });

  const bulkDeleteMutation = useMutation<
    BulkDocumentDeleteResult,
    Error,
    UploadedDocumentSummary[]
  >({
    mutationFn: async (documents) => {
      const settled = await Promise.allSettled(documents.map(deleteDocument));
      return settled.reduce<BulkDocumentDeleteResult>(
        (summary, result, index) => {
          const document = documents[index];
          if (result.status === 'fulfilled') {
            summary.removed.push({ document, result: result.value });
          } else {
            summary.failed.push({ document, error: result.reason });
          }
          return summary;
        },
        { failed: [], removed: [] }
      );
    },
    onSuccess: async ({ failed, removed }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() });
      const removedIdSet = new Set(removed.map(({ document }) => document.documentId));
      setSelectedDocumentIds((current) =>
        current.filter((documentId) => !removedIdSet.has(documentId))
      );
      const removedChunks = removed.reduce(
        (total, item) => total + deletedMemoryCount(item.result),
        0
      );

      if (failed.length > 0) {
        const firstError = failed[0]?.error;
        appFeedback.warning(`${removed.length} removed, ${failed.length} could not be removed.`, {
          description:
            firstError instanceof Error
              ? firstError.message
              : 'Retry the remaining selected documents.',
          action: {
            label: 'Retry failed',
            onClick: () => bulkDeleteMutation.mutate(failed.map(({ document }) => document)),
          },
        });
        return;
      }

      appFeedback.success(
        `Removed ${removed.length} document${removed.length === 1 ? '' : 's'}.`,
        removedChunks > 0
          ? {
              description: `${removedChunks} retrieval chunk${removedChunks === 1 ? '' : 's'} also removed.`,
            }
          : undefined
      );
    },
  });

  const documentSummaries = useMemo(() => {
    return query.data ?? [];
  }, [query.data]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredDocuments = useMemo(
    () =>
      normalizedSearchQuery
        ? documentSummaries.filter((document) =>
            [document.filename, document.source, ...document.tags]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(normalizedSearchQuery)
          )
        : documentSummaries,
    [documentSummaries, normalizedSearchQuery]
  );
  const selectedDocumentIdSet = useMemo(() => new Set(selectedDocumentIds), [selectedDocumentIds]);
  const selectedDocuments = useMemo(
    () => documentSummaries.filter((document) => selectedDocumentIdSet.has(document.documentId)),
    [documentSummaries, selectedDocumentIdSet]
  );
  const selectableVisibleDocuments = filteredDocuments.filter(
    (document) => document.hasUploadedDocument || document.chunkCount > 0
  );
  const allVisibleSelected =
    selectableVisibleDocuments.length > 0 &&
    selectableVisibleDocuments.every((document) => selectedDocumentIdSet.has(document.documentId));
  const deletionPending = deleteMutation.isPending || bulkDeleteMutation.isPending;
  const toggleDocumentSelection = (documentId: string, checked: boolean) => {
    setSelectedDocumentIds((current) =>
      checked
        ? Array.from(new Set([...current, documentId]))
        : current.filter((value) => value !== documentId)
    );
  };
  const toggleVisibleSelection = (checked: boolean) => {
    const visibleIds = selectableVisibleDocuments.map((document) => document.documentId);
    setSelectedDocumentIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...visibleIds]));
      }
      const visibleIdSet = new Set(visibleIds);
      return current.filter((documentId) => !visibleIdSet.has(documentId));
    });
  };

  return (
    <section
      className={`space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-teal-300/14 dark:bg-[linear-gradient(180deg,rgba(11,28,33,0.84),rgba(8,18,31,0.92))] ${className}`}
    >
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

      {enabled && !query.isLoading && !query.isError && documentSummaries.length > 0 ? (
        <div className="flex flex-col gap-2 border-y border-(--agency-shell-border) py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block min-w-0 flex-1 sm:max-w-sm">
            <span className="sr-only">Search uploaded documents</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--agency-shell-muted)"
              aria-hidden="true"
            />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search documents"
              className="h-9 pl-9 pr-9"
            />
            {searchQuery ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear document search"
                className="absolute right-0.5 top-1/2 size-8 -translate-y-1/2"
                onClick={() => setSearchQuery('')}
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
          </label>
          {showActions && selectableVisibleDocuments.length > 0 ? (
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-xs font-medium text-(--agency-shell-muted) hover:bg-(--agency-row-hover)">
              <input
                type="checkbox"
                aria-label="Select all visible documents"
                checked={allVisibleSelected}
                onChange={(event) => toggleVisibleSelection(event.target.checked)}
                className="size-4 rounded border-(--agency-shell-border) accent-primary"
              />
              {selectedDocuments.length > 0
                ? `${selectedDocuments.length} selected`
                : 'Select visible'}
            </label>
          ) : null}
        </div>
      ) : null}

      {selectedDocuments.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-primary-200 bg-primary-50/55 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-primary-300/18 dark:bg-primary-500/10">
          <div>
            <p className="text-sm font-semibold text-(--agency-shell-text)">
              {selectedDocuments.length} document{selectedDocuments.length === 1 ? '' : 's'}{' '}
              selected
            </p>
            <p className="mt-0.5 text-xs text-(--agency-shell-muted)">
              Bulk removal also deletes retrieval chunks linked to these uploads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deletionPending}
              onClick={() => setSelectedDocumentIds([])}
            >
              Clear selection
            </Button>
            <ConfirmActionDialog
              trigger={
                <Button type="button" variant="destructive" size="sm" disabled={deletionPending}>
                  <Trash2 className="mr-2 size-4" aria-hidden="true" />
                  Remove selected
                </Button>
              }
              title={`Remove ${selectedDocuments.length} selected document${selectedDocuments.length === 1 ? '' : 's'}?`}
              description="This permanently removes the selected uploads and any linked retrieval chunks from this context."
              cancelLabel="Keep documents"
              confirmLabel="Remove documents"
              pendingLabel="Removing..."
              pending={bulkDeleteMutation.isPending}
              destructive
              onConfirm={() => bulkDeleteMutation.mutate(selectedDocuments)}
            />
          </div>
        </div>
      ) : null}

      {!enabled ? (
        <AppInlineState
          variant="empty"
          title="Choose a context"
          description="Select an agent, workflow, conversation, or workspace before viewing its uploads."
        />
      ) : query.isLoading ? (
        <AppInlineState
          variant="loading"
          title="Loading documents"
          description="Reading uploaded files and their retrieval status."
        />
      ) : query.isError ? (
        <AppInlineState
          variant="error"
          title="Documents unavailable"
          description="Open Agency could not load uploads for this context. Other agent or workflow settings remain usable."
          onAction={() => void query.refetch()}
        />
      ) : documentSummaries.length === 0 ? (
        <AppInlineState variant="empty" title={emptyMessage} />
      ) : filteredDocuments.length === 0 ? (
        <AppInlineState
          variant="empty"
          title="No matching documents"
          description={`No uploads match “${searchQuery.trim()}”. Clear the search to see every document.`}
        />
      ) : (
        <div className="space-y-2" role="list" aria-label={title}>
          {filteredDocuments.map((document) => (
            <div
              key={document.documentId}
              role="listitem"
              className="min-w-0 rounded-lg border border-(--agency-shell-border) bg-(--agency-shell-panel) px-3 py-3 transition-colors hover:bg-(--agency-row-hover)"
            >
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="flex min-w-0 items-start gap-2.5">
                  {showActions && (document.hasUploadedDocument || document.chunkCount > 0) ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${document.filename}`}
                      checked={selectedDocumentIdSet.has(document.documentId)}
                      onChange={(event) =>
                        toggleDocumentSelection(document.documentId, event.target.checked)
                      }
                      className="mt-1 size-4 shrink-0 rounded border-(--agency-shell-border) accent-primary"
                    />
                  ) : null}
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {document.filename}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {documentDetailText(document)}
                    </p>
                    {documentObservabilityText(document) ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {documentObservabilityText(document)}
                      </p>
                    ) : null}
                    {document.source ? (
                      <p
                        className="mt-1 max-w-xl truncate text-xs text-slate-500 dark:text-slate-400"
                        title={document.source}
                      >
                        {document.source}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Badge variant="outline" className={uploadModeBadgeClass(document.mode)}>
                    {uploadModeLabel(document.mode)}
                  </Badge>
                  {showActions && (document.hasUploadedDocument || document.chunkCount > 0) ? (
                    <ConfirmActionDialog
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={deletionPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      }
                      title={`Remove ${document.filename}?`}
                      description={
                        document.mode === 'context'
                          ? 'This permanently removes the upload and its extracted text from this conversation.'
                          : `This permanently removes the uploaded document${
                              document.chunkCount > 0
                                ? ` and ${document.chunkCount} linked retrieval chunk${document.chunkCount === 1 ? '' : 's'}`
                                : ''
                            } from this context.`
                      }
                      cancelLabel="Keep document"
                      confirmLabel="Remove document"
                      pendingLabel="Removing..."
                      pending={deleteMutation.isPending}
                      destructive
                      onConfirm={() => deleteMutation.mutate(document)}
                    />
                  ) : null}
                </div>
              </div>
              {document.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {document.tags.slice(0, 6).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="bg-white dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
                    >
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
