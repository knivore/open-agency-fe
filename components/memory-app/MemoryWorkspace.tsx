'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BrainCircuit,
  CalendarRange,
  Ban,
  Copy,
  DatabaseZap,
  ExternalLink,
  Eye,
  FileText,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { agentsApi } from '@/lib/api/backend/agents';
import { conversationsApi } from '@/lib/api/backend/conversations';
import { documentsApi } from '@/lib/api/backend/documents';
import { memoriesApi } from '@/lib/api/backend/memory';
import { usersApi } from '@/lib/api/backend/users';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { isApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/react-query/queryKeys';
import DocumentIngestionControl from '@/components/memory-app/DocumentIngestionControl';
import PageHeader from '@/components/app-shell/PageHeader';
import type { AgentDefinition } from '@/types/agents';
import type { JsonObject } from '@/types/api';
import { MEMORY_TYPES, memoryTypeDescription, memoryTypeLabel } from '@/types/memory';
import type {
  Conversation,
  ConversationCompactMode,
  ConversationCompactResponse,
  ConversationCompactSourceRange,
  ConversationCompactStrategy,
} from '@/types/conversations';
import type {
  CompactBackfillMode,
  CompactBackfillResult,
  CompactBackfillSourceRange,
  CompactBackfillStrategy,
  DailySummaryBackfillResult,
  DailySummaryBackfillPayload,
  DailySummaryRunResult,
  DailySummaryRunPayload,
  MemoryExclusion,
  MemoryExclusionTargetType,
  MemoryCatalogItem,
  MemoryType,
  MemoryRecord,
  MemoryScope,
  MemoryStatus,
  WorkflowMemoryLinkTargetType,
} from '@/types/memory';
import type { WorkflowDefinition } from '@/types/workflows';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import { Badge } from '@/components/library/shadcn/badge';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/library/shadcn/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/library/shadcn/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/library/shadcn/tabs';
import { Textarea } from '@/components/library/shadcn/textarea';

const scopes: MemoryScope[] = ['user', 'workspace', 'conversation', 'workflow', 'global'];
const memoryStatuses: MemoryStatus[] = ['active', 'archived', 'superseded'];
const compactModes: CompactBackfillMode[] = [
  'brief',
  'handoff',
  'memory',
  'workflow',
  'technical',
  'archive',
  'custom',
];
const compactStrategies: CompactBackfillStrategy[] = ['auto', 'deterministic', 'llm'];
const compactSourceRanges: CompactBackfillSourceRange[] = [
  'full',
  'since_last_compact',
  'selected',
  'older_than_recent',
];
const memoryModeOptions = [
  'brief',
  'handoff',
  'memory',
  'workflow',
  'technical',
  'archive',
  'custom',
];
const exclusionTargetTypes: MemoryExclusionTargetType[] = [
  'global',
  'workflow',
  'agent',
  'task',
  'conversation',
  'run',
];
const preferenceTemplates = [
  {
    key: 'timezone',
    label: 'Timezone',
    placeholder: 'Asia/Singapore',
    summaryPrefix: 'Timezone preference',
    contentPrefix: 'User timezone preference is',
    tags: ['preference', 'timezone'],
  },
  {
    key: 'tone',
    label: 'Response tone',
    placeholder: 'Concise and direct',
    summaryPrefix: 'Preferred response tone',
    contentPrefix: 'User prefers responses in a',
    tags: ['preference', 'tone'],
  },
  {
    key: 'language',
    label: 'Preferred language',
    placeholder: 'English',
    summaryPrefix: 'Preferred language',
    contentPrefix: 'User prefers communication in',
    tags: ['preference', 'language'],
  },
  {
    key: 'formatting',
    label: 'Formatting preference',
    placeholder: 'Short bullets with clear headings',
    summaryPrefix: 'Formatting preference',
    contentPrefix: 'User prefers output formatted as',
    tags: ['preference', 'formatting'],
  },
  {
    key: 'monitoring_policy',
    label: 'Monitoring policy',
    placeholder: 'Escalate stalled runs after 20 minutes and propose the smallest safe recovery',
    summaryPrefix: 'Monitoring preference',
    contentPrefix: 'User monitoring preference is',
    tags: ['preference', 'monitoring', 'main-agent'],
  },
] as const;
const workspaceNoteCategories = [
  { key: 'policy', label: 'Policy note', tags: ['workspace', 'policy'] },
  { key: 'project', label: 'Project context', tags: ['workspace', 'project'] },
  { key: 'handoff', label: 'Handoff note', tags: ['workspace', 'handoff'] },
  { key: 'playbook', label: 'Playbook note', tags: ['workspace', 'playbook'] },
] as const;

type GuidedAction =
  | 'preference'
  | 'workspace_note'
  | 'decision'
  | 'task_commitment'
  | 'custom_memory'
  | 'correct_memory';
type MemoryOpsTab = 'browse' | 'create' | 'ingest' | 'compact' | 'summaries' | 'maintenance';

function titleCase(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function scopeLabel(scope: MemoryScope) {
  return scope.charAt(0).toUpperCase() + scope.slice(1);
}

function embeddingLabel(memory: MemoryRecord) {
  if (!memory.embedding_model_profile_id) {
    return 'Not embedded';
  }
  const dimensions = memory.embedding_dimensions ? `${memory.embedding_dimensions}d` : 'vector';
  return `${memory.embedding_model ?? 'Embedding'} (${dimensions})`;
}

function memoryMode(memory: MemoryRecord) {
  const metadataMode = memory.metadata?.mode;
  if (typeof metadataMode === 'string' && metadataMode.trim()) {
    return metadataMode.trim();
  }
  const knownModes = new Set(memoryModeOptions);
  return memory.tags.find((tag) => knownModes.has(tag)) ?? null;
}

function memoryDocumentId(memory: MemoryRecord) {
  const value = memory.metadata?.document_id;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function memoryDocumentFilename(memory: MemoryRecord) {
  const value = memory.metadata?.filename;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function memoryExclusions(memory: MemoryRecord): MemoryExclusion[] {
  const rawExclusions = memory.metadata?.exclusions;
  if (!Array.isArray(rawExclusions)) {
    return [];
  }
  return rawExclusions
    .filter(
      (item): item is JsonObject =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    )
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      memoryId: memory.id,
      targetType:
        typeof item.target_type === 'string'
          ? (item.target_type as MemoryExclusionTargetType)
          : 'global',
      targetId: typeof item.target_id === 'string' ? item.target_id : null,
      reason: typeof item.reason === 'string' ? item.reason : null,
      createdAt: typeof item.created_at === 'string' ? item.created_at : null,
      updatedAt: typeof item.updated_at === 'string' ? item.updated_at : null,
    }))
    .filter((item) => Boolean(item.id));
}

function metadataPreview(memory: MemoryRecord) {
  return JSON.stringify(memory.metadata ?? {}, null, 2);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

function agentLabel(agent: AgentDefinition) {
  return agent.name ? `${agent.name} (${agent.id})` : agent.id;
}

function parseTagList(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function MemoryEmbeddingPanel({
  memories,
  onBackfilled,
  onOpenMemory,
}: {
  memories: MemoryRecord[];
  onBackfilled: () => Promise<void> | void;
  onOpenMemory: (memoryId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const embeddedCount = memories.filter((memory) =>
    Boolean(memory.embedding_model_profile_id)
  ).length;
  const pendingCount = Math.max(memories.length - embeddedCount, 0);
  const modelDistribution = Array.from(
    memories.reduce((counts, memory) => {
      const model = memory.embedding_model || 'Unembedded';
      counts.set(model, (counts.get(model) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())
  ).sort(([left], [right]) => left.localeCompare(right));
  const sensitiveMemories = memories
    .filter((memory) => memory.sensitive)
    .sort(
      (left, right) =>
        new Date(right.updated_at ?? 0).getTime() - new Date(left.updated_at ?? 0).getTime()
    )
    .slice(0, 8);
  const supersededCompactPacks = memories
    .filter(
      (memory) =>
        memory.status === 'superseded' &&
        (memory.memory_type === 'context_pack' || memory.source === 'compact_tool')
    )
    .sort(
      (left, right) =>
        new Date(right.updated_at ?? 0).getTime() - new Date(left.updated_at ?? 0).getTime()
    )
    .slice(0, 8);
  const orphanedDocumentChunks = memories
    .filter((memory) => memory.source === 'document_upload' && !memoryDocumentId(memory))
    .sort(
      (left, right) =>
        new Date(right.updated_at ?? 0).getTime() - new Date(left.updated_at ?? 0).getTime()
    )
    .slice(0, 8);

  const runBackfill = (force: boolean) => {
    if (
      force &&
      !window.confirm(
        'Rebuild vectors for all loaded memories? This can be slow and will replace existing embeddings.'
      )
    ) {
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const result = await memoriesApi.backfillEmbeddings({ limit: 250, force });
          await onBackfilled();
          toast.success(
            `Embedding backfill updated ${result.updated}, skipped ${result.skipped}, failed ${result.failed}.`,
            { position: 'top-right' }
          );
        } catch (backfillError) {
          setError(
            backfillError instanceof Error
              ? backfillError.message
              : 'Failed to backfill embeddings.'
          );
        }
      })();
    });
  };

  return (
    <div className="space-y-5">
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DatabaseZap className="h-5 w-5" />
            Vector retrieval
          </CardTitle>
          <CardDescription>
            Uses the backend embedding model profile when `MEMORY_EMBEDDING_MODEL_PROFILE_ID` is
            configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Vectorized
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{embeddedCount}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Missing vector
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingCount}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Embedding distribution
              </p>
              <p className="mt-1 text-sm text-slate-800">
                {modelDistribution.length
                  ? modelDistribution.map(([model, count]) => `${model}: ${count}`).join(', ')
                  : 'None stored yet'}
              </p>
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Rebuild all vectors can be slow and replaces existing embedding rows for the loaded
            slice. Prefer backfilling missing vectors for routine maintenance.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => runBackfill(false)}
            >
              {isPending ? 'Backfilling...' : 'Backfill missing vectors'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => runBackfill(true)}
            >
              Rebuild all vectors
            </Button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <MaintenanceReviewCard
          title="Sensitive memories"
          description="Records flagged sensitive in the current result set."
          memories={sensitiveMemories}
          emptyLabel="No sensitive memories loaded."
          onOpenMemory={onOpenMemory}
        />
        <MaintenanceReviewCard
          title="Superseded compact packs"
          description="Old context packs that have been replaced by newer packs."
          memories={supersededCompactPacks}
          emptyLabel="No superseded compact packs loaded."
          onOpenMemory={onOpenMemory}
        />
        <MaintenanceReviewCard
          title="Orphaned document chunks"
          description="Document upload chunks missing a document id in metadata."
          memories={orphanedDocumentChunks}
          emptyLabel="No orphaned document chunks loaded."
          onOpenMemory={onOpenMemory}
        />
      </div>
    </div>
  );
}

function MaintenanceReviewCard({
  title,
  description,
  memories,
  emptyLabel,
  onOpenMemory,
}: {
  title: string;
  description: string;
  memories: MemoryRecord[];
  emptyLabel: string;
  onOpenMemory: (memoryId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {memories.length === 0 ? (
          <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-4 text-sm text-neutral-500">
            {emptyLabel}
          </p>
        ) : (
          <div className="space-y-3">
            {memories.map((memory) => (
              <div key={memory.id} className="rounded-md border border-neutral-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {memory.memory_type ? (
                    <Badge variant="outline">{memoryTypeLabel(memory.memory_type)}</Badge>
                  ) : null}
                  {memory.status ? (
                    <Badge variant={memory.status === 'active' ? 'successful' : 'secondary'}>
                      {titleCase(memory.status)}
                    </Badge>
                  ) : null}
                  {memory.sensitive ? <Badge variant="destructive">Sensitive</Badge> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium text-neutral-900">
                  {memory.summary || memory.content || memory.id}
                </p>
                <p className="mt-1 truncate text-xs text-neutral-500">{memory.id}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-neutral-500">
                    Updated {formatDateTime(memory.updated_at)}
                  </span>
                  <Button type="button" variant="outline" onClick={() => onOpenMemory(memory.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GuidedMemoryActions({
  agents,
  conversations,
  memories,
  workflows,
  onCreated,
}: {
  agents: AgentDefinition[];
  conversations: Conversation[];
  memories: MemoryRecord[];
  workflows: WorkflowDefinition[];
  onCreated: () => Promise<void> | void;
}) {
  const [action, setAction] = useState<GuidedAction>('preference');
  const [preferenceTemplateKey, setPreferenceTemplateKey] =
    useState<(typeof preferenceTemplates)[number]['key']>('timezone');
  const [preferenceValue, setPreferenceValue] = useState('');
  const [preferenceAgentId, setPreferenceAgentId] = useState('');
  const [preferenceImportance, setPreferenceImportance] = useState('70');
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceCategoryKey, setWorkspaceCategoryKey] =
    useState<(typeof workspaceNoteCategories)[number]['key']>('project');
  const [workspaceTitle, setWorkspaceTitle] = useState('');
  const [workspaceNote, setWorkspaceNote] = useState('');
  const [workspaceImportance, setWorkspaceImportance] = useState('60');
  const [decisionSummary, setDecisionSummary] = useState('');
  const [decisionContent, setDecisionContent] = useState('');
  const [decisionWorkflowId, setDecisionWorkflowId] = useState('');
  const [decisionConversationId, setDecisionConversationId] = useState('');
  const [decisionImportance, setDecisionImportance] = useState('75');
  const [taskSummary, setTaskSummary] = useState('');
  const [taskContent, setTaskContent] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskAgentId, setTaskAgentId] = useState('');
  const [taskWorkflowId, setTaskWorkflowId] = useState('');
  const [taskConversationId, setTaskConversationId] = useState('');
  const [taskImportance, setTaskImportance] = useState('70');
  const [customScope, setCustomScope] = useState<MemoryScope>('user');
  const [customType, setCustomType] = useState<MemoryType>('fact');
  const [customSummary, setCustomSummary] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [customTags, setCustomTags] = useState('');
  const [customImportance, setCustomImportance] = useState('50');
  const [customSensitive, setCustomSensitive] = useState(false);
  const [customAgentId, setCustomAgentId] = useState('');
  const [customWorkflowId, setCustomWorkflowId] = useState('');
  const [customConversationId, setCustomConversationId] = useState('');
  const [selectedMemoryId, setSelectedMemoryId] = useState('');
  const [correctedSummary, setCorrectedSummary] = useState('');
  const [correctedContent, setCorrectedContent] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedPreferenceTemplate =
    preferenceTemplates.find((item) => item.key === preferenceTemplateKey) ??
    preferenceTemplates[0];
  const selectedWorkspaceCategory =
    workspaceNoteCategories.find((item) => item.key === workspaceCategoryKey) ??
    workspaceNoteCategories[0];
  const editableMemories = useMemo(
    () => memories.filter((memory) => memory.status !== 'superseded'),
    [memories]
  );
  const selectedMemory = useMemo(
    () => editableMemories.find((memory) => memory.id === selectedMemoryId) ?? null,
    [editableMemories, selectedMemoryId]
  );
  const resetShared = () => {
    setConfirmed(false);
    setError(null);
  };

  const handleCorrectionTargetChange = (memoryId: string) => {
    const nextMemory = editableMemories.find((memory) => memory.id === memoryId) ?? null;
    setSelectedMemoryId(memoryId);
    setCorrectedSummary(nextMemory?.summary ?? '');
    setCorrectedContent(nextMemory?.content ?? '');
  };

  const handleSavePreference = () => {
    const selectedAgentId = preferenceAgentId.trim();
    const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await memoriesApi.createMemory({
            confirmed,
            memory: {
              scope: 'user',
              memory_type: 'preference',
              importance: Number(preferenceImportance) || 70,
              summary: `${selectedPreferenceTemplate.summaryPrefix}: ${preferenceValue.trim()}`,
              content: `${selectedPreferenceTemplate.contentPrefix} ${preferenceValue.trim()}.`,
              agent_id: selectedAgentId || undefined,
              tags: [
                ...selectedPreferenceTemplate.tags,
                ...(selectedAgent ? ['agent-preference', `agent:${selectedAgent.id}`] : []),
              ],
            },
          });
          await onCreated();
          setPreferenceValue('');
          setPreferenceAgentId('');
          resetShared();
          toast.success('Preference saved.', { position: 'top-right' });
        } catch (createError) {
          setError(
            createError instanceof Error ? createError.message : 'Failed to save preference.'
          );
        }
      })();
    });
  };

  const handleSaveWorkspaceNote = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await memoriesApi.createMemory({
            confirmed,
            memory: {
              scope: 'workspace',
              workspace_id: workspaceId.trim(),
              memory_type: 'fact',
              importance: Number(workspaceImportance) || 60,
              summary: workspaceTitle.trim(),
              content: workspaceNote.trim(),
              tags: [...selectedWorkspaceCategory.tags, selectedWorkspaceCategory.key],
            },
          });
          await onCreated();
          setWorkspaceTitle('');
          setWorkspaceNote('');
          setWorkspaceId('');
          resetShared();
          toast.success('Workspace note saved.', { position: 'top-right' });
        } catch (createError) {
          setError(
            createError instanceof Error ? createError.message : 'Failed to save workspace note.'
          );
        }
      })();
    });
  };

  const handleSaveDecision = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await memoriesApi.createMemory({
            confirmed,
            memory: {
              scope: decisionWorkflowId
                ? 'workflow'
                : decisionConversationId
                  ? 'conversation'
                  : 'workspace',
              workflow_id: decisionWorkflowId || undefined,
              conversation_id: decisionConversationId || undefined,
              memory_type: 'decision',
              importance: Number(decisionImportance) || 75,
              summary: decisionSummary.trim(),
              content: decisionContent.trim(),
              tags: ['decision', 'operator-created'],
            },
          });
          await onCreated();
          setDecisionSummary('');
          setDecisionContent('');
          setDecisionWorkflowId('');
          setDecisionConversationId('');
          resetShared();
          toast.success('Decision memory saved.', { position: 'top-right' });
        } catch (createError) {
          setError(createError instanceof Error ? createError.message : 'Failed to save decision.');
        }
      })();
    });
  };

  const handleSaveTaskCommitment = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await memoriesApi.createMemory({
            confirmed,
            memory: {
              scope: taskWorkflowId ? 'workflow' : taskConversationId ? 'conversation' : 'user',
              workflow_id: taskWorkflowId || undefined,
              conversation_id: taskConversationId || undefined,
              agent_id: taskAgentId || undefined,
              memory_type: 'task_commitment',
              importance: Number(taskImportance) || 70,
              summary: taskSummary.trim(),
              content: taskContent.trim(),
              tags: ['task_commitment', 'operator-created'],
              metadata: taskDueDate ? { due_date: taskDueDate } : {},
            },
          });
          await onCreated();
          setTaskSummary('');
          setTaskContent('');
          setTaskDueDate('');
          setTaskAgentId('');
          setTaskWorkflowId('');
          setTaskConversationId('');
          resetShared();
          toast.success('Task commitment saved.', { position: 'top-right' });
        } catch (createError) {
          setError(
            createError instanceof Error ? createError.message : 'Failed to save task commitment.'
          );
        }
      })();
    });
  };

  const handleSaveCustomMemory = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await memoriesApi.createMemory({
            confirmed,
            memory: {
              scope: customScope,
              memory_type: customType,
              importance: Number(customImportance) || 50,
              summary: customSummary.trim() || null,
              content: customContent.trim(),
              sensitive: customSensitive,
              tags: parseTagList(customTags),
              agent_id: customAgentId || undefined,
              workflow_id: customWorkflowId || undefined,
              conversation_id: customConversationId || undefined,
            },
          });
          await onCreated();
          setCustomSummary('');
          setCustomContent('');
          setCustomTags('');
          setCustomSensitive(false);
          setCustomAgentId('');
          setCustomWorkflowId('');
          setCustomConversationId('');
          resetShared();
          toast.success('Custom memory saved.', { position: 'top-right' });
        } catch (createError) {
          setError(
            createError instanceof Error ? createError.message : 'Failed to save custom memory.'
          );
        }
      })();
    });
  };

  const handleCorrectMemory = () => {
    if (!selectedMemory) {
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await memoriesApi.updateMemory(selectedMemory.id, {
            confirmed,
            patch: {
              summary: correctedSummary.trim() || null,
              content: correctedContent.trim(),
            },
          });
          await onCreated();
          resetShared();
          toast.success('Memory corrected.', { position: 'top-right' });
        } catch (updateError) {
          setError(
            updateError instanceof Error ? updateError.message : 'Failed to correct memory.'
          );
        }
      })();
    });
  };

  return (
    <Card className="border-dashed border-neutral-300 bg-neutral-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BrainCircuit className="h-5 w-5" />
          Guided memory actions
        </CardTitle>
        <CardDescription>
          Use task-based flows instead of raw row creation. This keeps memory entry closer to how
          the backend actually uses durable memory.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            ['preference', 'Add preference'],
            ['workspace_note', 'Add workspace note'],
            ['decision', 'Add decision'],
            ['task_commitment', 'Add task commitment'],
            ['custom_memory', 'Advanced custom'],
            ['correct_memory', 'Correct a memory'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setAction(key as GuidedAction);
                setError(null);
              }}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                action === key
                  ? 'agency-gradient border-primary-500 text-white'
                  : 'border-primary-200 bg-white text-slate-700 hover:bg-primary-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {action === 'preference' ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Add preference</p>
              <p className="text-xs text-slate-600">
                Store a reusable user preference without writing raw memory fields manually.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="preference-template">Preference type</Label>
                <select
                  id="preference-template"
                  value={preferenceTemplateKey}
                  onChange={(event) =>
                    setPreferenceTemplateKey(
                      event.target.value as (typeof preferenceTemplates)[number]['key']
                    )
                  }
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {preferenceTemplates.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="preference-value">Value</Label>
                <Input
                  id="preference-value"
                  value={preferenceValue}
                  onChange={(event) => setPreferenceValue(event.target.value)}
                  disabled={isPending}
                  placeholder={selectedPreferenceTemplate.placeholder}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="preference-agent-id">Agent binding</Label>
                <select
                  id="preference-agent-id"
                  value={preferenceAgentId}
                  onChange={(event) => setPreferenceAgentId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Any agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agentLabel(agent)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preference-importance">Importance</Label>
                <Input
                  id="preference-importance"
                  type="number"
                  min={0}
                  max={100}
                  value={preferenceImportance}
                  onChange={(event) => setPreferenceImportance(event.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={isPending || !preferenceValue.trim()}
              onClick={handleSavePreference}
            >
              {isPending ? 'Saving...' : 'Save preference'}
            </Button>
          </div>
        ) : null}

        {action === 'workspace_note' ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Add workspace note</p>
              <p className="text-xs text-slate-600">
                Capture stable workspace context with structured category and title fields.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="workspace-note-id">Workspace ID</Label>
                <Input
                  id="workspace-note-id"
                  value={workspaceId}
                  onChange={(event) => setWorkspaceId(event.target.value)}
                  disabled={isPending}
                  placeholder="workspace-123"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workspace-note-category">Category</Label>
                <select
                  id="workspace-note-category"
                  value={workspaceCategoryKey}
                  onChange={(event) =>
                    setWorkspaceCategoryKey(
                      event.target.value as (typeof workspaceNoteCategories)[number]['key']
                    )
                  }
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {workspaceNoteCategories.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workspace-note-importance">Importance</Label>
                <Input
                  id="workspace-note-importance"
                  type="number"
                  min={0}
                  max={100}
                  value={workspaceImportance}
                  onChange={(event) => setWorkspaceImportance(event.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workspace-note-title">Short title</Label>
              <Input
                id="workspace-note-title"
                value={workspaceTitle}
                onChange={(event) => setWorkspaceTitle(event.target.value)}
                disabled={isPending}
                placeholder="Use DB-backed memory for rollout continuity"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workspace-note-content">Workspace note</Label>
              <Textarea
                id="workspace-note-content"
                value={workspaceNote}
                onChange={(event) => setWorkspaceNote(event.target.value)}
                disabled={isPending}
                placeholder="Describe the durable note the agent should reuse later."
              />
            </div>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={
                isPending || !workspaceId.trim() || !workspaceTitle.trim() || !workspaceNote.trim()
              }
              onClick={handleSaveWorkspaceNote}
            >
              {isPending ? 'Saving...' : 'Save workspace note'}
            </Button>
          </div>
        ) : null}

        {action === 'decision' ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Add decision</p>
              <p className="text-xs text-slate-600">
                Capture a durable decision with optional workflow or conversation binding.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="decision-workflow">Workflow binding</Label>
                <select
                  id="decision-workflow"
                  value={decisionWorkflowId}
                  onChange={(event) => setDecisionWorkflowId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name ? `${workflow.name} (${workflow.id})` : workflow.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decision-conversation">Conversation binding</Label>
                <select
                  id="decision-conversation"
                  value={decisionConversationId}
                  onChange={(event) => setDecisionConversationId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No conversation</option>
                  {conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>
                      {conversationLabel(conversation)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decision-importance">Importance</Label>
                <Input
                  id="decision-importance"
                  type="number"
                  min={0}
                  max={100}
                  value={decisionImportance}
                  onChange={(event) => setDecisionImportance(event.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="decision-summary">Decision summary</Label>
              <Input
                id="decision-summary"
                value={decisionSummary}
                onChange={(event) => setDecisionSummary(event.target.value)}
                disabled={isPending}
                placeholder="Use compact context packs as workflow memory inputs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="decision-content">Decision details</Label>
              <Textarea
                id="decision-content"
                value={decisionContent}
                onChange={(event) => setDecisionContent(event.target.value)}
                disabled={isPending}
                placeholder="Record the decision, rationale, and when an agent should reuse it."
              />
            </div>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={isPending || !decisionSummary.trim() || !decisionContent.trim()}
              onClick={handleSaveDecision}
            >
              {isPending ? 'Saving...' : 'Save decision'}
            </Button>
          </div>
        ) : null}

        {action === 'task_commitment' ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Add task commitment</p>
              <p className="text-xs text-slate-600">
                Store a commitment or follow-up that agents can retrieve as durable memory.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="task-agent">Agent binding</Label>
                <select
                  id="task-agent"
                  value={taskAgentId}
                  onChange={(event) => setTaskAgentId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Any agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agentLabel(agent)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-workflow">Workflow binding</Label>
                <select
                  id="task-workflow"
                  value={taskWorkflowId}
                  onChange={(event) => setTaskWorkflowId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name ? `${workflow.name} (${workflow.id})` : workflow.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due-date">Due date</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-importance">Importance</Label>
                <Input
                  id="task-importance"
                  type="number"
                  min={0}
                  max={100}
                  value={taskImportance}
                  onChange={(event) => setTaskImportance(event.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-conversation">Conversation binding</Label>
              <select
                id="task-conversation"
                value={taskConversationId}
                onChange={(event) => setTaskConversationId(event.target.value)}
                disabled={isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No conversation</option>
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversationLabel(conversation)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-summary">Commitment summary</Label>
              <Input
                id="task-summary"
                value={taskSummary}
                onChange={(event) => setTaskSummary(event.target.value)}
                disabled={isPending}
                placeholder="Follow up on memory ops browser test gaps"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-content">Commitment details</Label>
              <Textarea
                id="task-content"
                value={taskContent}
                onChange={(event) => setTaskContent(event.target.value)}
                disabled={isPending}
              />
            </div>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={isPending || !taskSummary.trim() || !taskContent.trim()}
              onClick={handleSaveTaskCommitment}
            >
              {isPending ? 'Saving...' : 'Save task commitment'}
            </Button>
          </div>
        ) : null}

        {action === 'custom_memory' ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Advanced custom memory</p>
              <p className="text-xs text-slate-600">
                Use the raw memory fields when a focused form does not fit the record.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="custom-scope">Scope</Label>
                <select
                  id="custom-scope"
                  value={customScope}
                  onChange={(event) => setCustomScope(event.target.value as MemoryScope)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {scopes.map((item) => (
                    <option key={item} value={item}>
                      {scopeLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-type">Memory Type</Label>
                <select
                  id="custom-type"
                  value={customType}
                  onChange={(event) => setCustomType(event.target.value as MemoryType)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {MEMORY_TYPES.map((memoryType) => (
                    <option
                      key={memoryType}
                      value={memoryType}
                      title={memoryTypeDescription(memoryType)}
                    >
                      {memoryTypeLabel(memoryType)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500">{memoryTypeDescription(customType)}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-importance">Importance</Label>
                <Input
                  id="custom-importance"
                  type="number"
                  min={0}
                  max={100}
                  value={customImportance}
                  onChange={(event) => setCustomImportance(event.target.value)}
                  disabled={isPending}
                />
              </div>
              <label className="flex items-center gap-2 pt-7 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={customSensitive}
                  onChange={(event) => setCustomSensitive(event.target.checked)}
                  disabled={isPending}
                />
                Sensitive
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="custom-agent">Agent binding</Label>
                <select
                  id="custom-agent"
                  value={customAgentId}
                  onChange={(event) => setCustomAgentId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agentLabel(agent)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-workflow">Workflow binding</Label>
                <select
                  id="custom-workflow"
                  value={customWorkflowId}
                  onChange={(event) => setCustomWorkflowId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name ? `${workflow.name} (${workflow.id})` : workflow.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-conversation">Conversation binding</Label>
                <select
                  id="custom-conversation"
                  value={customConversationId}
                  onChange={(event) => setCustomConversationId(event.target.value)}
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No conversation</option>
                  {conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>
                      {conversationLabel(conversation)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-summary">Summary</Label>
              <Input
                id="custom-summary"
                value={customSummary}
                onChange={(event) => setCustomSummary(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-content">Content</Label>
              <Textarea
                id="custom-content"
                value={customContent}
                onChange={(event) => setCustomContent(event.target.value)}
                disabled={isPending}
                className="min-h-32"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-tags">Tags</Label>
              <Input
                id="custom-tags"
                value={customTags}
                onChange={(event) => setCustomTags(event.target.value)}
                disabled={isPending}
                placeholder="comma, separated, tags"
              />
            </div>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={isPending || !customContent.trim()}
              onClick={handleSaveCustomMemory}
            >
              {isPending ? 'Saving...' : 'Save custom memory'}
            </Button>
          </div>
        ) : null}

        {action === 'correct_memory' ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Correct a memory</p>
              <p className="text-xs text-slate-600">
                Pick an existing memory first, then correct the summary or full details.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="memory-correction-target">Memory to correct</Label>
              <select
                id="memory-correction-target"
                value={selectedMemoryId}
                onChange={(event) => handleCorrectionTargetChange(event.target.value)}
                disabled={isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a memory</option>
                {editableMemories.map((memory) => (
                  <option key={memory.id} value={memory.id}>
                    {memory.summary || memory.content.slice(0, 80)} ({memory.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="memory-correction-summary">Corrected summary</Label>
                <Input
                  id="memory-correction-summary"
                  value={correctedSummary}
                  onChange={(event) => setCorrectedSummary(event.target.value)}
                  disabled={isPending || !selectedMemory}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="memory-correction-type">Current type</Label>
                <Input
                  id="memory-correction-type"
                  value={memoryTypeLabel(selectedMemory?.memory_type)}
                  disabled
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="memory-correction-content">Corrected details</Label>
              <Textarea
                id="memory-correction-content"
                value={correctedContent}
                onChange={(event) => setCorrectedContent(event.target.value)}
                disabled={isPending || !selectedMemory}
              />
            </div>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={isPending || !selectedMemory || !correctedContent.trim()}
              onClick={handleCorrectMemory}
            >
              {isPending ? 'Saving...' : 'Apply correction'}
            </Button>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={isPending}
          />
          Confirm sensitive write or correction when applicable
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function DailySummaryAdminPanel({
  isAdmin,
  onCompleted,
}: {
  isAdmin: boolean;
  onCompleted: () => Promise<void> | void;
}) {
  const [runPayload, setRunPayload] = useState<DailySummaryRunPayload>({
    target_date: '',
    timezone: '',
    conversation_id: '',
    dry_run: false,
  });
  const [backfillPayload, setBackfillPayload] = useState<DailySummaryBackfillPayload>({
    start_date: '',
    end_date: '',
    timezone: '',
    conversation_id: '',
    dry_run: true,
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<DailySummaryRunResult | null>(null);
  const [backfillResult, setBackfillResult] = useState<DailySummaryBackfillResult | null>(null);

  if (!isAdmin) {
    return null;
  }

  const runSingle = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const result = await memoriesApi.runDailySummaries({
            target_date: runPayload.target_date || undefined,
            timezone: runPayload.timezone || undefined,
            conversation_id: runPayload.conversation_id || undefined,
            dry_run: runPayload.dry_run,
          });
          setRunResult(result);
          setBackfillResult(null);
          await onCompleted();
          toast.success(
            `Daily summary run finished with status ${result.status}. Created ${result.created ?? 0}, skipped ${result.skipped ?? 0}.`,
            { position: 'top-right' }
          );
        } catch (runError) {
          setError(runError instanceof Error ? runError.message : 'Failed to run daily summary.');
        }
      })();
    });
  };

  const runBackfill = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const result = await memoriesApi.backfillDailySummaries({
            ...backfillPayload,
            timezone: backfillPayload.timezone || undefined,
            conversation_id: backfillPayload.conversation_id || undefined,
          });
          setBackfillResult(result);
          setRunResult(null);
          await onCompleted();
          toast.success(
            `Backfill finished with status ${result.status}. Processed ${result.processed}, created ${result.created}.`,
            { position: 'top-right' }
          );
        } catch (runError) {
          setError(
            runError instanceof Error ? runError.message : 'Failed to backfill daily summaries.'
          );
        }
      })();
    });
  };

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Daily summary admin actions
        </CardTitle>
        <CardDescription>
          Operational controls for running or backfilling durable `daily_summary` records. Backend
          admin access is still enforced.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Run one summary window</p>
            <p className="text-xs text-slate-600">
              Use this for one target day or one known conversation.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="summary-run-date">Target date</Label>
              <Input
                id="summary-run-date"
                type="date"
                value={runPayload.target_date ?? ''}
                onChange={(event) =>
                  setRunPayload((current) => ({ ...current, target_date: event.target.value }))
                }
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="summary-run-timezone">Timezone</Label>
              <Input
                id="summary-run-timezone"
                value={runPayload.timezone ?? ''}
                onChange={(event) =>
                  setRunPayload((current) => ({ ...current, timezone: event.target.value }))
                }
                disabled={isPending}
                placeholder="Asia/Singapore"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="summary-run-conversation">Conversation ID</Label>
              <Input
                id="summary-run-conversation"
                value={runPayload.conversation_id ?? ''}
                onChange={(event) =>
                  setRunPayload((current) => ({ ...current, conversation_id: event.target.value }))
                }
                disabled={isPending}
                placeholder="Optional narrow target"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={Boolean(runPayload.dry_run)}
              onChange={(event) =>
                setRunPayload((current) => ({ ...current, dry_run: event.target.checked }))
              }
              disabled={isPending}
            />
            Dry run only
          </label>
          <Button type="button" variant="outline" disabled={isPending} onClick={runSingle}>
            {isPending ? 'Running...' : 'Run daily summary'}
          </Button>
        </div>

        <div className="space-y-3 border-t border-amber-200 pt-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Backfill summary range</p>
            <p className="text-xs text-slate-600">
              Use a narrow range first to confirm duplicate suppression and row quality.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="summary-backfill-start">Start date</Label>
              <Input
                id="summary-backfill-start"
                type="date"
                value={backfillPayload.start_date}
                onChange={(event) =>
                  setBackfillPayload((current) => ({ ...current, start_date: event.target.value }))
                }
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="summary-backfill-end">End date</Label>
              <Input
                id="summary-backfill-end"
                type="date"
                value={backfillPayload.end_date}
                onChange={(event) =>
                  setBackfillPayload((current) => ({ ...current, end_date: event.target.value }))
                }
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="summary-backfill-timezone">Timezone</Label>
              <Input
                id="summary-backfill-timezone"
                value={backfillPayload.timezone ?? ''}
                onChange={(event) =>
                  setBackfillPayload((current) => ({ ...current, timezone: event.target.value }))
                }
                disabled={isPending}
                placeholder="Asia/Singapore"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="summary-backfill-conversation">Conversation ID</Label>
              <Input
                id="summary-backfill-conversation"
                value={backfillPayload.conversation_id ?? ''}
                onChange={(event) =>
                  setBackfillPayload((current) => ({
                    ...current,
                    conversation_id: event.target.value,
                  }))
                }
                disabled={isPending}
                placeholder="Optional narrow target"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={Boolean(backfillPayload.dry_run)}
              onChange={(event) =>
                setBackfillPayload((current) => ({ ...current, dry_run: event.target.checked }))
              }
              disabled={isPending}
            />
            Dry run only
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !backfillPayload.start_date || !backfillPayload.end_date}
            onClick={runBackfill}
          >
            {isPending ? 'Backfilling...' : 'Backfill daily summaries'}
          </Button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {runResult ? (
          <DailySummaryRunResultPanel result={runResult} dryRun={Boolean(runPayload.dry_run)} />
        ) : null}
        {backfillResult ? (
          <DailySummaryBackfillResultPanel
            result={backfillResult}
            dryRun={Boolean(backfillPayload.dry_run)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function DailySummaryRunResultPanel({
  result,
  dryRun,
}: {
  result: DailySummaryRunResult;
  dryRun: boolean;
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={dryRun ? 'outline' : 'successful'}>
          {dryRun ? 'Dry run' : 'Persisted'}
        </Badge>
        <Badge variant="secondary">{result.status}</Badge>
        <Badge variant="outline">{result.processed ?? 0} processed</Badge>
        <Badge variant="successful">{result.created ?? 0} created</Badge>
        <Badge variant="outline">{result.skipped ?? 0} skipped</Badge>
        {result.failed ? <Badge variant="destructive">{result.failed} failed</Badge> : null}
      </div>
      <div className="mt-3 grid gap-2 text-sm text-neutral-700 md:grid-cols-3">
        <DetailField label="Target date" value={result.target_date || '—'} />
        <DetailField label="Timezone" value={result.timezone || '—'} />
        <DetailField
          label="Eligible conversations"
          value={result.eligible_conversation_ids?.length ?? 0}
        />
      </div>
      {result.failures?.length ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-neutral-200 bg-neutral-950 p-3 text-xs text-neutral-100">
          {JSON.stringify(result.failures, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function DailySummaryBackfillResultPanel({
  result,
  dryRun,
}: {
  result: DailySummaryBackfillResult;
  dryRun: boolean;
}) {
  return (
    <div className="space-y-3 rounded-md border border-amber-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={dryRun ? 'outline' : 'successful'}>
          {dryRun ? 'Dry run' : 'Persisted'}
        </Badge>
        <Badge variant="secondary">{result.status}</Badge>
        <Badge variant="outline">{result.processed} processed</Badge>
        <Badge variant="successful">{result.created} created</Badge>
        <Badge variant="outline">{result.skipped} skipped</Badge>
        {result.failed ? <Badge variant="destructive">{result.failed} failed</Badge> : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Processed</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Skipped</TableHead>
            <TableHead>Failed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.runs.map((run) => (
            <TableRow key={`${run.target_date ?? 'unknown'}:${run.status}`}>
              <TableCell>{run.target_date ?? '—'}</TableCell>
              <TableCell>{run.status}</TableCell>
              <TableCell>{run.processed ?? 0}</TableCell>
              <TableCell>{run.created ?? 0}</TableCell>
              <TableCell>{run.skipped ?? 0}</TableCell>
              <TableCell>{run.failed ?? 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryReviewPanel({ memories }: { memories: MemoryRecord[] }) {
  const [summaryType, setSummaryType] = useState<'all' | 'daily_summary' | 'run_summary'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [executionId, setExecutionId] = useState('');
  const summaryMemories = memories
    .filter((memory) => {
      if (memory.memory_type !== 'daily_summary' && memory.memory_type !== 'run_summary') {
        return false;
      }
      if (summaryType !== 'all' && memory.memory_type !== summaryType) {
        return false;
      }
      const sourceConversationId = memory.source_conversation_id || memory.conversation_id || '';
      if (conversationId.trim() && !sourceConversationId.includes(conversationId.trim())) {
        return false;
      }
      if (executionId.trim() && !(memory.source_execution_id || '').includes(executionId.trim())) {
        return false;
      }
      const summaryDate = memory.summary_date || memory.created_at || memory.updated_at || '';
      if (dateFrom && summaryDate < dateFrom) {
        return false;
      }
      if (dateTo && summaryDate > dateTo) {
        return false;
      }
      return true;
    })
    .sort(
      (left, right) =>
        new Date(right.updated_at ?? 0).getTime() - new Date(left.updated_at ?? 0).getTime()
    );
  const dailySummaries = summaryMemories.filter((memory) => memory.memory_type === 'daily_summary');
  const runSummaries = summaryMemories.filter((memory) => memory.memory_type === 'run_summary');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Recent summaries
        </CardTitle>
        <CardDescription>
          Review daily and run summaries separately from manual memories and compact packs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="summary-review-type">Type</Label>
            <select
              id="summary-review-type"
              value={summaryType}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) =>
                setSummaryType(event.target.value as 'all' | 'daily_summary' | 'run_summary')
              }
            >
              <option value="all">All summaries</option>
              <option value="daily_summary">Daily summaries</option>
              <option value="run_summary">Run summaries</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary-review-from">Date from</Label>
            <Input
              id="summary-review-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary-review-to">Date to</Label>
            <Input
              id="summary-review-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary-review-conversation">Conversation</Label>
            <Input
              id="summary-review-conversation"
              value={conversationId}
              onChange={(event) => setConversationId(event.target.value)}
              placeholder="conversation id"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary-review-execution">Execution</Label>
            <Input
              id="summary-review-execution"
              value={executionId}
              onChange={(event) => setExecutionId(event.target.value)}
              placeholder="execution id"
            />
          </div>
        </div>

        {summaryMemories.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            No summaries match the current filters.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <SummaryList title="Daily summaries" memories={dailySummaries} />
            <SummaryList title="Run summaries" memories={runSummaries} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryList({ title, memories }: { title: string; memories: MemoryRecord[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <Badge variant="secondary">{memories.length}</Badge>
      </div>
      {memories.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No records.
        </div>
      ) : (
        <div className="space-y-3">
          {memories.slice(0, 12).map((memory) => (
            <div key={memory.id} className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                {memory.memory_type ? (
                  <Badge variant="outline">{memoryTypeLabel(memory.memory_type)}</Badge>
                ) : null}
                {memory.status ? (
                  <Badge variant={memory.status === 'active' ? 'successful' : 'secondary'}>
                    {titleCase(memory.status)}
                  </Badge>
                ) : null}
                <Badge variant="secondary">{formatDate(memory.summary_date)}</Badge>
                {memory.sensitive ? <Badge variant="destructive">Sensitive</Badge> : null}
              </div>
              <p className="mt-3 font-medium text-slate-900">{memory.summary || memory.id}</p>
              <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-sm text-slate-600">
                {memory.content}
              </p>
              <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                <div>
                  Source conversation:{' '}
                  {memory.source_conversation_id || memory.conversation_id || '—'}
                </div>
                <div>Source execution: {memory.source_execution_id || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MemoryDetailSheet({
  memory,
  memories,
  open,
  onOpenChange,
  onChanged,
}: {
  memory: MemoryRecord | null;
  memories: MemoryRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(memory?.content ?? '');
  const [summary, setSummary] = useState(memory?.summary ?? '');
  const [status, setStatus] = useState<MemoryStatus>(memory?.status ?? 'active');
  const [importance, setImportance] = useState(memory?.importance?.toString() ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [exclusionTargetType, setExclusionTargetType] =
    useState<MemoryExclusionTargetType>('global');
  const [exclusionTargetId, setExclusionTargetId] = useState('');
  const [exclusionReason, setExclusionReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!memory) {
    return null;
  }

  const mode = memoryMode(memory);
  const documentId = memoryDocumentId(memory);
  const documentFilename = memoryDocumentFilename(memory);
  const exclusions = memoryExclusions(memory);
  const sourceConversationId = memory.source_conversation_id || memory.conversation_id;
  const supersededBy = memories.find((candidate) => candidate.supersedes_memory_id === memory.id);

  const handleUpdate = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await memoriesApi.updateMemory(memory.id, {
            confirmed,
            patch: {
              content: content.trim(),
              summary: summary.trim() || null,
              status,
              importance: importance.trim() ? Number(importance) : null,
            },
          });
          await onChanged();
          setIsEditing(false);
          toast.success('Memory updated.', { position: 'top-right' });
        } catch (updateError) {
          setError(updateError instanceof Error ? updateError.message : 'Failed to update memory.');
        }
      })();
    });
  };

  const handleDelete = () => {
    const shouldDelete = window.confirm(`Delete memory ${memory.id}?`);
    if (!shouldDelete) {
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await memoriesApi.deleteMemory(memory.id);
          await onChanged();
          onOpenChange(false);
          toast.success('Memory deleted.', { position: 'top-right' });
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete memory.');
        }
      })();
    });
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(memory.content);
    toast.success('Memory content copied.', { position: 'top-right' });
  };

  const handleAddExclusion = () => {
    const targetId = exclusionTargetId.trim();
    if (exclusionTargetType !== 'global' && !targetId) {
      setError('Target ID is required for non-global exclusions.');
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await memoriesApi.addMemoryExclusion(memory.id, {
            targetType: exclusionTargetType,
            targetId: exclusionTargetType === 'global' ? null : targetId,
            reason: exclusionReason.trim() || null,
          });
          await onChanged();
          setExclusionTargetType('global');
          setExclusionTargetId('');
          setExclusionReason('');
          toast.success('Memory exclusion saved.', { position: 'top-right' });
        } catch (excludeError) {
          setError(
            excludeError instanceof Error ? excludeError.message : 'Failed to exclude memory.'
          );
        }
      })();
    });
  };

  const handleRemoveExclusion = (exclusionId: string) => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await memoriesApi.deleteMemoryExclusion(memory.id, exclusionId);
          await onChanged();
          toast.success('Memory exclusion removed.', { position: 'top-right' });
        } catch (removeError) {
          setError(
            removeError instanceof Error ? removeError.message : 'Failed to remove exclusion.'
          );
        }
      })();
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{memory.summary || memory.content.slice(0, 80) || memory.id}</SheetTitle>
          <SheetDescription>{memory.id}</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{scopeLabel(memory.scope)}</Badge>
            {memory.memory_type ? (
              <Badge variant="outline">{memoryTypeLabel(memory.memory_type)}</Badge>
            ) : null}
            {mode ? <Badge variant="outline">{titleCase(mode)}</Badge> : null}
            {memory.status ? (
              <Badge variant={memory.status === 'active' ? 'successful' : 'secondary'}>
                {titleCase(memory.status)}
              </Badge>
            ) : null}
            {memory.sensitive ? <Badge variant="destructive">Sensitive</Badge> : null}
            <Badge variant={memory.embedding_model_profile_id ? 'successful' : 'outline'}>
              {embeddingLabel(memory)}
            </Badge>
          </div>

          <div className="grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm md:grid-cols-2">
            <DetailField label="Source" value={memory.source || 'manual'} />
            <DetailField label="Importance" value={memory.importance ?? '—'} />
            <DetailField label="Updated" value={formatDateTime(memory.updated_at)} />
            <DetailField label="Summary date" value={formatDate(memory.summary_date)} />
            <DetailField label="Conversation" value={sourceConversationId || '—'} />
            <DetailField label="Execution" value={memory.source_execution_id || '—'} />
            <DetailField label="Document" value={documentFilename || documentId || '—'} />
            <DetailField label="Agent" value={memory.agent_id || '—'} />
            <DetailField label="Workflow" value={memory.workflow_id || '—'} />
            <DetailField label="Workspace" value={memory.workspace_id || '—'} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing((current) => !current)}
            >
              {isEditing ? 'Close edit' : 'Edit'}
            </Button>
            <Button type="button" variant="outline" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copy content
            </Button>
            {memory.workflow_id ? (
              <Button type="button" variant="outline" asChild>
                <Link href={`/workflows/${memory.workflow_id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Workflow
                </Link>
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={isPending} onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              {isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>

          {isEditing ? (
            <Card className="border-primary-100">
              <CardHeader>
                <CardTitle className="text-base">Edit memory</CardTitle>
                <CardDescription>Updates use the existing durable-memory API.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="memory-edit-summary">Summary</Label>
                    <Input
                      id="memory-edit-summary"
                      value={summary}
                      onChange={(event) => setSummary(event.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="memory-edit-status">Status</Label>
                    <select
                      id="memory-edit-status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value as MemoryStatus)}
                      disabled={isPending}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {memoryStatuses.map((item) => (
                        <option key={item} value={item}>
                          {titleCase(item)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="memory-edit-content">Content</Label>
                  <Textarea
                    id="memory-edit-content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    disabled={isPending}
                    className="min-h-40"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="memory-edit-importance">Importance</Label>
                    <Input
                      id="memory-edit-importance"
                      type="number"
                      min={0}
                      max={100}
                      value={importance}
                      onChange={(event) => setImportance(event.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <label className="flex items-center gap-2 pt-7 text-xs text-neutral-700">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      disabled={isPending}
                    />
                    Confirm sensitive update
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={isPending || !content.trim()}
                    onClick={handleUpdate}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isPending ? 'Saving...' : 'Save changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Content</h3>
            <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
              <p className="whitespace-pre-wrap">{memory.content}</p>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Tags</h3>
            {memory.tags.length ? (
              <div className="flex flex-wrap gap-1">
                {memory.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No tags.</p>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Exclusions</h3>
              <p className="text-xs text-neutral-500">
                Excluded memories stay stored, but catalog linkers skip them for matching targets.
              </p>
            </div>
            {exclusions.length ? (
              <div className="space-y-2">
                {exclusions.map((exclusion) => (
                  <div
                    key={exclusion.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm"
                  >
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{titleCase(exclusion.targetType)}</Badge>
                        {exclusion.targetId ? (
                          <Badge variant="secondary">{exclusion.targetId}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-neutral-600">
                        {exclusion.reason || 'No reason provided.'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => handleRemoveExclusion(exclusion.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No exclusions configured.</p>
            )}
            <div className="rounded-md border border-dashed border-neutral-300 p-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="memory-exclusion-target-type">Target type</Label>
                  <select
                    id="memory-exclusion-target-type"
                    value={exclusionTargetType}
                    onChange={(event) =>
                      setExclusionTargetType(event.target.value as MemoryExclusionTargetType)
                    }
                    disabled={isPending}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {exclusionTargetTypes.map((item) => (
                      <option key={item} value={item}>
                        {titleCase(item)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="memory-exclusion-target-id">Target ID</Label>
                  <Input
                    id="memory-exclusion-target-id"
                    value={exclusionTargetId}
                    onChange={(event) => setExclusionTargetId(event.target.value)}
                    disabled={isPending || exclusionTargetType === 'global'}
                    placeholder="workflow, agent, task, conversation, or run id"
                  />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="memory-exclusion-reason">Reason</Label>
                <Input
                  id="memory-exclusion-reason"
                  value={exclusionReason}
                  onChange={(event) => setExclusionReason(event.target.value)}
                  disabled={isPending}
                  placeholder="Outdated, irrelevant, or unsafe for this target"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={
                  isPending || (exclusionTargetType !== 'global' && !exclusionTargetId.trim())
                }
                onClick={handleAddExclusion}
              >
                <Ban className="mr-2 h-4 w-4" />
                Add exclusion
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Source and lineage</h3>
            <div className="grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm md:grid-cols-2">
              <DetailField label="Supersedes" value={memory.supersedes_memory_id || '—'} />
              <DetailField label="Superseded by" value={supersededBy?.id || '—'} />
              <DetailField
                label="Archived start"
                value={formatDateTime(memory.archived_window_start)}
              />
              <DetailField
                label="Archived end"
                value={formatDateTime(memory.archived_window_end)}
              />
              <DetailField label="Created by" value={memory.created_by_user_id || '—'} />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Embedding details</h3>
            <div className="grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm md:grid-cols-2">
              <DetailField label="Model profile" value={memory.embedding_model_profile_id || '—'} />
              <DetailField label="Model" value={memory.embedding_model || '—'} />
              <DetailField label="Dimensions" value={memory.embedding_dimensions ?? '—'} />
              <DetailField label="Embedded at" value={formatDateTime(memory.embedded_at)} />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Metadata</h3>
            <pre className="max-h-72 overflow-auto rounded-md border border-neutral-200 bg-neutral-950 p-3 text-xs text-neutral-100">
              {metadataPreview(memory)}
            </pre>
          </section>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-1 break-all text-neutral-900">{value ?? '—'}</p>
    </div>
  );
}

function MemoryTable({
  memories,
  onOpenMemory,
}: {
  memories: MemoryRecord[];
  onOpenMemory: (memoryId: string) => void;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Durable memories</CardTitle>
        <CardDescription>
          Dense table view for inspecting raw records and opening the operational drawer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-65">Summary</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Importance</TableHead>
              <TableHead>Sensitive</TableHead>
              <TableHead>Embedding</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memories.map((memory) => {
              const mode = memoryMode(memory);
              const sourceConversationId = memory.source_conversation_id || memory.conversation_id;
              return (
                <TableRow key={memory.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="block max-w-sm text-left"
                      onClick={() => onOpenMemory(memory.id)}
                    >
                      <span className="block truncate font-medium text-slate-900">
                        {memory.summary || memory.content || memory.id}
                      </span>
                      <span className="mt-1 block truncate text-xs text-neutral-500">
                        {memory.id}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    {memory.memory_type ? (
                      <Badge variant="outline">{memoryTypeLabel(memory.memory_type)}</Badge>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{scopeLabel(memory.scope)}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{memory.source || 'manual'}</TableCell>
                  <TableCell>{mode ? titleCase(mode) : '—'}</TableCell>
                  <TableCell>
                    {memory.status ? (
                      <Badge variant={memory.status === 'active' ? 'successful' : 'secondary'}>
                        {titleCase(memory.status)}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">{memory.importance ?? '—'}</TableCell>
                  <TableCell>
                    {memory.sensitive ? (
                      <Badge variant="destructive">Yes</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={memory.embedding_model_profile_id ? 'successful' : 'outline'}>
                      {memory.embedding_model_profile_id ? 'Embedded' : 'Missing'}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-neutral-600">
                    {formatDateTime(memory.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {sourceConversationId ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            window.localStorage.setItem(
                              'agency.active_conversation_id',
                              sourceConversationId
                            );
                            router.push('/assistant');
                          }}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Chat
                        </Button>
                      ) : null}
                      {memory.workflow_id ? (
                        <Button type="button" variant="outline" asChild>
                          <Link href={`/workflows/${memory.workflow_id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Workflow
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenMemory(memory.id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Open
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function documentLinkTargetValue(
  targetType: WorkflowMemoryLinkTargetType,
  targetId?: string | null
) {
  return `${targetType}:${targetId ?? ''}`;
}

function parseDocumentLinkTarget(value: string): {
  targetType: WorkflowMemoryLinkTargetType;
  targetId: string | null;
} {
  const [targetType, ...targetIdParts] = value.split(':');
  if (targetType === 'agent' || targetType === 'task') {
    const targetId = targetIdParts.join(':').trim();
    return { targetType, targetId: targetId || null };
  }
  return { targetType: 'workflow', targetId: null };
}

function splitCompactList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function conversationLabel(conversation: Conversation) {
  return `${conversation.title?.trim() || conversation.channel_display_name?.trim() || 'Untitled'} (${conversation.id})`;
}

function compactPackTitle(pack: MemoryRecord) {
  return pack.summary?.trim() || pack.content.slice(0, 80) || pack.id;
}

function compactWorkflowName(pack: MemoryRecord) {
  const base = compactPackTitle(pack)
    .replace(/^saved\s+/i, '')
    .trim();
  const name = base ? `Workflow from ${base}` : 'Workflow from compact pack';
  return name.length > 90 ? `${name.slice(0, 87)}...` : name;
}

function workflowFromMemoryCompactPack(pack: MemoryRecord): WorkflowDefinition {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const workflowId = `workflow-context-pack-${suffix}`;
  const agentId = `agent-context-pack-${suffix}`;
  const taskId = `task-context-pack-${suffix}`;
  const nodeId = `node-${taskId}`;
  const mode = memoryMode(pack) ?? 'handoff';
  const sourceConversationId = pack.source_conversation_id ?? pack.conversation_id ?? null;

  return {
    id: workflowId,
    name: compactWorkflowName(pack),
    description: `Draft workflow created from a ${mode} compact context pack.`,
    nodes: [
      {
        id: nodeId,
        name: 'Plan from compact context',
        node_type: 'task',
        task_id: taskId,
        agent_id: agentId,
        metadata: {
          generated_by: 'memory-ops-compact-ui',
          context_pack_id: pack.id,
        },
      },
    ],
    edges: [],
    entrypoint: nodeId,
    agent_definitions: [
      {
        id: agentId,
        name: 'Context Pack Planner',
        role: 'Transform compact context into executable workflow steps.',
        instructions:
          'Use the supplied context pack as source material. Preserve decisions, constraints, and open questions while turning the work into clear execution steps.',
        tool_ids: [],
        handoff_agent_ids: [],
        metadata: {
          created_from: 'context_pack',
          context_pack_id: pack.id,
        },
      },
    ],
    task_definitions: [
      {
        id: taskId,
        name: 'Plan next execution from compact context',
        description: 'Read the compact context pack and produce an executable workflow plan.',
        instructions: `Compact context pack:\n\n${pack.content}`,
        expected_output:
          'A concise workflow plan with tasks, blockers, required inputs, and expected outputs.',
        agent_id: agentId,
        tool_ids: [],
        depends_on_task_ids: [],
        human_approval_required: false,
      },
    ],
    tool_definitions: [],
    allowed_runtime_adapter_ids: ['native'],
    default_runtime_adapter_id: 'native',
    versioning: {
      version: '1.0.0',
      revision: 1,
      labels: ['draft', 'context-pack'],
    },
    metadata: {
      inputs: ['context_pack_id'],
      process: 'sequential',
      created_from: 'context_pack',
      context_pack_id: pack.id,
      context_pack_mode: mode,
      context_pack_summary: pack.summary ?? null,
      source_conversation_id: sourceConversationId,
    },
  };
}

function CompactConversationsPanel({
  conversations,
  workflows,
  onChanged,
}: {
  conversations: Conversation[];
  workflows: WorkflowDefinition[];
  onChanged: () => Promise<void> | void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState('');
  const [mode, setMode] = useState<CompactBackfillMode>('handoff');
  const [sourceRange, setSourceRange] = useState<CompactBackfillSourceRange>('full');
  const [strategy, setStrategy] = useState<CompactBackfillStrategy>('auto');
  const [tokenBudget, setTokenBudget] = useState('1200');
  const [recentMessageLimit, setRecentMessageLimit] = useState('8');
  const [sourceMessageStartId, setSourceMessageStartId] = useState('');
  const [sourceMessageEndId, setSourceMessageEndId] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [customKeep, setCustomKeep] = useState('');
  const [customDrop, setCustomDrop] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [supersedePrevious, setSupersedePrevious] = useState(true);
  const [compactResult, setCompactResult] = useState<ConversationCompactResponse | null>(null);
  const [compactError, setCompactError] = useState<string | null>(null);
  const [backfillUserId, setBackfillUserId] = useState('');
  const [backfillWorkspaceId, setBackfillWorkspaceId] = useState('');
  const [backfillWorkflowId, setBackfillWorkflowId] = useState('');
  const [backfillLimit, setBackfillLimit] = useState('20');
  const [backfillDryRun, setBackfillDryRun] = useState(true);
  const [backfillSkipExisting, setBackfillSkipExisting] = useState(true);
  const [backfillResult, setBackfillResult] = useState<CompactBackfillResult | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [selectedTargetValue, setSelectedTargetValue] = useState(
    documentLinkTargetValue('workflow')
  );

  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  const selectedTarget = parseDocumentLinkTarget(selectedTargetValue);
  const targetOptions = selectedWorkflow
    ? [
        { value: documentLinkTargetValue('workflow'), label: 'Workflow' },
        ...(selectedWorkflow.agent_definitions ?? []).map((agent) => ({
          value: documentLinkTargetValue('agent', agent.id),
          label: `Agent: ${agent.name || agent.id}`,
        })),
        ...(selectedWorkflow.task_definitions ?? []).map((task) => ({
          value: documentLinkTargetValue('task', task.id),
          label: `Task: ${task.name || task.id}`,
        })),
      ]
    : [{ value: documentLinkTargetValue('workflow'), label: 'Workflow' }];

  const compactPacksQuery = useQuery({
    queryKey: [...queryKeys.backendMemories(), 'compact-packs', conversationId],
    queryFn: () =>
      conversationId
        ? conversationsApi.listCompactPacks(conversationId, {
            limit: 20,
            include_superseded: true,
          })
        : Promise.resolve({ items: [] }),
    enabled: Boolean(conversationId),
  });
  const workflowMemoryLinksQuery = useQuery({
    queryKey: selectedWorkflowId
      ? queryKeys.backendWorkflowMemoryLinks(selectedWorkflowId)
      : [...queryKeys.backendWorkflowMemoryLinks(''), 'compact-disabled'],
    queryFn: () => workflowsApi.listWorkflowMemoryLinks(selectedWorkflowId),
    enabled: Boolean(selectedWorkflowId),
  });

  const buildCompactPayload = (persist: boolean) => {
    const parsedTokenBudget = Number.parseInt(tokenBudget, 10);
    const parsedRecentLimit = Number.parseInt(recentMessageLimit, 10);
    if (
      sourceRange === 'selected' &&
      (!sourceMessageStartId.trim() || !sourceMessageEndId.trim())
    ) {
      throw new Error('Selected range compaction needs a start and end message id.');
    }
    return {
      mode: mode as ConversationCompactMode,
      token_budget: Number.isFinite(parsedTokenBudget) ? parsedTokenBudget : 1200,
      source_range: sourceRange as ConversationCompactSourceRange,
      source_message_start_id: sourceRange === 'selected' ? sourceMessageStartId.trim() : null,
      source_message_end_id: sourceRange === 'selected' ? sourceMessageEndId.trim() : null,
      recent_message_limit:
        sourceRange === 'older_than_recent' && Number.isFinite(parsedRecentLimit)
          ? parsedRecentLimit
          : undefined,
      workflow_id: workflowId.trim() || null,
      persist,
      confirmed,
      supersede_previous: supersedePrevious,
      strategy: strategy as ConversationCompactStrategy,
      custom_keep: mode === 'custom' ? splitCompactList(customKeep) : null,
      custom_drop: mode === 'custom' ? splitCompactList(customDrop) : null,
    };
  };

  const compactMutation = useMutation({
    mutationFn: ({ persist }: { persist: boolean }) => {
      if (!conversationId) {
        throw new Error('Select a conversation first.');
      }
      return conversationsApi.compactConversation(conversationId, buildCompactPayload(persist));
    },
    onSuccess: async (result) => {
      setCompactResult(result);
      setCompactError(null);
      await Promise.all([
        compactPacksQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendMemoryCatalog() }),
      ]);
      await onChanged();
      toast.success(result.status === 'created' ? 'Compact pack saved.' : 'Compact preview ready.');
    },
    onError: (error) => {
      setCompactError(error instanceof Error ? error.message : 'Failed to compact conversation.');
    },
  });

  const backfillMutation = useMutation({
    mutationFn: () => {
      const parsedTokenBudget = Number.parseInt(tokenBudget, 10);
      const parsedRecentLimit = Number.parseInt(recentMessageLimit, 10);
      const parsedLimit = Number.parseInt(backfillLimit, 10);
      return memoriesApi.backfillCompactPacks({
        conversation_id: conversationId || undefined,
        user_id: backfillUserId.trim() || undefined,
        workspace_id: backfillWorkspaceId.trim() || undefined,
        workflow_id: backfillWorkflowId.trim() || workflowId.trim() || undefined,
        mode,
        strategy,
        token_budget: Number.isFinite(parsedTokenBudget) ? parsedTokenBudget : 1200,
        source_range: sourceRange,
        recent_message_limit:
          sourceRange === 'older_than_recent' && Number.isFinite(parsedRecentLimit)
            ? parsedRecentLimit
            : undefined,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : 20,
        dry_run: backfillDryRun,
        confirmed,
        skip_existing: backfillSkipExisting,
        supersede_previous: supersedePrevious,
        custom_keep: mode === 'custom' ? splitCompactList(customKeep) : null,
        custom_drop: mode === 'custom' ? splitCompactList(customDrop) : null,
      });
    },
    onSuccess: async (result) => {
      setBackfillResult(result);
      await Promise.all([
        compactPacksQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendMemoryCatalog() }),
      ]);
      await onChanged();
      toast.success(
        `Compact backfill processed ${result.processed}, created ${result.created}, skipped ${result.skipped}.`
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to run compact backfill.');
    },
  });

  const linkMutation = useMutation({
    mutationFn: (pack: MemoryRecord) =>
      workflowsApi.addWorkflowMemoryLink(selectedWorkflowId, {
        targetType: selectedTarget.targetType,
        targetId: selectedTarget.targetId,
        refType: 'memory',
        refId: pack.id,
      }),
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.backendWorkflowMemoryLinks(selectedWorkflowId), {
        workflowId: selectedWorkflowId,
        items: response.items,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowMemoryLinks(selectedWorkflowId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(selectedWorkflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
      ]);
      toast.success('Compact pack linked.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to link compact pack.');
    },
  });
  const createWorkflowMutation = useMutation({
    mutationFn: (pack: MemoryRecord) =>
      workflowsApi.createWorkflow(workflowFromMemoryCompactPack(pack)),
    onSuccess: async (workflow) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() });
      toast.success('Workflow draft created from compact pack.');
      router.push(`/workflows/${workflow.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create workflow.');
    },
  });

  const linkedPackIds = new Set(
    (workflowMemoryLinksQuery.data?.items ?? [])
      .filter(
        (link) =>
          link.targetType === selectedTarget.targetType &&
          (link.targetId ?? null) === selectedTarget.targetId &&
          link.refType === 'memory'
      )
      .map((link) => link.refId)
  );

  const copyText = (content: string) => {
    void navigator.clipboard.writeText(content);
    toast.success('Compact content copied.');
  };

  const handlePackInNewChat = (pack: MemoryRecord) => {
    window.localStorage.removeItem('agency.active_conversation_id');
    window.localStorage.setItem(
      'agency.conversation_draft_input',
      `Continue from this compact context pack:\n\n${pack.content}`
    );
    router.push('/assistant');
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compact a conversation</CardTitle>
          <CardDescription>
            Preview or persist a context pack for one conversation, with the same compact modes used
            by the conversation workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="compact-conversation">Conversation</Label>
              <select
                id="compact-conversation"
                value={conversationId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) => {
                  setConversationId(event.target.value);
                  setCompactResult(null);
                }}
              >
                <option value="">Select conversation</option>
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversationLabel(conversation)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compact-mode">Mode</Label>
              <select
                id="compact-mode"
                value={mode}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) => setMode(event.target.value as CompactBackfillMode)}
              >
                {compactModes.map((item) => (
                  <option key={item} value={item}>
                    {titleCase(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compact-token-budget">Token budget</Label>
              <Input
                id="compact-token-budget"
                type="number"
                min={200}
                value={tokenBudget}
                onChange={(event) => setTokenBudget(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="compact-source-range">Source range</Label>
              <select
                id="compact-source-range"
                value={sourceRange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) =>
                  setSourceRange(event.target.value as CompactBackfillSourceRange)
                }
              >
                {compactSourceRanges.map((item) => (
                  <option key={item} value={item}>
                    {titleCase(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compact-strategy">Strategy</Label>
              <select
                id="compact-strategy"
                value={strategy}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) => setStrategy(event.target.value as CompactBackfillStrategy)}
              >
                {compactStrategies.map((item) => (
                  <option key={item} value={item}>
                    {titleCase(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compact-workflow-id">Workflow binding</Label>
              <select
                id="compact-workflow-id"
                value={workflowId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) => setWorkflowId(event.target.value)}
              >
                <option value="">No workflow binding</option>
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name ? `${workflow.name} (${workflow.id})` : workflow.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compact-recent-limit">Recent messages kept</Label>
              <Input
                id="compact-recent-limit"
                type="number"
                min={1}
                value={recentMessageLimit}
                disabled={sourceRange !== 'older_than_recent'}
                onChange={(event) => setRecentMessageLimit(event.target.value)}
              />
            </div>
          </div>

          {sourceRange === 'selected' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="compact-start-message">Start message id</Label>
                <Input
                  id="compact-start-message"
                  value={sourceMessageStartId}
                  onChange={(event) => setSourceMessageStartId(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="compact-end-message">End message id</Label>
                <Input
                  id="compact-end-message"
                  value={sourceMessageEndId}
                  onChange={(event) => setSourceMessageEndId(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {mode === 'custom' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="compact-custom-keep">Custom keep, one per line</Label>
                <Textarea
                  id="compact-custom-keep"
                  value={customKeep}
                  onChange={(event) => setCustomKeep(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="compact-custom-drop">Custom drop, one per line</Label>
                <Textarea
                  id="compact-custom-drop"
                  value={customDrop}
                  onChange={(event) => setCustomDrop(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Confirm memory write
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={supersedePrevious}
                onChange={(event) => setSupersedePrevious(event.target.checked)}
              />
              Supersede previous active pack
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={!conversationId || compactMutation.isPending}
              onClick={() => compactMutation.mutate({ persist: false })}
            >
              {compactMutation.isPending ? 'Working...' : 'Preview'}
            </Button>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={!conversationId || compactMutation.isPending}
              onClick={() => compactMutation.mutate({ persist: true })}
            >
              <Save className="mr-2 h-4 w-4" />
              Save pack
            </Button>
          </div>

          {compactError ? <p className="text-sm text-red-600">{compactError}</p> : null}

          {compactResult ? (
            <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{compactResult.status}</Badge>
                <Badge variant="secondary">{titleCase(compactResult.mode)}</Badge>
                {compactResult.sensitive ? <Badge variant="destructive">Sensitive</Badge> : null}
                <Badge variant="outline">
                  {compactResult.estimated_source_tokens} source tokens
                </Badge>
                <Badge variant="outline">
                  {compactResult.estimated_compact_tokens} compact tokens
                </Badge>
              </div>
              {compactResult.summary ? (
                <p className="text-sm font-medium text-neutral-900">{compactResult.summary}</p>
              ) : null}
              {compactResult.warnings.length > 0 ? (
                <div className="space-y-1">
                  {compactResult.warnings.map((warning) => (
                    <p key={warning} className="text-sm text-amber-700">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
              <pre className="max-h-96 overflow-auto rounded-md border border-neutral-200 bg-white p-3 whitespace-pre-wrap text-sm text-neutral-800">
                {compactResult.content}
              </pre>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyText(compactResult.content)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
                {compactResult.progress ? (
                  <span className="text-xs text-neutral-500">
                    {compactResult.progress.completed_steps} steps completed,{' '}
                    {compactResult.progress.failed_steps} failed
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Saved compact packs</CardTitle>
          <CardDescription>
            Review saved packs for the selected conversation and link them to workflow graph
            contexts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="compact-link-workflow">Link target workflow</Label>
              <select
                id="compact-link-workflow"
                value={selectedWorkflowId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) => {
                  setSelectedWorkflowId(event.target.value);
                  setSelectedTargetValue(documentLinkTargetValue('workflow'));
                }}
              >
                <option value="">Select workflow</option>
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name ? `${workflow.name} (${workflow.id})` : workflow.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compact-link-target">Link target</Label>
              <select
                id="compact-link-target"
                value={selectedTargetValue}
                disabled={!selectedWorkflow}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) => setSelectedTargetValue(event.target.value)}
              >
                {targetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!conversationId ? (
            <p className="text-sm text-neutral-500">Select a conversation to load compact packs.</p>
          ) : compactPacksQuery.isLoading ? (
            <p className="text-sm text-neutral-500">Loading compact packs...</p>
          ) : compactPacksQuery.data?.items.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No compact packs saved for this conversation.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-65">Pack</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sensitive</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(compactPacksQuery.data?.items ?? []).map((pack) => (
                  <TableRow key={pack.id}>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="truncate font-medium text-neutral-900">
                          {compactPackTitle(pack)}
                        </p>
                        <p className="mt-1 truncate text-xs text-neutral-500">{pack.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {memoryMode(pack) ? titleCase(memoryMode(pack) ?? '') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pack.status === 'active' ? 'successful' : 'secondary'}>
                        {titleCase(pack.status ?? 'active')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pack.sensitive ? (
                        <Badge variant="destructive">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-neutral-600">
                      {formatDateTime(pack.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => copyText(pack.content)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handlePackInNewChat(pack)}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Use in chat
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={createWorkflowMutation.isPending}
                          onClick={() => createWorkflowMutation.mutate(pack)}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Workflow
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            !selectedWorkflow ||
                            linkedPackIds.has(pack.id) ||
                            linkMutation.isPending
                          }
                          onClick={() => linkMutation.mutate(pack)}
                        >
                          {linkedPackIds.has(pack.id) ? 'Linked' : 'Link'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Admin compact backfill</CardTitle>
          <CardDescription>
            Batch-create or dry-run compact packs across matching conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="compact-backfill-user">User filter</Label>
              <Input
                id="compact-backfill-user"
                value={backfillUserId}
                onChange={(event) => setBackfillUserId(event.target.value)}
                placeholder="user id"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compact-backfill-workspace">Workspace filter</Label>
              <Input
                id="compact-backfill-workspace"
                value={backfillWorkspaceId}
                onChange={(event) => setBackfillWorkspaceId(event.target.value)}
                placeholder="workspace id"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compact-backfill-workflow">Workflow filter</Label>
              <Input
                id="compact-backfill-workflow"
                value={backfillWorkflowId}
                onChange={(event) => setBackfillWorkflowId(event.target.value)}
                placeholder="workflow id"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compact-backfill-limit">Limit</Label>
              <Input
                id="compact-backfill-limit"
                type="number"
                min={1}
                value={backfillLimit}
                onChange={(event) => setBackfillLimit(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={backfillDryRun}
                onChange={(event) => setBackfillDryRun(event.target.checked)}
              />
              Dry run
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={backfillSkipExisting}
                onChange={(event) => setBackfillSkipExisting(event.target.checked)}
              />
              Skip existing packs
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={backfillMutation.isPending}
              onClick={() => backfillMutation.mutate()}
            >
              {backfillMutation.isPending ? 'Running...' : 'Run backfill'}
            </Button>
          </div>

          {backfillResult ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{backfillResult.status}</Badge>
                <Badge variant="secondary">{backfillResult.processed} processed</Badge>
                <Badge variant="successful">{backfillResult.created} created</Badge>
                <Badge variant="outline">{backfillResult.skipped} skipped</Badge>
                {backfillResult.failed ? (
                  <Badge variant="destructive">{backfillResult.failed} failed</Badge>
                ) : null}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conversation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Compact</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backfillResult.results.map((item) => (
                    <TableRow key={`${item.conversation_id}:${item.memory_id ?? item.status}`}>
                      <TableCell className="font-mono text-xs">{item.conversation_id}</TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell>{item.mode ? titleCase(item.mode) : '—'}</TableCell>
                      <TableCell>{item.estimated_source_tokens ?? '—'}</TableCell>
                      <TableCell>{item.estimated_compact_tokens ?? '—'}</TableCell>
                      <TableCell>{item.reason ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {backfillResult.progress.events.length > 0 ? (
                <div className="max-h-56 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  {backfillResult.progress.events.map((event, index) => (
                    <p key={`${event.step}:${index}`} className="text-xs text-neutral-700">
                      {event.status} · {event.step}: {event.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentCatalogPanel({
  onOpenMemory,
  workflows,
}: {
  onOpenMemory: (memoryId: string) => void;
  workflows: WorkflowDefinition[];
}) {
  const queryClient = useQueryClient();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [selectedTargetValue, setSelectedTargetValue] = useState(
    documentLinkTargetValue('workflow')
  );
  const catalogQuery = useQuery({
    queryKey: [...queryKeys.backendMemoryCatalog(), 'documents'],
    queryFn: () => memoriesApi.listMemoryCatalog({ limit_per_group: 100 }),
  });
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  const selectedTarget = parseDocumentLinkTarget(selectedTargetValue);
  const targetOptions = selectedWorkflow
    ? [
        { value: documentLinkTargetValue('workflow'), label: 'Workflow' },
        ...(selectedWorkflow.agent_definitions ?? []).map((agent) => ({
          value: documentLinkTargetValue('agent', agent.id),
          label: `Agent: ${agent.name || agent.id}`,
        })),
        ...(selectedWorkflow.task_definitions ?? []).map((task) => ({
          value: documentLinkTargetValue('task', task.id),
          label: `Task: ${task.name || task.id}`,
        })),
      ]
    : [{ value: documentLinkTargetValue('workflow'), label: 'Workflow' }];
  const workflowMemoryLinksQuery = useQuery({
    queryKey: selectedWorkflowId
      ? queryKeys.backendWorkflowMemoryLinks(selectedWorkflowId)
      : [...queryKeys.backendWorkflowMemoryLinks(''), 'disabled'],
    queryFn: () => workflowsApi.listWorkflowMemoryLinks(selectedWorkflowId),
    enabled: Boolean(selectedWorkflowId),
  });
  const deleteMutation = useMutation({
    mutationFn: async (item: MemoryCatalogItem) => {
      const documentId = item.documentId || item.id;
      try {
        return await documentsApi.deleteDocument(documentId);
      } catch (error) {
        if (!isApiError(error) || error.status !== 404) {
          throw error;
        }
      }
      return memoriesApi.deleteDocumentMemories(documentId, {
        scope: item.scope,
        workflow_id: item.workflowId || undefined,
        conversation_id: item.conversationId || undefined,
        agent_id: item.agentId || undefined,
      });
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendMemoryCatalog() }),
      ]);
      const removedChunks =
        'deleted_memory_count' in result && typeof result.deleted_memory_count === 'number'
          ? result.deleted_memory_count
          : 'deleted_count' in result && typeof result.deleted_count === 'number'
            ? result.deleted_count
            : 0;
      toast.success(
        removedChunks > 0
          ? `Removed document and ${removedChunks} memory chunk${removedChunks === 1 ? '' : 's'}.`
          : 'Removed uploaded document.'
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to remove document memories.');
    },
  });
  const linkMutation = useMutation({
    mutationFn: (item: MemoryCatalogItem) =>
      workflowsApi.addWorkflowMemoryLink(selectedWorkflowId, {
        targetType: selectedTarget.targetType,
        targetId: selectedTarget.targetId,
        refType: item.refType,
        refId: item.documentId || item.id,
      }),
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.backendWorkflowMemoryLinks(selectedWorkflowId), {
        workflowId: selectedWorkflowId,
        items: response.items,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowMemoryLinks(selectedWorkflowId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(selectedWorkflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
      ]);
      toast.success('Document memory group linked.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to link document memory group.');
    },
  });

  const documents =
    catalogQuery.data?.groups.find((group) => group.key === 'documents')?.items ?? [];
  const linkedDocumentKeys = new Set(
    (workflowMemoryLinksQuery.data?.items ?? [])
      .filter(
        (link) =>
          link.targetType === selectedTarget.targetType &&
          (link.targetId ?? null) === selectedTarget.targetId &&
          link.refType === 'memory_collection'
      )
      .map((link) => link.refId)
  );

  const handleDelete = (item: MemoryCatalogItem) => {
    if (
      !window.confirm(
        `Remove ${item.documentFilename || item.label}? This deletes ${item.chunkCount} memory chunk${
          item.chunkCount === 1 ? '' : 's'
        } from this context.`
      )
    ) {
      return;
    }
    deleteMutation.mutate(item);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Uploaded document groups</CardTitle>
        <CardDescription>
          Existing file-ingestion memories grouped by document, with chunk counts and context.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="document-link-workflow">Link target workflow</Label>
            <select
              id="document-link-workflow"
              value={selectedWorkflowId}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) => {
                setSelectedWorkflowId(event.target.value);
                setSelectedTargetValue(documentLinkTargetValue('workflow'));
              }}
            >
              <option value="">Select workflow</option>
              {workflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name ? `${workflow.name} (${workflow.id})` : workflow.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="document-link-target">Link target</Label>
            <select
              id="document-link-target"
              value={selectedTargetValue}
              disabled={!selectedWorkflow}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(event) => setSelectedTargetValue(event.target.value)}
            >
              {targetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {catalogQuery.isLoading ? (
          <p className="text-sm text-neutral-500">Loading uploaded documents...</p>
        ) : catalogQuery.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-red-600">Failed to load uploaded document groups.</p>
            <Button type="button" variant="outline" onClick={() => void catalogQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-neutral-500">No uploaded document memories yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-65">Document</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Embedding</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((item) => (
                <TableRow key={`${item.scope}:${item.id}`}>
                  <TableCell>
                    <div className="max-w-md">
                      <p className="truncate font-medium text-neutral-900">
                        {item.documentFilename || item.label}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {item.documentId || item.id}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{scopeLabel(item.scope)}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.tags.length > 0 ? (
                      <div className="flex max-w-2xs flex-wrap gap-1">
                        {item.tags.slice(0, 4).map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                        {item.tags.length > 4 ? (
                          <Badge variant="secondary">+{item.tags.length - 4}</Badge>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-500">—</span>
                    )}
                  </TableCell>
                  <TableCell>{item.chunkCount}</TableCell>
                  <TableCell>
                    <Badge variant={item.embedded ? 'successful' : 'outline'}>
                      {item.embedded ? 'Embedded' : 'Missing'}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-neutral-600">
                    {formatDateTime(item.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          !selectedWorkflow ||
                          item.refType !== 'memory_collection' ||
                          linkedDocumentKeys.has(item.documentId || item.id) ||
                          linkMutation.isPending
                        }
                        onClick={() => linkMutation.mutate(item)}
                      >
                        {linkedDocumentKeys.has(item.documentId || item.id) ? 'Linked' : 'Link'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={item.memoryIds.length === 0}
                        onClick={() => onOpenMemory(item.memoryIds[0])}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Chunks
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function MemoryWorkspace() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MemoryOpsTab>('browse');
  const [scope, setScope] = useState<MemoryScope | ''>('');
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<MemoryType[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<MemoryStatus[]>([]);
  const [sourceFilter, setSourceFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [sensitiveFilter, setSensitiveFilter] = useState<'all' | 'sensitive' | 'not_sensitive'>(
    'all'
  );
  const [embeddingFilter, setEmbeddingFilter] = useState<'all' | 'embedded' | 'missing'>('all');
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [documentFilter, setDocumentFilter] = useState('');
  const [sourceConversationId, setSourceConversationId] = useState('');
  const [sourceExecutionId, setSourceExecutionId] = useState('');
  const [summaryDateFrom, setSummaryDateFrom] = useState('');
  const [summaryDateTo, setSummaryDateTo] = useState('');
  const [selectedMemoryId, setSelectedMemoryId] = useState('');

  const currentUserQuery = useQuery({
    queryKey: [...queryKeys.backendMemories(), 'current-user'],
    queryFn: () => usersApi.getCurrentUser(),
  });

  const agentsQuery = useQuery({
    queryKey: queryKeys.backendAgents(),
    queryFn: () => agentsApi.listAgents(),
  });

  const conversationsQuery = useQuery({
    queryKey: [...queryKeys.backendMemories(), 'conversation-options'],
    queryFn: () => conversationsApi.listConversations(),
  });

  const workflowsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowList(),
    queryFn: () => workflowsApi.listWorkflows(),
  });

  const memoriesQuery = useQuery({
    queryKey: [
      ...queryKeys.backendMemories(),
      scope,
      query,
      selectedTypes.join(','),
      selectedStatuses.join(','),
      sourceFilter,
      workflowFilter,
      sourceConversationId,
      sourceExecutionId,
      summaryDateFrom,
      summaryDateTo,
    ],
    queryFn: () =>
      memoriesApi.listMemories({
        scope,
        q: query,
        source: sourceFilter || undefined,
        memory_type: selectedTypes,
        status: selectedStatuses,
        workflow_id: workflowFilter || undefined,
        source_conversation_id: sourceConversationId || undefined,
        source_execution_id: sourceExecutionId || undefined,
        summary_date_from: summaryDateFrom || undefined,
        summary_date_to: summaryDateTo || undefined,
        limit: 100,
      }),
  });

  const memories = memoriesQuery.data?.items ?? [];
  const filteredMemories = memories.filter((memory) => {
    if (modeFilter && memoryMode(memory) !== modeFilter) {
      return false;
    }
    if (sensitiveFilter === 'sensitive' && !memory.sensitive) {
      return false;
    }
    if (sensitiveFilter === 'not_sensitive' && memory.sensitive) {
      return false;
    }
    if (embeddingFilter === 'embedded' && !memory.embedding_model_profile_id) {
      return false;
    }
    if (embeddingFilter === 'missing' && memory.embedding_model_profile_id) {
      return false;
    }
    if (documentFilter.trim()) {
      const documentId = memoryDocumentId(memory) || '';
      const documentFilename = memoryDocumentFilename(memory) || '';
      const needle = documentFilter.trim();
      if (!documentId.includes(needle) && !documentFilename.includes(needle)) {
        return false;
      }
    }
    return true;
  });
  const selectedMemory = memories.find((memory) => memory.id === selectedMemoryId) ?? null;
  const agents = agentsQuery.data?.items ?? [];
  const conversations = conversationsQuery.data?.items ?? [];
  const workflows = workflowsQuery.data?.items ?? [];
  const sourceOptions = Array.from(
    new Set(
      memories.map((memory) => memory.source).filter((source): source is string => Boolean(source))
    )
  ).sort();
  const agentOptions = agents.map((agent) => ({ id: agent.id, label: agentLabel(agent) }));
  const conversationOptions = conversations.map((conversation) => ({
    id: conversation.id,
    label: `${conversation.title?.trim() || conversation.channel_display_name?.trim() || 'Untitled'} (${conversation.id})`,
  }));
  const workflowOptions = workflows.map((workflow) => ({
    id: workflow.id,
    label: workflow.name ? `${workflow.name} (${workflow.id})` : workflow.id,
  }));
  const currentUser = currentUserQuery.data;
  const isAdmin = Boolean(currentUser?.roles?.includes('admin'));
  const summaryCount = memories.filter(
    (memory) => memory.memory_type === 'daily_summary' || memory.memory_type === 'run_summary'
  ).length;
  const compactCount = memories.filter(
    (memory) => memory.memory_type === 'context_pack' || memory.source === 'compact_tool'
  ).length;
  const documentCount = new Set(
    memories
      .filter((memory) => memory.source === 'document_upload')
      .map((memory) => memory.metadata?.document_id ?? memory.id)
  ).size;

  const toggleType = (memoryType: MemoryType) => {
    setSelectedTypes((current) =>
      current.includes(memoryType)
        ? current.filter((item) => item !== memoryType)
        : [...current, memoryType]
    );
  };

  const toggleStatus = (status: MemoryStatus) => {
    setSelectedStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
    );
  };

  if (memoriesQuery.isLoading || currentUserQuery.isLoading) {
    return (
      <LoadingCard title="Agent Memory Ops" description="Loading durable memory operations." />
    );
  }

  if (memoriesQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load durable memories"
        message={memoriesQuery.error.message}
        onRetry={() => memoriesQuery.refetch()}
      />
    );
  }

  if (currentUserQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load user access"
        message={currentUserQuery.error.message}
        onRetry={() => currentUserQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BrainCircuit}
        tone="memory"
        title="Agent Memory Ops"
        description="Inspect and manage backend durable memory, summaries, and retrieval inputs without treating memory as a standalone tool."
        actions={
          <>
            {isAdmin ? (
              <Badge variant="successful">Admin actions enabled</Badge>
            ) : (
              <Badge variant="outline">Read/write memory console</Badge>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void Promise.all([memoriesQuery.refetch(), currentUserQuery.refetch()])
              }
              disabled={memoriesQuery.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${memoriesQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as MemoryOpsTab)}
        className="space-y-5"
      >
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="browse" className="gap-2">
            <CalendarRange className="h-4 w-4" />
            Browse
            <Badge variant="secondary" className="ml-1">
              {filteredMemories.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <BrainCircuit className="h-4 w-4" />
            Create
          </TabsTrigger>
          <TabsTrigger value="ingest" className="gap-2">
            <FileText className="h-4 w-4" />
            Ingest Files
            <Badge variant="secondary" className="ml-1">
              {documentCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="compact" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Compact Conversations
            <Badge variant="secondary" className="ml-1">
              {compactCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="summaries" className="gap-2">
            <Shield className="h-4 w-4" />
            Summaries
            <Badge variant="secondary" className="ml-1">
              {summaryCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2">
            <DatabaseZap className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarRange className="h-5 w-5" />
                Search and filter durable memory
              </CardTitle>
              <CardDescription>
                Search uses scoped access checks, vector similarity when configured, lexical
                fallback, and summary-aware filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value as MemoryScope | '')}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All scopes</option>
                  {scopes.map((item) => (
                    <option key={item} value={item}>
                      {scopeLabel(item)}
                    </option>
                  ))}
                </select>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search content, summaries, tags, or memory IDs"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Memory types</Label>
                  <div className="flex flex-wrap gap-2">
                    {MEMORY_TYPES.map((memoryType) => (
                      <button
                        key={memoryType}
                        type="button"
                        title={memoryTypeDescription(memoryType)}
                        onClick={() => toggleType(memoryType)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          selectedTypes.includes(memoryType)
                            ? 'agency-gradient border-primary-500 text-white'
                            : 'border-primary-200 bg-white text-slate-700 hover:bg-primary-50'
                        }`}
                      >
                        {memoryTypeLabel(memoryType)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {memoryStatuses.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => toggleStatus(status)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          selectedStatuses.includes(status)
                            ? 'agency-gradient border-primary-500 text-white'
                            : 'border-primary-200 bg-white text-slate-700 hover:bg-primary-50'
                        }`}
                      >
                        {titleCase(status)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-source">Source</Label>
                  <select
                    id="filter-source"
                    value={sourceFilter}
                    onChange={(event) => setSourceFilter(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">All sources</option>
                    {sourceOptions.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-mode">Mode</Label>
                  <select
                    id="filter-mode"
                    value={modeFilter}
                    onChange={(event) => setModeFilter(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">All modes</option>
                    {memoryModeOptions.map((mode) => (
                      <option key={mode} value={mode}>
                        {titleCase(mode)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-sensitive">Sensitive</Label>
                  <select
                    id="filter-sensitive"
                    value={sensitiveFilter}
                    onChange={(event) =>
                      setSensitiveFilter(
                        event.target.value as 'all' | 'sensitive' | 'not_sensitive'
                      )
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All sensitivity</option>
                    <option value="sensitive">Sensitive only</option>
                    <option value="not_sensitive">Not sensitive</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-embedding">Embedding</Label>
                  <select
                    id="filter-embedding"
                    value={embeddingFilter}
                    onChange={(event) =>
                      setEmbeddingFilter(event.target.value as 'all' | 'embedded' | 'missing')
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All vectors</option>
                    <option value="embedded">Embedded</option>
                    <option value="missing">Missing vector</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-workflow">Workflow</Label>
                  <select
                    id="filter-workflow"
                    value={workflowFilter}
                    onChange={(event) => setWorkflowFilter(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">All workflows</option>
                    {workflows.map((workflow) => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name ? `${workflow.name} (${workflow.id})` : workflow.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-document">Document</Label>
                  <Input
                    id="filter-document"
                    value={documentFilter}
                    onChange={(event) => setDocumentFilter(event.target.value)}
                    placeholder="document id or filename"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-source-conversation">Source conversation ID</Label>
                  <Input
                    id="filter-source-conversation"
                    value={sourceConversationId}
                    onChange={(event) => setSourceConversationId(event.target.value)}
                    placeholder="conversation-123"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-source-execution">Source execution ID</Label>
                  <Input
                    id="filter-source-execution"
                    value={sourceExecutionId}
                    onChange={(event) => setSourceExecutionId(event.target.value)}
                    placeholder="execution-123"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-summary-date-from">Summary date from</Label>
                  <Input
                    id="filter-summary-date-from"
                    type="date"
                    value={summaryDateFrom}
                    onChange={(event) => setSummaryDateFrom(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-summary-date-to">Summary date to</Label>
                  <Input
                    id="filter-summary-date-to"
                    type="date"
                    value={summaryDateTo}
                    onChange={(event) => setSummaryDateTo(event.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {filteredMemories.length === 0 ? (
            <EmptyCard
              title="No durable memories found"
              description="No durable memories match the current filters."
            />
          ) : (
            <MemoryTable memories={filteredMemories} onOpenMemory={setSelectedMemoryId} />
          )}
        </TabsContent>

        <TabsContent value="create" className="mt-0">
          <GuidedMemoryActions
            agents={agents}
            conversations={conversations}
            memories={memories}
            workflows={workflows}
            onCreated={async () => {
              await Promise.all([
                memoriesQuery.refetch(),
                queryClient.invalidateQueries({ queryKey: queryKeys.backendMemoryCatalog() }),
              ]);
            }}
          />
        </TabsContent>

        <TabsContent value="ingest" className="mt-0 space-y-5">
          <DocumentIngestionControl
            agents={agentOptions}
            conversations={conversationOptions}
            workflows={workflowOptions}
            description="Upload source material into durable archive memory. Use this admin surface for manual or cross-context ingestion."
            onIngested={async () => {
              await memoriesQuery.refetch();
            }}
          />
          <DocumentCatalogPanel onOpenMemory={setSelectedMemoryId} workflows={workflows} />
        </TabsContent>

        <TabsContent value="compact" className="mt-0">
          <CompactConversationsPanel
            conversations={conversations}
            workflows={workflows}
            onChanged={async () => {
              await memoriesQuery.refetch();
            }}
          />
        </TabsContent>

        <TabsContent value="summaries" className="mt-0 space-y-5">
          <SummaryReviewPanel memories={memories} />
          <DailySummaryAdminPanel
            isAdmin={isAdmin}
            onCompleted={async () => {
              await memoriesQuery.refetch();
            }}
          />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-0">
          <MemoryEmbeddingPanel
            memories={memories}
            onOpenMemory={setSelectedMemoryId}
            onBackfilled={async () => {
              await memoriesQuery.refetch();
            }}
          />
        </TabsContent>
      </Tabs>

      <MemoryDetailSheet
        key={selectedMemory?.id ?? 'no-selected-memory'}
        memory={selectedMemory}
        memories={memories}
        open={Boolean(selectedMemory)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedMemoryId('');
          }
        }}
        onChanged={async () => {
          await memoriesQuery.refetch();
        }}
      />
    </div>
  );
}
