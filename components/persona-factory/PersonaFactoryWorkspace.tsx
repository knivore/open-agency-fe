'use client';

import type { ReactNode, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
  HelpCircle,
  Layers3,
  MessageSquareText,
  PackageCheck,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  SlidersHorizontal,
  Trash2,
  UserRoundCog,
  WandSparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import DocumentIngestionControl from '@/components/memory-app/DocumentIngestionControl';
import UploadedDocumentsList from '@/components/memory-app/UploadedDocumentsList';
import PageHeader from '@/components/app-shell/PageHeader';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/library/shadcn/dialog';
import { Input } from '@/components/library/shadcn/input';
import { Label } from '@/components/library/shadcn/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/library/shadcn/tabs';
import { Textarea } from '@/components/library/shadcn/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/library/shadcn/tooltip';
import { behaviorProfilesApi } from '@/lib/api/backend/behaviorProfiles';
import { conversationsApi } from '@/lib/api/backend/conversations';
import { memoriesApi } from '@/lib/api/backend/memory';
import { personasApi } from '@/lib/api/backend/personas';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { cn } from '@/lib/utils';
import type { ConversationPostMessageResponse } from '@/types/conversations';
import type { MemoryRecord } from '@/types/memory';
import type {
  PersonaDefinition,
  PersonaDistillationMode,
  PersonaDistillationItem,
  PersonaDistillationRun,
  PersonaDistillResult,
  PersonaGraphContextResult,
  PersonaGraphContextPreset,
  PersonaGovernanceCatalog,
  PersonaItemReviewStatus,
  PersonaItemType,
  PersonaLLMModelSource,
  PersonaMemoryLayer,
  PersonaPackage,
  PersonaPublishResult,
  PersonaRunSourceClassificationResult,
  PersonaRunSourceDetail,
  PersonaRunSourceRedistillResult,
  PersonaRunSourceMap,
  PersonaSourceClassificationPatch,
} from '@/types/personas';

type NeedsReviewFilter = 'all' | 'needs_review' | 'ready';
type BulkReviewAction = 'approve' | 'reject';
type SourceClassificationDraft = {
  classification: string;
  confidence: string;
  contentRoles: string;
  documentKind: string;
  extractionTargets: string;
  memoryLayers: string;
  rationale: string;
  sourceKey: string;
  vectorTags: string;
};
const REVIEW_ITEM_PAGE_SIZE = 50;
const DEFAULT_DISTILLATION_MODES: PersonaDistillationMode[] = ['llm', 'deterministic', 'hybrid'];
const DEFAULT_LLM_MODEL_SOURCES: PersonaLLMModelSource[] = ['main_agent', 'model_profile'];

interface ReviewFilterPayload {
  source_key?: string;
  item_type?: string;
  memory_layer?: string;
  review_status?: string;
  needs_review?: boolean;
  min_confidence?: number;
  max_confidence?: number;
}

interface DistillationSourceSummary {
  key: string;
  label: string;
  memoryId: string | null;
  classification: string;
  documentKind: string | null;
  distillers: string[];
  vectorTags: string[];
  itemCount: number;
  needsReviewCount: number;
  approvedCount: number;
}

interface SourceRedistillComparison {
  sourceKey: string;
  supersededItems: PersonaDistillationItem[];
  createdItems: PersonaDistillationItem[];
}

const GOVERNANCE_KEYS = [
  'persona_type',
  'capability_mode',
  'consent_status',
  'source_basis',
  'sensitivity_level',
  'visibility',
] as const;

const GRAPH_CONTEXT_PRESETS: Array<{
  value: PersonaGraphContextPreset;
  label: string;
  description: string;
}> = [
  {
    value: 'persona_lineage',
    label: 'Sources and history',
    description: 'Where this persona came from and how it has changed.',
  },
  {
    value: 'persona_capability_map',
    label: 'Skills and tools',
    description: 'What this persona can use or is connected to.',
  },
];

function HelpTooltip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 text-xs leading-5">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ReadOnlyDisclosure({
  children,
  description,
  helpLabel,
  helpText,
  icon,
  title,
}: {
  children: ReactNode;
  description: string;
  helpLabel: string;
  helpText: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={isOpen}
          className="min-w-0 flex-1 text-left"
          onClick={() => setIsOpen((current) => !current)}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {icon}
            <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">{title}</h2>
            <Badge variant="outline">Read-only</Badge>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform dark:text-slate-500',
                isOpen ? 'rotate-180' : ''
              )}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </button>
        <HelpTooltip label={helpLabel}>{helpText}</HelpTooltip>
      </div>
      {isOpen ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function memoryLabel(memory: MemoryRecord) {
  const filename = memory.metadata?.filename;
  const documentId = memory.metadata?.document_id;
  if (typeof filename === 'string' && filename.trim()) {
    return filename;
  }
  if (typeof documentId === 'string' && documentId.trim()) {
    return documentId;
  }
  return memory.summary || memory.source || memory.memory_type || memory.id;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function itemSourceLabel(item: PersonaDistillationItem) {
  const sourceRef = item.structured_payload?.source_ref;
  if (sourceRef && typeof sourceRef === 'object' && !Array.isArray(sourceRef)) {
    const filename = sourceRef.filename;
    const chunk = sourceRef.chunk_index;
    if (typeof filename === 'string' && filename) {
      return typeof chunk === 'number' ? `${filename} · chunk ${chunk}` : filename;
    }
  }
  return item.source_memory_id || 'source';
}

function summarizeMemory(memory: MemoryRecord) {
  return memory.summary || memory.content.slice(0, 180);
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringList(value: unknown) {
  return metadataArray(value).filter((item): item is string => typeof item === 'string');
}

function commaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function csv(values: unknown) {
  return stringList(values).join(', ');
}

function memorySourceDetails(memory: MemoryRecord) {
  const metadata = metadataObject(memory.metadata);
  const uploadIntelligence = metadataObject(metadata.upload_intelligence);
  const sourceIntelligence = metadataObject(metadata.source_intelligence);
  const sourceClassification = metadataObject(sourceIntelligence.classification);
  const documentKind =
    typeof uploadIntelligence.document_kind === 'string'
      ? uploadIntelligence.document_kind
      : typeof sourceClassification.document_kind === 'string'
        ? sourceClassification.document_kind
        : null;
  const chunkIndex = typeof metadata.chunk_index === 'number' ? metadata.chunk_index + 1 : null;
  const chunkCount = typeof metadata.chunk_count === 'number' ? metadata.chunk_count : null;
  const parts: string[] = memory.memory_type ? [memory.memory_type] : [];
  if (documentKind) {
    parts.push(documentKind);
  }
  if (chunkIndex && chunkCount) {
    parts.push(`chunk ${chunkIndex}/${chunkCount}`);
  }
  if (memory.tags?.length) {
    parts.push(memory.tags.slice(0, 3).join(', '));
  }
  return parts.filter(Boolean).join(' · ');
}

function itemPayload(item: PersonaDistillationItem | null) {
  return metadataObject(item?.structured_payload);
}

function itemSourceRef(item: PersonaDistillationItem | null) {
  return metadataObject(itemPayload(item).source_ref);
}

function itemRouting(item: PersonaDistillationItem | null) {
  return metadataObject(itemPayload(item).routing);
}

function itemSourceClassification(item: PersonaDistillationItem | null) {
  return metadataObject(itemPayload(item).source_classification);
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function graphPropertyLabel(value: unknown) {
  const properties = metadataObject(value);
  return (
    textValue(properties.name) ??
    textValue(properties.title) ??
    textValue(properties.summary) ??
    textValue(properties.filename)
  );
}

function graphPolicy(value: unknown) {
  return metadataObject(metadataObject(value).policy);
}

function graphPolicySourcePriority(value: unknown) {
  return stringList(metadataObject(graphPolicy(value)).source_priority);
}

function itemTypeLabel(itemType: PersonaItemType | string) {
  const labels: Record<string, string> = {
    domain_knowledge: 'Knowledge',
    procedure: 'Procedure',
    decision_pattern: 'Decision pattern',
    writing_style: 'Writing style',
    tool_usage: 'Tool use',
    workflow: 'Workflow',
    example: 'Example',
    guardrail: 'Guardrail',
    social_context: 'Context',
    source_reference: 'Source reference',
  };
  return labels[itemType] ?? itemType.replaceAll('_', ' ');
}

function displayItemTitle(item: PersonaDistillationItem) {
  const prefix = itemTypeLabel(item.item_type).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return item.title.replace(new RegExp(`^${prefix}:\\s*`, 'i'), '').trim() || item.title;
}

function runtimePersonaGraphContext(response: ConversationPostMessageResponse | null) {
  const assistantMetadata = metadataObject(response?.assistant_message?.metadata);
  const provenance = metadataObject(assistantMetadata.persona_provenance);
  const runtimeContext = metadataObject(provenance.runtime_context);
  return metadataObject(runtimeContext.graph_context);
}

function itemDistillerLabel(item: PersonaDistillationItem) {
  const payload = itemPayload(item);
  return textValue(payload.distiller) ?? textValue(item.metadata?.distiller) ?? 'distiller';
}

function itemRoutingLabel(item: PersonaDistillationItem) {
  const routing = itemRouting(item);
  const classification = itemSourceClassification(item);
  return (
    textValue(routing.label) ??
    textValue(classification.label) ??
    textValue(item.metadata?.source_classification) ??
    'unclassified'
  );
}

function itemDocumentKind(item: PersonaDistillationItem | null) {
  const sourceRef = itemSourceRef(item);
  const routing = itemRouting(item);
  const classification = itemSourceClassification(item);
  return (
    textValue(sourceRef.document_kind) ??
    textValue(routing.document_kind) ??
    textValue(classification.document_kind)
  );
}

function itemVectorTags(item: PersonaDistillationItem | null) {
  return stringList(itemRouting(item).vector_tags);
}

function itemReviewFlags(item: PersonaDistillationItem | null) {
  return stringList(itemPayload(item).review_flags);
}

function itemSourceKey(item: PersonaDistillationItem) {
  const sourceRef = itemSourceRef(item);
  return (
    textValue(sourceRef.document_id) ??
    textValue(sourceRef.source_id) ??
    textValue(sourceRef.memory_id) ??
    item.source_memory_id ??
    item.id
  );
}

function buildSourceSummaries(items: PersonaDistillationItem[]): DistillationSourceSummary[] {
  const summaries = new Map<string, DistillationSourceSummary>();
  for (const item of items) {
    const sourceRef = itemSourceRef(item);
    const key = itemSourceKey(item);
    const label =
      textValue(sourceRef.filename) ??
      textValue(sourceRef.document_id) ??
      textValue(sourceRef.memory_id) ??
      item.source_memory_id ??
      'source';
    const existing =
      summaries.get(key) ??
      ({
        key,
        label,
        memoryId: textValue(sourceRef.memory_id) ?? item.source_memory_id ?? null,
        classification: itemRoutingLabel(item),
        documentKind: itemDocumentKind(item),
        distillers: [],
        vectorTags: [],
        itemCount: 0,
        needsReviewCount: 0,
        approvedCount: 0,
      } satisfies DistillationSourceSummary);
    existing.itemCount += 1;
    if (item.needs_review || item.review_status === 'needs_review') {
      existing.needsReviewCount += 1;
    }
    if (item.review_status === 'approved') {
      existing.approvedCount += 1;
    }
    existing.distillers = Array.from(new Set([...existing.distillers, itemDistillerLabel(item)]));
    existing.vectorTags = Array.from(new Set([...existing.vectorTags, ...itemVectorTags(item)]));
    summaries.set(key, existing);
  }
  return Array.from(summaries.values()).sort((first, second) =>
    first.label.localeCompare(second.label)
  );
}

function sourceMapSummaries(sourceMap?: PersonaRunSourceMap | null): DistillationSourceSummary[] {
  return (sourceMap?.items ?? []).map((source) => ({
    key: source.key,
    label: source.label,
    memoryId: source.memory_id ?? null,
    classification: source.classification,
    documentKind: source.document_kind,
    distillers: source.distillers ?? [],
    vectorTags: source.vector_tags ?? [],
    itemCount: source.item_count,
    needsReviewCount: source.needs_review_count,
    approvedCount: source.approved_count,
  }));
}

function parsePackage(packageText: string) {
  if (!packageText.trim()) {
    return { packageValue: null, error: null };
  }
  try {
    return { packageValue: JSON.parse(packageText) as PersonaPackage, error: null };
  } catch (error) {
    return {
      packageValue: null,
      error: error instanceof Error ? error.message : 'Package JSON is invalid.',
    };
  }
}

function packageStats(personaPackage?: PersonaPackage | null) {
  if (!personaPackage) {
    return null;
  }
  const layers = personaPackage.memory_layers ?? {};
  return {
    knowledge: personaPackage.knowledge?.length ?? 0,
    decisions: personaPackage.decision_patterns?.length ?? 0,
    workflows: personaPackage.workflows?.length ?? 0,
    guardrails: personaPackage.guardrails?.length ?? 0,
    examples: personaPackage.examples?.length ?? 0,
    memory:
      (layers.semantic?.length ?? 0) +
      (layers.procedural?.length ?? 0) +
      (layers.episodic?.length ?? 0) +
      (layers.persona?.length ?? 0) +
      (layers.tool?.length ?? 0) +
      (layers.social?.length ?? 0),
  };
}

function statusBadgeVariant(status: string) {
  if (status === 'published' || status === 'approved') {
    return 'default' as const;
  }
  if (status === 'rejected' || status === 'archived') {
    return 'destructive' as const;
  }
  return 'secondary' as const;
}

function statusBadgeClass(status: string) {
  if (status === 'published' || status === 'approved' || status === 'completed') {
    return 'border-success-200 bg-success-50 text-success-800';
  }
  if (status === 'needs_review' || status === 'in_review' || status === 'draft') {
    return 'border-warning-200 bg-warning-50 text-warning-900';
  }
  if (status === 'rejected' || status === 'archived' || status === 'failed') {
    return 'border-destructive-200 bg-destructive-50 text-destructive-800';
  }
  return 'border-primary-200 bg-primary-50 text-primary-800';
}

function reviewRowClass(status: string, isSelected: boolean) {
  if (isSelected) {
    return 'bg-primary-50/80';
  }
  if (status === 'approved') {
    return 'bg-success-50/35';
  }
  if (status === 'rejected') {
    return 'bg-destructive-50/35';
  }
  if (status === 'needs_review') {
    return 'bg-warning-50/45';
  }
  return '';
}

function personaCardTone(status: string) {
  if (status === 'published' || status === 'approved') {
    return {
      accent: 'bg-success-500',
      avatar: 'border-success-200 bg-success-50 text-success-800',
      card: 'border-success-200 bg-success-50/35 hover:border-success-300',
    };
  }
  if (status === 'draft' || status === 'in_review' || status === 'needs_review') {
    return {
      accent: 'bg-warning-400',
      avatar: 'border-warning-200 bg-warning-50 text-warning-900',
      card: 'border-warning-200 bg-warning-50/45 hover:border-warning-300',
    };
  }
  if (status === 'rejected' || status === 'archived') {
    return {
      accent: 'bg-destructive-500',
      avatar: 'border-destructive-200 bg-destructive-50 text-destructive-800',
      card: 'border-destructive-200 bg-destructive-50/35 hover:border-destructive-300',
    };
  }
  return {
    accent: 'bg-primary-500',
    avatar: 'border-primary-200 bg-primary-50 text-primary-800',
    card: 'border-primary-200 bg-primary-50/35 hover:border-primary-300',
  };
}

function governanceOptions(catalog: PersonaGovernanceCatalog | undefined, key: string) {
  const values = catalog?.allowed_values?.[key] ?? [];
  return key === 'visibility' ? values.filter((value) => value !== 'marketplace') : values;
}

function orderedOptions<T extends string>(values: T[] | undefined, preferred: T, fallback: T[]) {
  const options = values?.length ? values : fallback;
  return Array.from(new Set([preferred, ...options]));
}

function mergeItems(items: PersonaDistillationItem[], updated: PersonaDistillationItem) {
  return items.map((item) => (item.id === updated.id ? updated : item));
}

function runTimestamp(run: PersonaDistillationRun) {
  const value = run.completed_at ?? run.updated_at ?? run.created_at;
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function latestRun(runs: PersonaDistillationRun[]) {
  return [...runs].sort((left, right) => runTimestamp(right) - runTimestamp(left))[0] ?? null;
}

function isApprovedRunStatus(status?: string | null) {
  return status === 'completed' || status === 'approved' || status === 'published';
}

interface PersonaFactoryWorkspaceProps {
  initialPersonaId?: string;
  viewMode?: 'list' | 'detail';
}

export default function PersonaFactoryWorkspace({
  initialPersonaId,
  viewMode = 'list',
}: PersonaFactoryWorkspaceProps = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isDetailPage = viewMode === 'detail';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPersonaState, setSelectedPersona] = useState<PersonaDefinition | null>(null);
  const [activeTab, setActiveTab] = useState('review');
  const [personaName, setPersonaName] = useState('');
  const [personaDescription, setPersonaDescription] = useState('');
  const [detailDraftState, setDetailDraftState] = useState({
    description: '',
    name: '',
    personaId: '',
  });
  const [personaDeleteMode, setPersonaDeleteMode] = useState(false);
  const [modelProfileId, setModelProfileId] = useState('');
  const [distillationMode, setDistillationMode] = useState<PersonaDistillationMode>('llm');
  const [llmModelSource, setLlmModelSource] = useState<PersonaLLMModelSource>('main_agent');
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  const [activeResult, setActiveResult] = useState<PersonaDistillResult | null>(null);
  const activeRunId = activeResult?.run.id ?? '';
  const [items, setItems] = useState<PersonaDistillationItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [packageText, setPackageText] = useState('');
  const [packageError, setPackageError] = useState<string | null>(null);
  const [publishedResult, setPublishedResult] = useState<PersonaPublishResult | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | PersonaItemType>('all');
  const [layerFilter, setLayerFilter] = useState<'all' | PersonaMemoryLayer>('all');
  const [needsReviewFilter, setNeedsReviewFilter] = useState<NeedsReviewFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [minConfidence, setMinConfidence] = useState(0);
  const itemPageKey = JSON.stringify({
    activeRunId,
    layerFilter,
    minConfidence,
    needsReviewFilter,
    sourceFilter,
    typeFilter,
  });
  const [itemPageState, setItemPageState] = useState({ key: itemPageKey, page: 0 });
  const itemPage = itemPageState.key === itemPageKey ? itemPageState.page : 0;
  const setItemPage = useCallback(
    (nextPage: number | ((currentPage: number) => number)) => {
      setItemPageState((currentState) => {
        const currentPage = currentState.key === itemPageKey ? currentState.page : 0;
        return {
          key: itemPageKey,
          page: typeof nextPage === 'function' ? nextPage(currentPage) : nextPage,
        };
      });
    },
    [itemPageKey]
  );
  const [bulkReviewConfirmAction, setBulkReviewConfirmAction] = useState<BulkReviewAction | null>(
    null
  );
  const [bulkReviewConfirmFilters, setBulkReviewConfirmFilters] =
    useState<ReviewFilterPayload | null>(null);
  const [selectedSourceDetailKey, setSelectedSourceDetailKey] = useState<string | null>(null);
  const [sourceDetailTab, setSourceDetailTab] = useState<'overview' | 'correction' | 'comparison'>(
    'overview'
  );
  const [sourceClassificationDraftState, setSourceClassificationDraftState] =
    useState<SourceClassificationDraft>({
      classification: '',
      confidence: '',
      contentRoles: '',
      documentKind: '',
      extractionTargets: '',
      memoryLayers: '',
      rationale: '',
      sourceKey: '',
      vectorTags: '',
    });
  const [sourceRedistillComparison, setSourceRedistillComparison] =
    useState<SourceRedistillComparison | null>(null);
  const [graphContextQuery, setGraphContextQuery] = useState('');
  const [graphContextPreset, setGraphContextPreset] =
    useState<PersonaGraphContextPreset>('persona_lineage');
  const [itemDraft, setItemDraft] = useState({
    title: '',
    content: '',
    confidence: '0.5',
    item_type: 'domain_knowledge' as PersonaItemType,
    memory_layer: 'semantic' as PersonaMemoryLayer,
    review_status: 'needs_review' as PersonaItemReviewStatus,
  });
  const [governance, setGovernance] = useState<Record<string, string>>({});
  const [runtimePrompt, setRuntimePrompt] = useState('Summarize what you can help with.');
  const [runtimeResult, setRuntimeResult] = useState<string | null>(null);
  const [runtimeResponse, setRuntimeResponse] = useState<ConversationPostMessageResponse | null>(
    null
  );

  const personasQuery = useQuery({
    queryKey: queryKeys.backendPersonas(),
    queryFn: () => personasApi.listPersonas(),
  });
  const routeSelectedPersona = initialPersonaId
    ? (personasQuery.data?.items.find((persona) => persona.id === initialPersonaId) ?? null)
    : null;
  const selectedPersona =
    initialPersonaId && selectedPersonaState?.id !== initialPersonaId
      ? routeSelectedPersona
      : selectedPersonaState;
  const selectedPersonaId = selectedPersona?.id ?? '';
  const defaultDetailDraft = {
    description: selectedPersona?.description ?? '',
    name: selectedPersona?.name ?? '',
    personaId: selectedPersonaId,
  };
  const detailDraft =
    detailDraftState.personaId === selectedPersonaId ? detailDraftState : defaultDetailDraft;
  const detailName = detailDraft.name;
  const detailDescription = detailDraft.description;
  const setDetailName = (name: string) => {
    setDetailDraftState((currentDraft) => ({
      ...(currentDraft.personaId === selectedPersonaId ? currentDraft : defaultDetailDraft),
      name,
      personaId: selectedPersonaId,
    }));
  };
  const setDetailDescription = (description: string) => {
    setDetailDraftState((currentDraft) => ({
      ...(currentDraft.personaId === selectedPersonaId ? currentDraft : defaultDetailDraft),
      description,
      personaId: selectedPersonaId,
    }));
  };
  const seedDetailDraftForPersona = useCallback((persona: PersonaDefinition | null) => {
    setDetailDraftState({
      description: persona?.description ?? '',
      name: persona?.name ?? '',
      personaId: persona?.id ?? '',
    });
  }, []);
  const memoriesQuery = useQuery({
    queryKey: queryKeys.backendMemories(),
    queryFn: () =>
      memoriesApi.listMemories({
        scope: 'user',
        memory_type: ['archive', 'fact', 'preference', 'decision', 'context_pack'],
        tags: ['persona-source'],
        limit: 120,
      }),
  });
  const profilesQuery = useQuery({
    queryKey: queryKeys.backendBehaviorProfiles(),
    queryFn: () => behaviorProfilesApi.listProfiles(),
  });
  const governanceQuery = useQuery({
    queryKey: queryKeys.backendPersonaGovernance(),
    queryFn: () => personasApi.getGovernanceLabels(),
  });
  const itemTypesQuery = useQuery({
    queryKey: queryKeys.backendPersonaItemTypes(),
    queryFn: () => personasApi.getItemTypes(),
  });
  const versionsQuery = useQuery({
    queryKey: queryKeys.backendPersonaVersions(selectedPersonaId),
    enabled: Boolean(selectedPersonaId),
    queryFn: () => personasApi.listVersions(selectedPersonaId),
  });
  const sourcesQuery = useQuery({
    queryKey: queryKeys.backendPersonaSources(selectedPersonaId),
    enabled: Boolean(selectedPersonaId),
    queryFn: () => personasApi.listSources(selectedPersonaId),
  });
  const runsQuery = useQuery({
    queryKey: queryKeys.backendPersonaRuns(selectedPersonaId),
    enabled: Boolean(selectedPersonaId),
    queryFn: () => personasApi.listRuns({ persona_id: selectedPersonaId }),
  });
  const graphContextQueryResult = useQuery({
    queryKey: queryKeys.backendPersonaGraphContext(
      selectedPersonaId,
      graphContextQuery,
      graphContextPreset
    ),
    enabled: Boolean(selectedPersonaId),
    queryFn: () =>
      personasApi.getGraphContext(selectedPersonaId, {
        query: graphContextQuery.trim() || undefined,
        preset: graphContextPreset,
        limit: 24,
      }),
  });
  const sourceMapQuery = useQuery({
    queryKey: queryKeys.backendPersonaRunSourceMap(activeRunId),
    enabled: Boolean(activeRunId),
    queryFn: () => personasApi.getRunSourceMap(activeRunId),
  });
  const runItemFilters = useMemo(
    () => ({
      source_key: sourceFilter === 'all' ? undefined : sourceFilter,
      item_type: typeFilter === 'all' ? undefined : typeFilter,
      memory_layer: layerFilter === 'all' ? undefined : layerFilter,
      needs_review:
        needsReviewFilter === 'needs_review'
          ? true
          : needsReviewFilter === 'ready'
            ? false
            : undefined,
      min_confidence: minConfidence > 0 ? minConfidence : undefined,
      limit: REVIEW_ITEM_PAGE_SIZE,
      offset: itemPage * REVIEW_ITEM_PAGE_SIZE,
    }),
    [itemPage, layerFilter, minConfidence, needsReviewFilter, sourceFilter, typeFilter]
  );
  const runItemsQuery = useQuery({
    queryKey: queryKeys.backendPersonaRunItems(activeRunId, runItemFilters),
    enabled: Boolean(activeRunId),
    queryFn: () => personasApi.listRunItems(activeRunId, runItemFilters),
  });
  const bulkReviewFilters = useMemo(
    (): ReviewFilterPayload => ({
      source_key: runItemFilters.source_key,
      item_type: runItemFilters.item_type,
      memory_layer: runItemFilters.memory_layer,
      needs_review: runItemFilters.needs_review,
      min_confidence: runItemFilters.min_confidence,
    }),
    [runItemFilters]
  );
  const sourceDetailQuery = useQuery({
    queryKey: queryKeys.backendPersonaRunSource(activeRunId, selectedSourceDetailKey ?? ''),
    enabled: Boolean(activeRunId && selectedSourceDetailKey),
    queryFn: () =>
      personasApi.getRunSource(activeRunId, selectedSourceDetailKey ?? '', {
        limit: 10,
      }),
  });
  const sourceClassificationSource = sourceDetailQuery.data?.source ?? null;
  const sourceClassificationSourceKey = sourceClassificationSource
    ? JSON.stringify({
        classification: sourceClassificationSource.classification ?? '',
        contentRoles: sourceClassificationSource.content_roles ?? [],
        documentKind: sourceClassificationSource.document_kind ?? '',
        extractionTargets: sourceClassificationSource.extraction_targets ?? [],
        key: sourceClassificationSource.key,
        memoryLayers: sourceClassificationSource.memory_layers ?? [],
        vectorTags: sourceClassificationSource.vector_tags ?? [],
      })
    : '';
  const defaultSourceClassificationDraft: SourceClassificationDraft = sourceClassificationSource
    ? {
        classification: sourceClassificationSource.classification ?? '',
        confidence: '',
        contentRoles: csv(sourceClassificationSource.content_roles),
        documentKind: sourceClassificationSource.document_kind ?? '',
        extractionTargets: csv(sourceClassificationSource.extraction_targets),
        memoryLayers: csv(sourceClassificationSource.memory_layers),
        rationale: '',
        sourceKey: sourceClassificationSourceKey,
        vectorTags: csv(sourceClassificationSource.vector_tags),
      }
    : {
        classification: '',
        confidence: '',
        contentRoles: '',
        documentKind: '',
        extractionTargets: '',
        memoryLayers: '',
        rationale: '',
        sourceKey: sourceClassificationSourceKey,
        vectorTags: '',
      };
  const sourceClassificationDraft =
    sourceClassificationDraftState.sourceKey === sourceClassificationSourceKey
      ? sourceClassificationDraftState
      : defaultSourceClassificationDraft;
  const setSourceClassificationDraft = (
    nextDraft: SetStateAction<Omit<SourceClassificationDraft, 'sourceKey'>>
  ) => {
    setSourceClassificationDraftState((currentDraft) => {
      const activeDraft =
        currentDraft.sourceKey === sourceClassificationSourceKey
          ? currentDraft
          : defaultSourceClassificationDraft;
      const editableDraft = {
        classification: activeDraft.classification,
        confidence: activeDraft.confidence,
        contentRoles: activeDraft.contentRoles,
        documentKind: activeDraft.documentKind,
        extractionTargets: activeDraft.extractionTargets,
        memoryLayers: activeDraft.memoryLayers,
        rationale: activeDraft.rationale,
        vectorTags: activeDraft.vectorTags,
      };
      const resolvedDraft = typeof nextDraft === 'function' ? nextDraft(editableDraft) : nextDraft;
      return {
        ...resolvedDraft,
        sourceKey: sourceClassificationSourceKey,
      };
    });
  };

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const selectedMemories = useMemo(() => {
    const selected = new Set(selectedMemoryIds);
    return (memoriesQuery.data?.items ?? []).filter((memory) => selected.has(memory.id));
  }, [memoriesQuery.data?.items, selectedMemoryIds]);

  const activePersona = publishedResult?.persona ?? activeResult?.persona ?? null;
  const approvedCount = items.filter((item) => item.review_status === 'approved').length;
  const rejectedCount = items.filter((item) => item.review_status === 'rejected').length;
  const needsReviewCount =
    sourceMapQuery.data?.needs_review_count ?? items.filter((item) => item.needs_review).length;

  const selectedSourceMemory = useMemo(() => {
    if (!selectedSourceId) {
      return null;
    }
    return (
      (memoriesQuery.data?.items ?? []).find((memory) => memory.id === selectedSourceId) ?? null
    );
  }, [memoriesQuery.data?.items, selectedSourceId]);

  const parsed = useMemo(() => parsePackage(packageText), [packageText]);
  const stats = packageStats(parsed.packageValue);
  const governanceDefaults = governanceQuery.data?.defaults ?? {};
  const modelProfiles = profilesQuery.data ?? [];
  const distillationModes = orderedOptions(
    itemTypesQuery.data?.distillation_modes,
    itemTypesQuery.data?.operational_settings?.default_distillation_mode ?? 'llm',
    DEFAULT_DISTILLATION_MODES
  );
  const llmBackedMode = distillationMode === 'llm' || distillationMode === 'hybrid';
  const llmModelSources = orderedOptions(
    itemTypesQuery.data?.llm_model_sources?.filter((source) => source !== 'model'),
    itemTypesQuery.data?.operational_settings?.default_llm_model_source ?? 'main_agent',
    DEFAULT_LLM_MODEL_SOURCES
  );
  const currentVersion = useMemo(() => {
    const versions = versionsQuery.data?.items ?? [];
    return (
      versions.find((version) => version.id === selectedPersona?.current_version_id) ??
      versions[0] ??
      null
    );
  }, [selectedPersona?.current_version_id, versionsQuery.data?.items]);
  const selectedPersonaStats = packageStats(currentVersion?.package);
  const sourceSummaries = useMemo(() => {
    const backendSummaries = sourceMapSummaries(sourceMapQuery.data);
    return backendSummaries.length ? backendSummaries : buildSourceSummaries(items);
  }, [items, sourceMapQuery.data]);
  const selectedLatestRun = useMemo(
    () => latestRun(runsQuery.data?.items ?? []),
    [runsQuery.data?.items]
  );

  const clientFilteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (sourceFilter !== 'all' && itemSourceKey(item) !== sourceFilter) {
          return false;
        }
        if (typeFilter !== 'all' && item.item_type !== typeFilter) {
          return false;
        }
        if (layerFilter !== 'all' && item.memory_layer !== layerFilter) {
          return false;
        }
        if (needsReviewFilter === 'needs_review' && !item.needs_review) {
          return false;
        }
        if (needsReviewFilter === 'ready' && item.needs_review) {
          return false;
        }
        return item.confidence >= minConfidence;
      }),
    [items, layerFilter, minConfidence, needsReviewFilter, sourceFilter, typeFilter]
  );
  const filteredItems = runItemsQuery.data?.items ?? clientFilteredItems;
  const filteredCount = runItemsQuery.data?.filtered_count ?? clientFilteredItems.length;
  const totalItemCount = runItemsQuery.data?.total ?? items.length;
  const visibleItemCount = filteredItems.length;
  const canPageBackward = itemPage > 0;
  const canPageForward = (itemPage + 1) * REVIEW_ITEM_PAGE_SIZE < filteredCount;
  const filteredReviewableItems = useMemo(
    () =>
      filteredItems.filter(
        (item) =>
          item.review_status !== 'approved' &&
          item.review_status !== 'rejected' &&
          item.review_status !== 'superseded'
      ),
    [filteredItems]
  );

  function selectItem(item: PersonaDistillationItem, options: { openEditor?: boolean } = {}) {
    const { openEditor = true } = options;
    setSelectedItemId(item.id);
    setSelectedSourceId(item.source_memory_id ?? null);
    setItemDraft({
      title: item.title,
      content: item.content,
      confidence: String(item.confidence),
      item_type: item.item_type,
      memory_layer: item.memory_layer,
      review_status: item.review_status,
    });
    setIsItemEditorOpen(openEditor);
  }

  const clearActiveResultState = useCallback(() => {
    setActiveResult(null);
    setItems([]);
    setSelectedItemId(null);
    setIsItemEditorOpen(false);
    setSelectedSourceId(null);
    setSelectedSourceDetailKey(null);
    setSourceFilter('all');
    setItemPage(0);
    setPackageText('');
    setPackageError(null);
    setPublishedResult(null);
    setRuntimeResult(null);
    setRuntimeResponse(null);
  }, [setItemPage]);

  const selectPersona = useCallback(
    (persona: PersonaDefinition) => {
      setSelectedPersona(persona);
      seedDetailDraftForPersona(persona);
      setPersonaDeleteMode(false);
      setGraphContextQuery('');
      setGraphContextPreset('persona_lineage');
      setRuntimeResponse(null);
      setRuntimeResult(null);
      setIsCreateOpen(false);
      if (activeResult?.persona.id !== persona.id) {
        clearActiveResultState();
      }
    },
    [activeResult?.persona.id, clearActiveResultState, seedDetailDraftForPersona]
  );

  function openPersonaWorkspace(persona: PersonaDefinition) {
    if (isDetailPage) {
      selectPersona(persona);
      return;
    }
    router.push(`/persona/${persona.id}`);
  }

  function sourceClassificationPayload(): PersonaSourceClassificationPatch {
    const confidence = Number(sourceClassificationDraft.confidence);
    return {
      classification: sourceClassificationDraft.classification.trim() || null,
      document_kind: sourceClassificationDraft.documentKind.trim() || null,
      content_roles: commaList(sourceClassificationDraft.contentRoles),
      extraction_targets: commaList(sourceClassificationDraft.extractionTargets),
      memory_layers: commaList(sourceClassificationDraft.memoryLayers),
      vector_tags: commaList(sourceClassificationDraft.vectorTags),
      confidence: Number.isFinite(confidence) ? confidence : null,
      rationale: sourceClassificationDraft.rationale.trim() || null,
    };
  }

  const updatePersonaMutation = useMutation({
    mutationFn: () => {
      if (!selectedPersona) {
        throw new Error('Select a persona first.');
      }
      return personasApi.updatePersona(selectedPersona.id, {
        name: detailName.trim(),
        description: detailDescription.trim() || null,
      });
    },
    onSuccess: (persona) => {
      setSelectedPersona(persona);
      setPersonaName(persona.name);
      setPersonaDescription(persona.description ?? '');
      void queryClient.invalidateQueries({ queryKey: queryKeys.backendPersonas() });
      toast.success('Persona updated.', { position: 'top-right' });
    },
  });

  const deletePersonaMutation = useMutation({
    mutationFn: (personaId: string) => personasApi.archivePersona(personaId),
    onSuccess: () => {
      setPersonaDeleteMode(false);
      setSelectedPersona(null);
      seedDetailDraftForPersona(null);
      clearActiveResultState();
      void queryClient.invalidateQueries({ queryKey: queryKeys.backendPersonas() });
      if (isDetailPage) {
        router.push('/persona');
      }
      toast.success('Persona deleted.', { position: 'top-right' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete persona.', {
        position: 'top-right',
      });
    },
  });

  const loadRunMutation = useMutation({
    mutationFn: (runId: string) => personasApi.getRun(runId),
    onSuccess: (result) => {
      setActiveResult(result);
      setSelectedPersona(result.persona);
      seedDetailDraftForPersona(result.persona);
      setPublishedResult(null);
      setItems(result.items);
      setSelectedMemoryIds(
        Array.from(
          new Set(
            (result.run.input_source_ids.length
              ? result.run.input_source_ids
              : result.items.map((item) => item.source_memory_id)
            ).filter((value): value is string => Boolean(value))
          )
        )
      );
      setPackageText(JSON.stringify(result.run.output_package, null, 2));
      setPackageError(null);
      setSelectedItemId(result.items[0]?.id ?? null);
      setSelectedSourceId(result.items[0]?.source_memory_id ?? null);
      setActiveTab('review');
      setIsCreateOpen(false);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSourceMap(result.run.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunItems(result.run.id),
      });
      toast.success('Persona run loaded.', { position: 'top-right' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Persona run could not be loaded.', {
        position: 'top-right',
      });
    },
  });

  useEffect(() => {
    if (!selectedPersonaId || !selectedLatestRun) {
      return;
    }
    if (activeResult?.run.id === selectedLatestRun.id || loadRunMutation.isPending) {
      return;
    }
    loadRunMutation.mutate(selectedLatestRun.id);
  }, [activeResult?.run.id, loadRunMutation, selectedLatestRun, selectedPersonaId]);

  const distillMutation = useMutation({
    mutationFn: () =>
      personasApi.distill({
        name: personaName,
        description: personaDescription,
        source_memory_ids: selectedMemoryIds,
        distillation_mode: distillationMode,
        llm_model_source: llmBackedMode ? llmModelSource : null,
        model_profile_id:
          llmBackedMode && llmModelSource === 'main_agent' ? null : modelProfileId.trim() || null,
        persona_type: governance.persona_type ?? governanceDefaults.persona_type,
        capability_mode: governance.capability_mode ?? governanceDefaults.capability_mode,
        consent_status: governance.consent_status ?? governanceDefaults.consent_status,
        source_basis: governance.source_basis ?? governanceDefaults.source_basis,
        sensitivity_level: governance.sensitivity_level ?? governanceDefaults.sensitivity_level,
        visibility: governance.visibility ?? governanceDefaults.visibility,
      }),
    onSuccess: (result) => {
      setActiveResult(result);
      setSelectedPersona(result.persona);
      seedDetailDraftForPersona(result.persona);
      setItems(result.items);
      if (result.items[0]) {
        selectItem(result.items[0], { openEditor: false });
      } else {
        setSelectedItemId(null);
        setIsItemEditorOpen(false);
        setSelectedSourceId(null);
      }
      setPackageText(JSON.stringify(result.run.output_package, null, 2));
      setPackageError(null);
      setPublishedResult(null);
      setSourceFilter('all');
      setItemPage(0);
      setActiveTab('review');
      setIsCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.backendPersonas() });
      toast.success('Persona draft generated.', { position: 'top-right' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to generate persona draft.', {
        position: 'top-right',
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: () => {
      if (!selectedItem) {
        throw new Error('Select an extracted item first.');
      }
      return personasApi.updateItem(selectedItem.id, {
        title: itemDraft.title,
        content: itemDraft.content,
        confidence: Number(itemDraft.confidence),
        item_type: itemDraft.item_type,
        memory_layer: itemDraft.memory_layer,
        review_status: itemDraft.review_status,
        needs_review: itemDraft.review_status === 'needs_review',
      });
    },
    onSuccess: (updated) => {
      setItems((current) => mergeItems(current, updated));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSourceMap(updated.run_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunItems(updated.run_id),
      });
      toast.success('Extracted item saved.', { position: 'top-right' });
    },
  });

  const approveItemMutation = useMutation({
    mutationFn: (itemId: string) => personasApi.approveItem(itemId),
    onSuccess: (updated) => {
      setItems((current) => mergeItems(current, updated));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSourceMap(updated.run_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunItems(updated.run_id),
      });
      toast.success('Item approved.', { position: 'top-right' });
    },
  });

  const rejectItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      personasApi.rejectItem(itemId, 'Rejected from Persona Factory review.'),
    onSuccess: (updated) => {
      setItems((current) => mergeItems(current, updated));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSourceMap(updated.run_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunItems(updated.run_id),
      });
      toast.success('Item rejected.', { position: 'top-right' });
    },
  });

  const bulkReviewMutation = useMutation({
    mutationFn: ({ action, itemIds }: { action: BulkReviewAction; itemIds: string[] }) =>
      personasApi.bulkReviewItems({
        action,
        item_ids: itemIds,
        reason: action === 'reject' ? 'Rejected from Persona Factory bulk review.' : null,
      }),
    onSuccess: (result, variables) => {
      setItems((current) =>
        result.items.reduce((next, updated) => mergeItems(next, updated), current)
      );
      const runId = result.items[0]?.run_id;
      if (runId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.backendPersonaRunSourceMap(runId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.backendPersonaRunItems(runId),
        });
      }
      toast.success(
        variables.action === 'approve'
          ? `${result.count} visible items approved.`
          : `${result.count} visible items rejected.`,
        { position: 'top-right' }
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Bulk review failed.', {
        position: 'top-right',
      });
    },
  });

  const bulkReviewFilteredMutation = useMutation({
    mutationFn: ({
      action,
      filters,
    }: {
      action: BulkReviewAction;
      filters?: ReviewFilterPayload | null;
    }) => {
      if (!activeRunId) {
        throw new Error('Generate a persona draft before reviewing filtered items.');
      }
      return personasApi.bulkReviewRunItems(activeRunId, {
        action,
        filters: filters ?? bulkReviewConfirmFilters ?? bulkReviewFilters,
        limit: 250,
        reason: action === 'reject' ? 'Rejected from Persona Factory filtered bulk review.' : null,
      });
    },
    onSuccess: (result, variables) => {
      setItems((current) =>
        result.items.reduce((next, updated) => mergeItems(next, updated), current)
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSourceMap(result.run_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunItems(result.run_id),
      });
      if (selectedSourceDetailKey) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.backendPersonaRunSource(result.run_id, selectedSourceDetailKey),
        });
      }
      setBulkReviewConfirmAction(null);
      setBulkReviewConfirmFilters(null);
      toast.success(
        variables.action === 'approve'
          ? `${result.count} filtered items approved.`
          : `${result.count} filtered items rejected.`,
        { position: 'top-right' }
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Filtered bulk review failed.', {
        position: 'top-right',
      });
    },
  });

  const bulkReviewPreviewMutation = useMutation({
    mutationFn: ({
      action,
      filters,
    }: {
      action: BulkReviewAction;
      filters?: ReviewFilterPayload | null;
    }) => {
      if (!activeRunId) {
        throw new Error('Generate a persona draft before previewing filtered review.');
      }
      return personasApi.previewBulkReviewRunItems(activeRunId, {
        action,
        filters: filters ?? bulkReviewFilters,
        limit: 250,
      });
    },
    onSuccess: (_result, variables) => {
      setBulkReviewConfirmAction(variables.action);
      setBulkReviewConfirmFilters(variables.filters ?? bulkReviewFilters);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Filtered bulk review preview failed.', {
        position: 'top-right',
      });
    },
  });

  const updateSourceClassificationMutation = useMutation({
    mutationFn: (payload: PersonaSourceClassificationPatch) => {
      if (!activeRunId || !selectedSourceDetailKey) {
        throw new Error('Open a source before updating its classification.');
      }
      return personasApi.updateRunSourceClassification(
        activeRunId,
        selectedSourceDetailKey,
        payload
      );
    },
    onSuccess: (result: PersonaRunSourceClassificationResult) => {
      setItems((current) =>
        result.source_detail.items.reduce((next, updated) => mergeItems(next, updated), current)
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSourceMap(result.run_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunItems(result.run_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSource(result.run_id, result.source_key),
      });
      toast.success('Source classification saved.', { position: 'top-right' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Source classification update failed.', {
        position: 'top-right',
      });
    },
  });

  const redistillSourceMutation = useMutation({
    mutationFn: () => {
      if (!activeRunId || !selectedSourceDetailKey) {
        throw new Error('Open a source before re-distilling it.');
      }
      return personasApi.redistillRunSource(activeRunId, selectedSourceDetailKey, { limit: 250 });
    },
    onSuccess: (result: PersonaRunSourceRedistillResult) => {
      setItems((current) => {
        const updated = result.superseded_items.reduce(
          (next, item) => mergeItems(next, item),
          current
        );
        const existingIds = new Set(updated.map((item) => item.id));
        return [...updated, ...result.items.filter((item) => !existingIds.has(item.id))];
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSourceMap(result.run_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunItems(result.run_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSource(result.run_id, result.source_key),
      });
      setSourceRedistillComparison({
        sourceKey: result.source_key,
        supersededItems: result.superseded_items,
        createdItems: result.items,
      });
      setSourceDetailTab('comparison');
      toast.success(
        `${result.created_count} new extracted items created; ${result.superseded_count} old items superseded.`,
        { position: 'top-right' }
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Source re-distill failed.', {
        position: 'top-right',
      });
    },
  });

  const normalizeMutation = useMutation({
    mutationFn: () => personasApi.normalizeRun(activeResult?.run.id ?? ''),
    onSuccess: (result) => {
      setItems(result.items);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSourceMap(result.run.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunItems(result.run.id),
      });
      toast.success('Items normalized.', { position: 'top-right' });
    },
  });

  const synthesizeMutation = useMutation({
    mutationFn: () => personasApi.synthesizeRun(activeResult?.run.id ?? ''),
    onSuccess: (result) => {
      setActiveResult(result);
      setItems(result.items);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunSourceMap(result.run.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRunItems(result.run.id),
      });
      setPackageText(JSON.stringify(result.run.output_package, null, 2));
      setPackageError(null);
      setActiveTab('package');
      toast.success('Package synthesized from reviewed items.', { position: 'top-right' });
    },
  });

  const savePackageMutation = useMutation({
    mutationFn: (personaPackage: PersonaPackage) =>
      personasApi.updateRunPackage(activeResult?.run.id ?? '', personaPackage),
    onSuccess: (run) => {
      if (activeResult) {
        setActiveResult({ ...activeResult, run });
      }
      setActiveTab('publish');
      toast.success('Package saved.', { position: 'top-right' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Package save failed.', {
        position: 'top-right',
      });
    },
  });

  const approveRunMutation = useMutation({
    mutationFn: () => {
      if (!activeResult?.run.id) {
        throw new Error('Select a persona package before approving.');
      }
      return personasApi.approveRun(activeResult.run.id);
    },
    onSuccess: (result) => {
      setActiveResult({
        persona: result.persona,
        run: result.run,
        sources: activeResult?.sources ?? [],
        items,
      });
      setSelectedPersona(result.persona);
      void queryClient.invalidateQueries({ queryKey: queryKeys.backendPersonas() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRuns(result.persona.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaVersions(result.persona.id),
      });
      setActiveTab('publish');
      toast.success('Persona package approved.', { position: 'top-right' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Persona package approval failed.', {
        position: 'top-right',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => {
      if (!activeResult?.run.id) {
        throw new Error('Select a persona package before publishing.');
      }
      if (!packageApproved) {
        throw new Error('Approve the package before publishing the persona.');
      }
      return personasApi.publishRun(activeResult.run.id);
    },
    onSuccess: (result) => {
      setPublishedResult(result);
      setActiveResult((current) => (current ? { ...current, persona: result.persona } : current));
      setSelectedPersona(result.persona);
      void queryClient.invalidateQueries({ queryKey: queryKeys.backendPersonas() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaRuns(result.persona.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backendPersonaVersions(result.persona.id),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backendAgents() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() });
      setActiveTab('runtime');
      toast.success('Persona published.', { position: 'top-right' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Persona publish failed.', {
        position: 'top-right',
      });
    },
  });

  const runtimeMutation = useMutation({
    onMutate: () => {
      setRuntimeResponse(null);
      setRuntimeResult(null);
    },
    mutationFn: async () => {
      const persona = publishedResult?.persona ?? activeResult?.persona;
      if (!persona?.slug) {
        throw new Error('Publish or select a persona first.');
      }
      const conversationId = `persona-runtime-${Date.now()}`;
      await conversationsApi.createConversation({
        id: conversationId,
        channel_type: 'api',
        metadata: { source: 'persona_factory_runtime_panel' },
      });
      const prompt = `@${persona.slug} ${runtimePrompt}`;
      return conversationsApi.postMessage(conversationId, {
        message: {
          role: 'user',
          message_type: 'user_text',
          plain_text: prompt,
          content: { text: prompt },
        },
        response_mode: 'sync',
      });
    },
    onSuccess: (result) => {
      setRuntimeResponse(result);
      setRuntimeResult(
        result.assistant_message?.plain_text ?? 'Persona invocation returned no assistant text.'
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Persona runtime test failed.', {
        position: 'top-right',
      });
    },
  });

  const toggleMemory = (memoryId: string) => {
    setSelectedMemoryIds((current) =>
      current.includes(memoryId)
        ? current.filter((item) => item !== memoryId)
        : [...current, memoryId]
    );
  };

  const removeSelectedMemory = (memoryId: string) => {
    setSelectedMemoryIds((current) => current.filter((item) => item !== memoryId));
  };

  const savePackage = () => {
    if (!activeResult) {
      return;
    }
    const next = parsePackage(packageText);
    setPackageError(next.error);
    if (next.packageValue) {
      savePackageMutation.mutate(next.packageValue);
    }
  };

  const canDistill =
    personaName.trim().length > 0 &&
    selectedMemoryIds.length > 0 &&
    (!llmBackedMode || llmModelSource !== 'model_profile' || modelProfileId.trim().length > 0);
  const canUsePackage = Boolean(activeResult && parsed.packageValue && !parsed.error);
  const packageApproved = Boolean(
    activeResult &&
    (isApprovedRunStatus(activeResult.run.status) ||
      activePersona?.status === 'approved' ||
      activePersona?.status === 'published')
  );
  const isPublished = activePersona?.status === 'published';
  const activeLifecycleStep = isPublished
    ? 5
    : packageApproved
      ? 4
      : canUsePackage
        ? 3
        : activeResult
          ? 2
          : 1;
  const displayedLifecycleStep =
    activeTab === 'review' && activeResult
      ? 2
      : activeTab === 'package' && activeResult
        ? 3
        : activeTab === 'publish' && canUsePackage
          ? 4
          : activeTab === 'runtime' && isPublished
            ? 5
            : activeLifecycleStep;
  const itemCatalog = itemTypesQuery.data;
  const personas = personasQuery.data?.items ?? [];
  const activeResultBelongsToSelected =
    Boolean(activeResult) && (!selectedPersona || activeResult?.persona.id === selectedPersona.id);

  function renderPersonaDetailSections() {
    if (!selectedPersona) {
      return (
        <section className="rounded-lg border border-dashed border-border bg-muted/25 p-6 text-sm text-muted-foreground">
          {personasQuery.isLoading
            ? 'Loading persona detail.'
            : 'Persona was not found. Return to the persona list and select another persona.'}
        </section>
      );
    }

    return (
      <div className="space-y-4">
        <section className="rounded-lg border border-primary-200 bg-primary-50/35 p-4 shadow-sm shadow-primary/5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Persona</Badge>
            <Badge
              variant={statusBadgeVariant(selectedPersona.status)}
              className={statusBadgeClass(selectedPersona.status)}
            >
              {selectedPersona.status}
            </Badge>
            <Badge variant="outline">@{selectedPersona.slug}</Badge>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <Field label="Name" htmlFor="persona-detail-name">
              <Input
                id="persona-detail-name"
                value={detailName}
                onChange={(event) => setDetailName(event.target.value)}
              />
            </Field>
            <div className="lg:col-span-2">
              <Field label="Description" htmlFor="persona-detail-description">
                <Textarea
                  id="persona-detail-description"
                  rows={4}
                  value={detailDescription}
                  onChange={(event) => setDetailDescription(event.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={
                !detailName.trim() ||
                updatePersonaMutation.isPending ||
                deletePersonaMutation.isPending
              }
              onClick={() => updatePersonaMutation.mutate()}
            >
              <Save className="mr-2 h-4 w-4" />
              Save persona
            </Button>
            {personaDeleteMode ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deletePersonaMutation.isPending}
                  onClick={() => deletePersonaMutation.mutate(selectedPersona.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deletePersonaMutation.isPending ? 'Deleting...' : 'Confirm delete'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deletePersonaMutation.isPending}
                  onClick={() => setPersonaDeleteMode(false)}
                >
                  Cancel delete
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={updatePersonaMutation.isPending || deletePersonaMutation.isPending}
                onClick={() => setPersonaDeleteMode(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete persona
              </Button>
            )}
          </div>
        </section>

        <details className="rounded-lg border border-border bg-background p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Show more persona details
          </summary>
          <div className="mt-4 space-y-4">
            <section className="rounded-lg border border-success-200 bg-success-50/35 p-4">
              <Badge variant="secondary">Runtime details</Badge>
              <dl className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <DetailRow label="Created" value={formatDateTime(selectedPersona.created_at)} />
                <DetailRow label="Updated" value={formatDateTime(selectedPersona.updated_at)} />
                <DetailRow
                  label="Agent"
                  value={selectedPersona.published_agent_id ?? 'Not published'}
                />
                <DetailRow label="Version" value={currentVersion?.version ?? 'No version'} />
              </dl>
            </section>

            {selectedPersonaStats ? (
              <section className="rounded-lg border border-warning-200 bg-warning-50/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Badge variant="secondary">Package details</Badge>
                    <h2 className="mt-2 text-sm font-semibold text-foreground">
                      Current version package
                    </h2>
                  </div>
                  <Badge variant="outline">{currentVersion?.version ?? 'No version'}</Badge>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {Object.entries(selectedPersonaStats).map(([key, value]) => (
                    <StepStat key={key} label={key} tone="warning" value={value} />
                  ))}
                </div>
              </section>
            ) : null}

            <PersonaGraphContextPanel
              graphContext={graphContextQueryResult.data}
              isError={graphContextQueryResult.isError}
              isLoading={graphContextQueryResult.isLoading || graphContextQueryResult.isFetching}
              onRefresh={() => void graphContextQueryResult.refetch()}
              preset={graphContextPreset}
              query={graphContextQuery}
              setPreset={setGraphContextPreset}
              setQuery={setGraphContextQuery}
            />
          </div>
        </details>

        <details className="rounded-lg border border-secondary-200 bg-secondary-50/20 p-4 dark:border-white/10 dark:bg-white/4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Show source, version, and run history
          </summary>
          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-secondary-200 bg-secondary-50/30 p-4">
              <h3 className="text-sm font-semibold text-foreground">Source lineage</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Input material linked to this persona.
              </p>
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {sourcesQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading sources...</p>
                ) : null}
                {(sourcesQuery.data?.items ?? []).map((source) => (
                  <div
                    key={source.id}
                    className="rounded-md border border-secondary-100 bg-background p-2 text-xs dark:border-white/10"
                  >
                    <p className="font-medium text-foreground">
                      {source.filename || source.source_id || source.source_type}
                    </p>
                    <p className="mt-1 text-muted-foreground">{source.source_type}</p>
                  </div>
                ))}
                {!sourcesQuery.isLoading && !(sourcesQuery.data?.items ?? []).length ? (
                  <p className="text-xs text-muted-foreground">No sources recorded.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-success-200 bg-success-50/30 p-4">
              <h3 className="text-sm font-semibold text-foreground">Versions</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Approved and published package versions.
              </p>
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {versionsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading versions...</p>
                ) : null}
                {(versionsQuery.data?.items ?? []).map((version) => (
                  <div
                    key={version.id}
                    className="rounded-md border border-success-100 bg-background p-2 text-xs dark:border-white/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{version.version}</span>
                      <Badge
                        variant={statusBadgeVariant(version.status)}
                        className={statusBadgeClass(version.status)}
                      >
                        {version.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {formatDateTime(version.published_at ?? version.created_at)}
                    </p>
                  </div>
                ))}
                {!versionsQuery.isLoading && !(versionsQuery.data?.items ?? []).length ? (
                  <p className="text-xs text-muted-foreground">No versions recorded.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-warning-200 bg-warning-50/30 p-4">
              <h3 className="text-sm font-semibold text-foreground">Distillation runs</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Draft generation and review history.
              </p>
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {runsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading runs...</p>
                ) : null}
                {(runsQuery.data?.items ?? []).map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    className="block w-full rounded-md border border-warning-100 bg-background p-2 text-left text-xs transition-colors hover:border-warning-300 hover:bg-muted/30 dark:border-white/10"
                    onClick={() => loadRunMutation.mutate(run.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{run.id}</span>
                      <Badge
                        variant={statusBadgeVariant(run.status)}
                        className={statusBadgeClass(run.status)}
                      >
                        {run.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {formatDateTime(run.completed_at ?? run.created_at)}
                    </p>
                  </button>
                ))}
                {!runsQuery.isLoading && !(runsQuery.data?.items ?? []).length ? (
                  <p className="text-xs text-muted-foreground">No runs recorded.</p>
                ) : null}
              </div>
            </div>
          </section>
        </details>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-375 flex-col gap-5">
        <PageHeader
          icon={UserRoundCog}
          tone="persona"
          title={isDetailPage ? (selectedPersona?.name ?? 'Persona detail') : 'Personas'}
          description={
            isDetailPage
              ? 'Source lineage, versions, package shape, runtime bindings, and distillation review in one workspace.'
              : 'Create reviewed runtime personas from source files, existing memory, and governance labels.'
          }
          actions={
            <>
              {isDetailPage ? (
                <Button type="button" variant="outline" onClick={() => router.push('/persona')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Personas
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => void personasQuery.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </>
          }
        />

        {!isDetailPage ? (
          <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="agency-card rounded-lg border border-dashed border-secondary-300 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-secondary-200 bg-secondary-50 text-secondary-800 dark:border-cyan-400/20 dark:bg-white/10 dark:text-cyan-100">
                      <UserRoundCog className="h-4 w-4" />
                    </span>
                    <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
                      Create Persona
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    A persona is a governed runtime identity built from source material. It can
                    represent professional expertise, a personal writing style, or a familiar
                    relationship pattern when the source and consent labels support it.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <FactoryStepCard
                  index={1}
                  title="Add identity"
                  description="Name and describe the persona. This is required."
                />
                <FactoryStepCard
                  index={2}
                  title="Attach sources"
                  description="Upload files or select existing memory. At least one source is required."
                />
                <FactoryStepCard
                  index={3}
                  title="Review and publish"
                  description="Approve extracted items before the persona becomes usable."
                />
              </div>
              <Button
                type="button"
                className="mt-5 w-full justify-center"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Persona
              </Button>
            </div>

            <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-sm shadow-primary/5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
                    Persona List
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Existing drafts and published runtime identities.
                  </p>
                </div>
                <Badge variant="secondary">{personas.length} total</Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {personasQuery.isLoading ? (
                  <LoadingCard title="Loading" description="Loading personas..." />
                ) : null}
                {personasQuery.isError ? (
                  <ErrorAlert title="Personas unavailable" message="Failed to load personas." />
                ) : null}
                {personas.map((persona: PersonaDefinition) => {
                  const tone = personaCardTone(persona.status);
                  const isSelected = selectedPersona?.id === persona.id;

                  return (
                    <div
                      key={persona.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select ${persona.name}`}
                      aria-pressed={isSelected}
                      className={cn(
                        'relative min-h-28 cursor-pointer overflow-hidden rounded-md border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-300 dark:hover:bg-white/10 dark:hover:shadow-none',
                        tone.card,
                        isSelected &&
                          'border-primary-400 bg-primary-50 shadow-sm shadow-primary/10 dark:bg-cyan-400/10 dark:shadow-none'
                      )}
                      onClick={() => openPersonaWorkspace(persona)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openPersonaWorkspace(persona);
                        }
                      }}
                    >
                      <span className={cn('absolute inset-x-0 top-0 h-1', tone.accent)} />
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                              tone.avatar
                            )}
                          >
                            <UserRoundCog className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                            {persona.name}
                          </span>
                        </span>
                        <Badge
                          variant={statusBadgeVariant(persona.status)}
                          className={statusBadgeClass(persona.status)}
                        >
                          {persona.status}
                        </Badge>
                      </div>
                      <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">
                        @{persona.slug}
                      </p>
                      {persona.description ? (
                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                          {persona.description}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                {!personasQuery.isLoading && !personas.length ? (
                  <div className="md:col-span-2 xl:col-span-3">
                    <EmptyCard
                      title="No personas"
                      description="Create the first persona from source memory."
                    />
                  </div>
                ) : null}
              </div>
            </section>
          </section>
        ) : (
          renderPersonaDetailSections()
        )}

        {selectedPersona ? (
          activeResult && activeResultBelongsToSelected ? (
            <section className="space-y-4">
              <div className="rounded-lg border border-primary-200 bg-primary-50/30 p-4 shadow-sm shadow-primary/5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Distillation</Badge>
                      <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
                        Review workspace
                      </h2>
                      <Badge
                        variant={statusBadgeVariant(activeResult.persona.status)}
                        className={statusBadgeClass(activeResult.persona.status)}
                      >
                        {activeResult.persona.status}
                      </Badge>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        @{activeResult.persona.slug}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Review extracted items for @{activeResult.persona.slug}, then synthesize and
                      publish the persona package.
                    </p>
                  </div>
                  <details className="rounded-md border border-primary-100 bg-white/70 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    <summary className="cursor-pointer font-medium text-slate-800 dark:text-slate-200">
                      Show review counts
                    </summary>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <StepStat label="sources" tone="primary" value={selectedMemoryIds.length} />
                      <StepStat label="items" value={items.length} />
                      <StepStat label="approved" tone="success" value={approvedCount} />
                      <StepStat label="rejected" tone="destructive" value={rejectedCount} />
                    </div>
                  </details>
                </div>
              </div>

              <section className="rounded-lg border border-primary-100 bg-white p-4 shadow-sm shadow-primary/5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                <div className="grid gap-2 md:grid-cols-5">
                  <LifecycleStep
                    index={1}
                    title="Draft"
                    status={displayedLifecycleStep > 1 ? 'done' : 'active'}
                    actionLabel="Edit sources"
                    onAction={() => setIsCreateOpen(true)}
                  />
                  <LifecycleStep
                    index={2}
                    title="Review"
                    status={
                      displayedLifecycleStep > 2
                        ? 'done'
                        : displayedLifecycleStep === 2
                          ? 'active'
                          : 'locked'
                    }
                    actionLabel="Review items"
                    onAction={() => setActiveTab('review')}
                  />
                  <LifecycleStep
                    index={3}
                    title="Package"
                    status={
                      displayedLifecycleStep > 3
                        ? 'done'
                        : displayedLifecycleStep === 3
                          ? 'active'
                          : 'locked'
                    }
                    actionLabel="Synthesize"
                    disabled={!activeResult || synthesizeMutation.isPending}
                    onAction={() => synthesizeMutation.mutate()}
                  />
                  <LifecycleStep
                    index={4}
                    title="Publish"
                    status={
                      displayedLifecycleStep > 4
                        ? 'done'
                        : displayedLifecycleStep === 4
                          ? 'active'
                          : 'locked'
                    }
                    actionLabel={packageApproved ? 'Publish' : 'Approve'}
                    disabled={
                      packageApproved
                        ? !activeResult || publishMutation.isPending
                        : !canUsePackage || approveRunMutation.isPending
                    }
                    onAction={() =>
                      packageApproved ? publishMutation.mutate() : approveRunMutation.mutate()
                    }
                  />
                  <LifecycleStep
                    index={5}
                    title="Use"
                    status={displayedLifecycleStep === 5 ? 'active' : 'locked'}
                    actionLabel="Test"
                    disabled={!isPublished}
                    onAction={() => setActiveTab('runtime')}
                  />
                </div>
              </section>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                  <TabsTrigger value="review">2. Review</TabsTrigger>
                  <TabsTrigger value="package">3. Package</TabsTrigger>
                  <TabsTrigger value="publish">4. Publish</TabsTrigger>
                  <TabsTrigger value="runtime">5. Use</TabsTrigger>
                </TabsList>

                <TabsContent value="review" className="space-y-4">
                  <section className="rounded-lg border border-primary-100 bg-white p-4 shadow-sm shadow-primary/5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                          Review extracted items
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Select an item to edit it and check its evidence.
                        </p>
                        <details className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <summary className="cursor-pointer">Show item counts</summary>
                          <p className="mt-1">
                            {visibleItemCount} visible of {filteredCount} matching records ·{' '}
                            {totalItemCount} extracted total · {needsReviewCount} need review
                          </p>
                        </details>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!filteredReviewableItems.length || bulkReviewMutation.isPending}
                          onClick={() =>
                            bulkReviewMutation.mutate({
                              action: 'approve',
                              itemIds: filteredReviewableItems.map((item) => item.id),
                            })
                          }
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Approve visible
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            !filteredCount ||
                            bulkReviewFilteredMutation.isPending ||
                            bulkReviewPreviewMutation.isPending
                          }
                          onClick={() =>
                            bulkReviewPreviewMutation.mutate({
                              action: 'approve',
                            })
                          }
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve filtered
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!filteredReviewableItems.length || bulkReviewMutation.isPending}
                          onClick={() =>
                            bulkReviewMutation.mutate({
                              action: 'reject',
                              itemIds: filteredReviewableItems.map((item) => item.id),
                            })
                          }
                        >
                          <X className="mr-2 h-4 w-4" />
                          Reject visible
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            !filteredCount ||
                            bulkReviewFilteredMutation.isPending ||
                            bulkReviewPreviewMutation.isPending
                          }
                          onClick={() =>
                            bulkReviewPreviewMutation.mutate({
                              action: 'reject',
                            })
                          }
                        >
                          <X className="mr-2 h-4 w-4" />
                          Reject filtered
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!activeResult || normalizeMutation.isPending}
                          onClick={() => normalizeMutation.mutate()}
                        >
                          <SlidersHorizontal className="mr-2 h-4 w-4" />
                          Normalize
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!activeResult || synthesizeMutation.isPending}
                          onClick={() => synthesizeMutation.mutate()}
                        >
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Synthesize
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-4">
                      <FilterSelect label="Source" value={sourceFilter} onChange={setSourceFilter}>
                        <option value="all">All sources</option>
                        {sourceSummaries.map((source) => (
                          <option key={source.key} value={source.key}>
                            {source.label}
                          </option>
                        ))}
                      </FilterSelect>
                      <FilterSelect
                        label="Type"
                        value={typeFilter}
                        onChange={(value) => setTypeFilter(value as 'all' | PersonaItemType)}
                      >
                        <option value="all">All types</option>
                        {(itemCatalog?.item_types ?? []).map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </FilterSelect>
                      <FilterSelect
                        label="Layer"
                        value={layerFilter}
                        onChange={(value) => setLayerFilter(value as 'all' | PersonaMemoryLayer)}
                      >
                        <option value="all">All layers</option>
                        {(itemCatalog?.memory_layers ?? []).map((layer) => (
                          <option key={layer} value={layer}>
                            {layer}
                          </option>
                        ))}
                      </FilterSelect>
                    </div>

                    <details className="mt-4 rounded-md border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5">
                      <summary className="cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                        Review by source
                      </summary>
                      <SourceIntelligenceMap
                        activeSourceKey={sourceFilter}
                        sources={sourceSummaries}
                        onOpenSource={(source) => {
                          setSourceFilter(source.key);
                          setSelectedSourceId(source.memoryId);
                          setSourceDetailTab('correction');
                          setSelectedSourceDetailKey(source.key);
                          if (sourceRedistillComparison?.sourceKey !== source.key) {
                            setSourceRedistillComparison(null);
                          }
                        }}
                        onShowAll={() => setSourceFilter('all')}
                      />
                    </details>

                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <FilterSelect
                        label="Review"
                        value={needsReviewFilter}
                        onChange={(value) => setNeedsReviewFilter(value as NeedsReviewFilter)}
                      >
                        <option value="all">All review states</option>
                        <option value="needs_review">Needs review</option>
                        <option value="ready">Ready</option>
                      </FilterSelect>
                      <Field
                        label={`Confidence >= ${minConfidence.toFixed(1)}`}
                        htmlFor="confidence-filter"
                      >
                        <input
                          id="confidence-filter"
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={minConfidence}
                          onChange={(event) => setMinConfidence(Number(event.target.value))}
                          className="h-9 w-full"
                        />
                      </Field>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-white/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-white/5 dark:text-slate-400">
                          <tr>
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Layer</th>
                            <th className="px-3 py-2">Confidence</th>
                            <th className="px-3 py-2">Review</th>
                            <th className="px-3 py-2">Source</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-transparent">
                          {runItemsQuery.isFetching ? (
                            <tr>
                              <td
                                className="px-3 py-6 text-center text-xs text-slate-500"
                                colSpan={7}
                              >
                                Loading filtered items...
                              </td>
                            </tr>
                          ) : null}
                          {filteredItems.map((item) => (
                            <tr
                              key={item.id}
                              className={reviewRowClass(
                                item.review_status,
                                selectedItemId === item.id
                              )}
                            >
                              <td className="max-w-90 px-3 py-2">
                                <button
                                  type="button"
                                  className="block text-left"
                                  onClick={() => selectItem(item)}
                                >
                                  <span className="font-medium text-slate-950 dark:text-slate-100">
                                    {displayItemTitle(item)}
                                  </span>
                                  <span className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                                    {item.content}
                                  </span>
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="outline">{itemTypeLabel(item.item_type)}</Badge>
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="secondary">{item.memory_layer}</Badge>
                              </td>
                              <td className="px-3 py-2">{Math.round(item.confidence * 100)}%</td>
                              <td className="px-3 py-2">
                                <Badge
                                  variant={statusBadgeVariant(item.review_status)}
                                  className={statusBadgeClass(item.review_status)}
                                >
                                  {item.review_status}
                                </Badge>
                              </td>
                              <td className="max-w-50 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                <div className="space-y-1">
                                  <p className="truncate font-medium text-slate-700 dark:text-slate-200">
                                    {itemSourceLabel(item)}
                                  </p>
                                  <p className="truncate">
                                    {itemRoutingLabel(item)} · {itemDistillerLabel(item)}
                                  </p>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => approveItemMutation.mutate(item.id)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => rejectItemMutation.mutate(item.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!runItemsQuery.isFetching && !filteredItems.length ? (
                            <tr>
                              <td
                                className="px-3 py-6 text-center text-xs text-slate-500"
                                colSpan={7}
                              >
                                No extracted items match these filters.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        Page {itemPage + 1} · showing{' '}
                        {filteredCount ? itemPage * REVIEW_ITEM_PAGE_SIZE + 1 : 0}-
                        {Math.min((itemPage + 1) * REVIEW_ITEM_PAGE_SIZE, filteredCount)} of{' '}
                        {filteredCount}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canPageBackward || runItemsQuery.isFetching}
                          onClick={() => setItemPage((current) => Math.max(current - 1, 0))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canPageForward || runItemsQuery.isFetching}
                          onClick={() => setItemPage((current) => current + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </section>
                </TabsContent>

                <TabsContent value="package" className="space-y-4">
                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                          Package Preview
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Schema-versioned Persona package JSON.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canUsePackage || savePackageMutation.isPending}
                        onClick={savePackage}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Package
                      </Button>
                    </div>
                    {stats ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        {Object.entries(stats).map(([key, value]) => (
                          <div
                            key={key}
                            className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5"
                          >
                            <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400">
                              {key}
                            </p>
                            <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-100">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {packageError || parsed.error ? (
                      <div className="mt-4">
                        <ErrorAlert
                          title="Invalid package JSON"
                          message={packageError || parsed.error || ''}
                        />
                      </div>
                    ) : null}
                    <Textarea
                      className="mt-4 min-h-130 font-mono text-xs"
                      value={packageText}
                      onChange={(event) => {
                        setPackageText(event.target.value);
                        setPackageError(null);
                      }}
                      placeholder="Generate and synthesize a persona package to preview JSON."
                    />
                  </section>
                </TabsContent>

                <TabsContent value="publish" className="space-y-4">
                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                          Approve and Publish
                        </h2>
                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <StepStat
                            label="package"
                            tone={canUsePackage ? 'primary' : 'warning'}
                            value={canUsePackage ? 1 : 0}
                          />
                          <StepStat
                            label="approved"
                            tone={packageApproved ? 'success' : 'warning'}
                            value={packageApproved ? 1 : 0}
                          />
                          <StepStat
                            label="published"
                            tone={activePersona?.status === 'published' ? 'success' : 'neutral'}
                            value={activePersona?.status === 'published' ? 1 : 0}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                          disabled={
                            !canUsePackage || packageApproved || approveRunMutation.isPending
                          }
                          onClick={() => approveRunMutation.mutate()}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve Package
                        </Button>
                        <Button
                          type="button"
                          className="w-full justify-start"
                          disabled={!activeResult || !packageApproved || publishMutation.isPending}
                          onClick={() => publishMutation.mutate()}
                        >
                          <Rocket className="mr-2 h-4 w-4" />
                          Publish Persona
                        </Button>
                      </div>
                    </div>
                    {publishedResult ? (
                      <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                        <div className="flex items-center gap-2 font-medium">
                          <Bot className="h-4 w-4" />@{publishedResult.persona.slug}
                        </div>
                        <p className="mt-1 text-xs">
                          Version {publishedResult.persona_version.version}
                        </p>
                        <p className="mt-1 text-xs">
                          {publishedResult.memory_ids.length} persona memories published.
                        </p>
                      </div>
                    ) : null}
                  </section>
                </TabsContent>

                <TabsContent value="runtime" className="space-y-4">
                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-primary-700" />
                      <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                        Runtime Test
                      </h2>
                    </div>
                    <div className="mt-4 space-y-3">
                      <Textarea
                        value={runtimePrompt}
                        onChange={(event) => setRuntimePrompt(event.target.value)}
                        rows={4}
                        placeholder="Ask the published persona a question."
                      />
                      <Button
                        type="button"
                        disabled={runtimeMutation.isPending || !activePersona}
                        onClick={() => runtimeMutation.mutate()}
                      >
                        <MessageSquareText className="mr-2 h-4 w-4" />
                        Invoke @{activePersona?.slug ?? 'persona'}
                      </Button>
                      {runtimeResult ? (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                          {runtimeResult}
                        </div>
                      ) : null}
                      <RuntimeGraphContextTrace response={runtimeResponse} />
                    </div>
                  </section>
                </TabsContent>
              </Tabs>
            </section>
          ) : (
            <section className="rounded-lg border border-primary-100 bg-white p-5 shadow-sm shadow-primary/5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
                      {selectedPersona.name}
                    </h2>
                    <Badge
                      variant={statusBadgeVariant(selectedPersona.status)}
                      className={statusBadgeClass(selectedPersona.status)}
                    >
                      {selectedPersona.status}
                    </Badge>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      @{selectedPersona.slug}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {runsQuery.isLoading || loadRunMutation.isPending
                      ? 'Loading the latest distillation run for this persona.'
                      : 'No distillation run is available for this persona yet.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Draft
                  </Button>
                </div>
              </div>
            </section>
          )
        ) : !isDetailPage ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Select a persona to load its latest distillation result, or create a new persona draft.
          </section>
        ) : null}

        <Dialog open={isItemEditorOpen} onOpenChange={setIsItemEditorOpen}>
          <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedItem ? displayItemTitle(selectedItem) : 'Review extracted item'}
              </DialogTitle>
              <DialogDescription>
                This is something the persona may learn. Keep it if it is accurate, edit it if it
                needs cleanup, or reject it if it should not be used.
              </DialogDescription>
            </DialogHeader>

            {!selectedItem ? (
              <EmptyCard
                title="No item selected"
                description="Select an extracted item from the review table."
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
                <section className="rounded-lg border border-primary-100 bg-primary-50/25 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-950">Review item</h2>
                    <Badge variant="outline">{itemTypeLabel(selectedItem.item_type)}</Badge>
                    <Badge
                      variant={statusBadgeVariant(selectedItem.review_status)}
                      className={statusBadgeClass(selectedItem.review_status)}
                    >
                      {selectedItem.review_status}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <Field label="Title" htmlFor="item-title">
                      <Input
                        id="item-title"
                        value={itemDraft.title}
                        onChange={(event) =>
                          setItemDraft((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Confidence" htmlFor="item-confidence">
                      <Input
                        id="item-confidence"
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={itemDraft.confidence}
                        onChange={(event) =>
                          setItemDraft((current) => ({
                            ...current,
                            confidence: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <div className="lg:col-span-2">
                      <Field label="Content" htmlFor="item-content">
                        <Textarea
                          id="item-content"
                          rows={5}
                          value={itemDraft.content}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              content: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <FilterSelect
                      label="Type"
                      value={itemDraft.item_type}
                      onChange={(value) =>
                        setItemDraft((current) => ({
                          ...current,
                          item_type: value as PersonaItemType,
                        }))
                      }
                    >
                      {(itemCatalog?.item_types ?? []).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </FilterSelect>
                    <FilterSelect
                      label="Layer"
                      value={itemDraft.memory_layer}
                      onChange={(value) =>
                        setItemDraft((current) => ({
                          ...current,
                          memory_layer: value as PersonaMemoryLayer,
                        }))
                      }
                    >
                      {(itemCatalog?.memory_layers ?? []).map((layer) => (
                        <option key={layer} value={layer}>
                          {layer}
                        </option>
                      ))}
                    </FilterSelect>
                    <FilterSelect
                      label="Review"
                      value={itemDraft.review_status}
                      onChange={(value) =>
                        setItemDraft((current) => ({
                          ...current,
                          review_status: value as PersonaItemReviewStatus,
                        }))
                      }
                    >
                      {(itemCatalog?.review_statuses ?? []).map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </FilterSelect>
                  </div>
                </section>

                <div className="space-y-4">
                  <DistillationProvenancePanel item={selectedItem} />

                  <ReadOnlyDisclosure
                    description="Reference only. This is the text the system used when it suggested the item."
                    helpLabel="What is original source?"
                    helpText="This section is not something to edit. Open it only if you want to verify that the suggested item matches the original document or memory."
                    icon={<Eye className="h-4 w-4 text-primary-700" />}
                    title="Original source"
                  >
                    <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
                      {selectedSourceMemory ? (
                        <div>
                          <p className="text-sm font-medium text-slate-950">
                            {memoryLabel(selectedSourceMemory)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {memorySourceDetails(selectedSourceMemory)}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                            {selectedSourceMemory.content}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          This item does not have a linked source excerpt.
                        </p>
                      )}
                    </div>
                  </ReadOnlyDisclosure>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsItemEditorOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedItem || rejectItemMutation.isPending}
                onClick={() => {
                  if (selectedItem) {
                    rejectItemMutation.mutate(selectedItem.id);
                  }
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedItem || approveItemMutation.isPending}
                onClick={() => {
                  if (selectedItem) {
                    approveItemMutation.mutate(selectedItem.id);
                  }
                }}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                type="button"
                disabled={!selectedItem || updateItemMutation.isPending}
                onClick={() => updateItemMutation.mutate()}
              >
                <Save className="mr-2 h-4 w-4" />
                Save item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(bulkReviewConfirmAction)}
          onOpenChange={(open) => {
            if (!open) {
              setBulkReviewConfirmAction(null);
              setBulkReviewConfirmFilters(null);
              bulkReviewPreviewMutation.reset();
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {bulkReviewConfirmAction === 'reject'
                  ? 'Reject filtered items?'
                  : 'Approve filtered items?'}
              </DialogTitle>
              <DialogDescription>
                This applies to reviewable items matching the current filters, not just the visible
                page.
              </DialogDescription>
            </DialogHeader>
            {bulkReviewPreviewMutation.data ? (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-4">
                  <StepStat label="matched" value={bulkReviewPreviewMutation.data.matched_count} />
                  <StepStat
                    label="reviewable"
                    value={bulkReviewPreviewMutation.data.reviewable_count}
                  />
                  <StepStat label="will update" value={bulkReviewPreviewMutation.data.count} />
                  <StepStat label="limit" value={bulkReviewPreviewMutation.data.limit} />
                </div>
                {bulkReviewPreviewMutation.data.has_more ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    More matching reviewable items exist than the current bulk limit. Run this
                    action again after the first batch completes.
                  </p>
                ) : null}
                <div className="rounded-md border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase text-slate-500">
                    Preview
                  </div>
                  <div className="max-h-72 divide-y divide-slate-200 overflow-y-auto">
                    {bulkReviewPreviewMutation.data.items.map((item) => (
                      <div key={item.id} className="px-3 py-2 text-sm">
                        <p className="font-medium text-slate-950">{displayItemTitle(item)}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.content}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {itemTypeLabel(item.item_type)} · {item.memory_layer} ·{' '}
                          {item.review_status}
                        </p>
                      </div>
                    ))}
                    {!bulkReviewPreviewMutation.data.items.length ? (
                      <p className="px-3 py-6 text-center text-xs text-slate-500">
                        No reviewable items match these filters.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Loading filtered review preview...</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBulkReviewConfirmAction(null);
                  setBulkReviewConfirmFilters(null);
                  bulkReviewPreviewMutation.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  !bulkReviewConfirmAction ||
                  !bulkReviewPreviewMutation.data?.count ||
                  bulkReviewFilteredMutation.isPending
                }
                onClick={() => {
                  if (bulkReviewConfirmAction) {
                    bulkReviewFilteredMutation.mutate({
                      action: bulkReviewConfirmAction,
                      filters: bulkReviewConfirmFilters,
                    });
                  }
                }}
              >
                {bulkReviewConfirmAction === 'reject' ? 'Reject filtered' : 'Approve filtered'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(selectedSourceDetailKey)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedSourceDetailKey(null);
              setSourceDetailTab('overview');
            }
          }}
        >
          <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Fix or re-check source: {sourceDetailQuery.data?.source.label ?? 'Source'}
              </DialogTitle>
              <DialogDescription>
                The extracted items are already in the review table. Use this only when the system
                misunderstood the source type, or after you re-check a source and want to compare
                the result.
              </DialogDescription>
            </DialogHeader>
            {sourceDetailQuery.isLoading ? (
              <LoadingCard title="Loading source" description="Loading source detail..." />
            ) : null}
            {sourceDetailQuery.data ? (
              <div className="space-y-4">
                <section className="grid gap-3 md:grid-cols-4">
                  <StepStat label="items" value={sourceDetailQuery.data.source.item_count} />
                  <StepStat
                    label="review"
                    value={sourceDetailQuery.data.source.needs_review_count}
                  />
                  <StepStat label="approved" value={sourceDetailQuery.data.source.approved_count} />
                  <StepStat label="rejected" value={sourceDetailQuery.data.source.rejected_count} />
                </section>
                <Tabs
                  value={sourceDetailTab}
                  onValueChange={(value) => setSourceDetailTab(value as typeof sourceDetailTab)}
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Summary</TabsTrigger>
                    <TabsTrigger value="correction">Fix source type</TabsTrigger>
                    <TabsTrigger value="comparison">Re-check result</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="mt-4 space-y-4">
                    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="rounded-md border border-slate-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-slate-950">
                          How this source was read
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          This is how the system treated the original document when it created the
                          suggested persona items.
                        </p>
                        <dl className="mt-3 space-y-2 text-xs text-slate-600">
                          <DetailRow
                            label="Source type"
                            value={sourceDetailQuery.data.source.classification}
                          />
                          <DetailRow
                            label="Document kind"
                            value={sourceDetailQuery.data.source.document_kind}
                          />
                          <DetailRow
                            label="Upload mode"
                            value={sourceDetailQuery.data.source.upload_mode ?? '-'}
                          />
                        </dl>
                        <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-medium text-slate-700">
                            Show technical details
                          </summary>
                          <dl className="mt-3 space-y-2 text-xs text-slate-600">
                            <DetailRow
                              label="Source id"
                              value={sourceDetailQuery.data.source.key}
                            />
                            <DetailRow
                              label="Content hash"
                              value={sourceDetailQuery.data.source.content_sha256 ?? '-'}
                            />
                          </dl>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {sourceDetailQuery.data.source.distillers.map((distiller) => (
                              <Badge key={distiller} variant="outline">
                                {distiller}
                              </Badge>
                            ))}
                          </div>
                        </details>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-semibold text-slate-950">What you can do</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          The normal review happens in the item table below this section. These
                          actions apply to every item from this source.
                        </p>
                        <div className="mt-3 space-y-2">
                          <Button
                            type="button"
                            className="w-full justify-start"
                            variant="outline"
                            onClick={() =>
                              bulkReviewPreviewMutation.mutate({
                                action: 'approve',
                                filters: { source_key: sourceDetailQuery.data?.source.key },
                              })
                            }
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve all from this source
                          </Button>
                          <Button
                            type="button"
                            className="w-full justify-start"
                            variant="outline"
                            onClick={() =>
                              bulkReviewPreviewMutation.mutate({
                                action: 'reject',
                                filters: { source_key: sourceDetailQuery.data?.source.key },
                              })
                            }
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject all from this source
                          </Button>
                        </div>
                      </div>
                    </section>
                    <SourceCorrectionImpact detail={sourceDetailQuery.data} />
                  </TabsContent>
                  <TabsContent value="comparison" className="mt-4">
                    {sourceRedistillComparison?.sourceKey === sourceDetailQuery.data.source.key ? (
                      <SourceRedistillComparisonPanel
                        comparison={sourceRedistillComparison}
                        onSelectItem={(item) => {
                          selectItem(item);
                          setSourceFilter(sourceDetailQuery.data?.source.key ?? 'all');
                          setSelectedSourceDetailKey(null);
                        }}
                      />
                    ) : (
                      <EmptyCard
                        title="No re-distill comparison yet"
                        description="Save a correction and re-distill this source to compare superseded and newly extracted items."
                      />
                    )}
                  </TabsContent>
                  <TabsContent value="correction" className="mt-4">
                    <section className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-950">Fix source type</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Use this only if the system misunderstood what kind of document this is.
                            After saving, re-check the source to regenerate affected draft items.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={redistillSourceMutation.isPending}
                          onClick={() => redistillSourceMutation.mutate()}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Re-distill source
                        </Button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <Field label="Source type" htmlFor="source-classification">
                          <select
                            id="source-classification"
                            value={sourceClassificationDraft.classification}
                            onChange={(event) =>
                              setSourceClassificationDraft((current) => ({
                                ...current,
                                classification: event.target.value,
                              }))
                            }
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-primary-400 focus:outline-none"
                          >
                            <option value="">Select classification</option>
                            {(itemTypesQuery.data?.source_classifications ?? []).map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Document kind" htmlFor="source-document-kind">
                          <select
                            id="source-document-kind"
                            value={sourceClassificationDraft.documentKind}
                            onChange={(event) =>
                              setSourceClassificationDraft((current) => ({
                                ...current,
                                documentKind: event.target.value,
                              }))
                            }
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-primary-400 focus:outline-none"
                          >
                            <option value="">Select kind</option>
                            {(itemTypesQuery.data?.document_kinds ?? []).map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="What the source contains" htmlFor="source-content-roles">
                          <Input
                            id="source-content-roles"
                            value={sourceClassificationDraft.contentRoles}
                            onChange={(event) =>
                              setSourceClassificationDraft((current) => ({
                                ...current,
                                contentRoles: event.target.value,
                              }))
                            }
                            placeholder="workflow, domain_knowledge"
                          />
                        </Field>
                        <Field label="Items to extract" htmlFor="source-extraction-targets">
                          <Input
                            id="source-extraction-targets"
                            value={sourceClassificationDraft.extractionTargets}
                            onChange={(event) =>
                              setSourceClassificationDraft((current) => ({
                                ...current,
                                extractionTargets: event.target.value,
                              }))
                            }
                            placeholder="workflow, decision_pattern"
                          />
                        </Field>
                        <Field label="Memory categories" htmlFor="source-memory-layers">
                          <Input
                            id="source-memory-layers"
                            value={sourceClassificationDraft.memoryLayers}
                            onChange={(event) =>
                              setSourceClassificationDraft((current) => ({
                                ...current,
                                memoryLayers: event.target.value,
                              }))
                            }
                            placeholder="procedural, semantic"
                          />
                        </Field>
                        <Field label="Search tags" htmlFor="source-vector-tags">
                          <Input
                            id="source-vector-tags"
                            value={sourceClassificationDraft.vectorTags}
                            onChange={(event) =>
                              setSourceClassificationDraft((current) => ({
                                ...current,
                                vectorTags: event.target.value,
                              }))
                            }
                            placeholder="release, approval"
                          />
                        </Field>
                        <Field label="Confidence" htmlFor="source-confidence">
                          <Input
                            id="source-confidence"
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={sourceClassificationDraft.confidence}
                            onChange={(event) =>
                              setSourceClassificationDraft((current) => ({
                                ...current,
                                confidence: event.target.value,
                              }))
                            }
                            placeholder="optional"
                          />
                        </Field>
                        <Field label="Rationale" htmlFor="source-rationale">
                          <Input
                            id="source-rationale"
                            value={sourceClassificationDraft.rationale}
                            onChange={(event) =>
                              setSourceClassificationDraft((current) => ({
                                ...current,
                                rationale: event.target.value,
                              }))
                            }
                            placeholder="optional reviewer note"
                          />
                        </Field>
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setSourceClassificationDraft({
                              classification: sourceDetailQuery.data?.source.classification ?? '',
                              documentKind: sourceDetailQuery.data?.source.document_kind ?? '',
                              contentRoles: csv(sourceDetailQuery.data?.source.content_roles),
                              extractionTargets: csv(
                                sourceDetailQuery.data?.source.extraction_targets
                              ),
                              memoryLayers: csv(sourceDetailQuery.data?.source.memory_layers),
                              vectorTags: csv(sourceDetailQuery.data?.source.vector_tags),
                              confidence: '',
                              rationale: '',
                            })
                          }
                        >
                          Reset
                        </Button>
                        <Button
                          type="button"
                          disabled={updateSourceClassificationMutation.isPending}
                          onClick={() =>
                            updateSourceClassificationMutation.mutate(sourceClassificationPayload())
                          }
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save classification
                        </Button>
                      </div>
                    </section>
                  </TabsContent>
                </Tabs>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,16,30,0.98),rgba(8,18,31,0.98))] dark:text-slate-100">
            <DialogHeader>
              <DialogTitle className="dark:text-slate-100">Create persona</DialogTitle>
              <DialogDescription className="dark:text-slate-400">
                Complete the required identity, distillation, and source steps. Optional settings
                can be left on defaults.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/76">
                <div className="space-y-3">
                  <WorkflowStep
                    index={1}
                    label="Name"
                    required
                    done={personaName.trim().length > 0}
                  />
                  <WorkflowStep index={2} label="Distillation" done={Boolean(distillationMode)} />
                  <WorkflowStep
                    index={3}
                    label="Sources"
                    required
                    done={selectedMemoryIds.length > 0}
                  />
                  <WorkflowStep
                    index={4}
                    label="Governance"
                    done={Object.keys(governanceDefaults).length > 0}
                  />
                  <WorkflowStep index={5} label="Generate draft" done={Boolean(activeResult)} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-center">
                  <StepStat label="selected" value={selectedMemoryIds.length} />
                  <StepStat label="ready" value={canDistill ? 1 : 0} />
                </div>
              </div>

              <div className="space-y-4">
                <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/78">
                  <div className="flex items-center gap-2">
                    <UserRoundCog className="h-4 w-4 text-primary-700" />
                    <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                      1. Identity
                    </h2>
                    <Badge variant="secondary">Required</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <Field label="Name" htmlFor="persona-name">
                      <Input
                        id="persona-name"
                        value={personaName}
                        onChange={(event) => setPersonaName(event.target.value)}
                        placeholder="Audit Manager Persona"
                      />
                    </Field>
                    <div className="lg:col-span-2">
                      <Field label="Description (optional)" htmlFor="persona-description">
                        <Textarea
                          id="persona-description"
                          value={personaDescription}
                          onChange={(event) => setPersonaDescription(event.target.value)}
                          rows={3}
                          placeholder="Reviews evidence and drafts observations."
                        />
                      </Field>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/78">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-primary-700" />
                    <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                      2. Distillation
                    </h2>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <Field label="Distillation mode" htmlFor="persona-distillation-mode">
                      <select
                        id="persona-distillation-mode"
                        value={distillationMode}
                        onChange={(event) =>
                          setDistillationMode(event.target.value as PersonaDistillationMode)
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-400 focus:outline-none dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-100"
                      >
                        {distillationModes.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode === 'llm'
                              ? 'LLM'
                              : mode === 'hybrid'
                                ? 'Hybrid'
                                : 'Deterministic'}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="LLM source" htmlFor="persona-llm-model-source">
                      <select
                        id="persona-llm-model-source"
                        value={llmModelSource}
                        onChange={(event) =>
                          setLlmModelSource(event.target.value as PersonaLLMModelSource)
                        }
                        disabled={!llmBackedMode}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-100"
                      >
                        {llmModelSources.map((source) => (
                          <option key={source} value={source}>
                            {source === 'main_agent' ? 'Main-agent default' : 'Model profile'}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={
                        llmBackedMode && llmModelSource === 'model_profile'
                          ? 'Model profile'
                          : 'Model profile (optional)'
                      }
                      htmlFor="persona-model-profile"
                    >
                      <select
                        id="persona-model-profile"
                        value={modelProfileId}
                        onChange={(event) => setModelProfileId(event.target.value)}
                        disabled={
                          profilesQuery.isLoading ||
                          (llmBackedMode && llmModelSource === 'main_agent')
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-100"
                      >
                        <option value="">
                          {profilesQuery.isLoading
                            ? 'Loading model profiles...'
                            : llmBackedMode && llmModelSource === 'model_profile'
                              ? 'Select model profile'
                              : 'Default model profile'}
                        </option>
                        {modelProfiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name} · {profile.provider}/{profile.model}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </section>

                <DocumentIngestionControl
                  frame="inline"
                  defaultTags={['persona-source', 'document']}
                  purpose="persona_factory"
                  title="Upload source material"
                  description="New uploads are saved for retrieval and selected for this persona automatically."
                  onSuggestedGovernanceLabels={(labels) => {
                    setGovernance((current) => ({ ...current, ...labels }));
                  }}
                  onIngested={async (result) => {
                    await queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() });
                    setSelectedMemoryIds((current) =>
                      Array.from(new Set([...current, ...result.memory_ids]))
                    );
                  }}
                />

                <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/78">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-primary-700" />
                      <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                        3. Select sources
                      </h2>
                      <Badge variant="secondary">Required</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{selectedMemoryIds.length} selected</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void memoriesQuery.refetch()}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Choose the memory records that should teach this persona what to know, how to
                    decide, and how to communicate.
                  </p>
                  <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1 lg:grid-cols-2">
                    {memoriesQuery.isLoading ? (
                      <LoadingCard title="Loading" description="Loading source memory..." />
                    ) : null}
                    {memoriesQuery.isError ? (
                      <ErrorAlert title="Memory unavailable" message="Failed to load memory." />
                    ) : null}
                    {(memoriesQuery.data?.items ?? []).map((memory) => (
                      <label
                        key={memory.id}
                        className="flex min-h-24 cursor-pointer gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 hover:border-primary-200 hover:bg-white dark:border-white/10 dark:bg-white/4 dark:hover:border-sky-300/20 dark:hover:bg-white/6"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={selectedMemoryIds.includes(memory.id)}
                          onChange={() => toggleMemory(memory.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                            <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                              {memoryLabel(memory)}
                            </span>
                            {memory.memory_type ? (
                              <Badge variant="secondary">{memory.memory_type}</Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                            {summarizeMemory(memory)}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                            {memorySourceDetails(memory)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/78">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                        Selected source summary
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        These records will be distilled into persona memory items.
                      </p>
                    </div>
                    <Badge variant="secondary">{selectedMemories.length} selected</Badge>
                  </div>
                  {selectedMemories.length > 0 ? (
                    <div className="mt-4 grid gap-2 lg:grid-cols-2">
                      {selectedMemories.map((memory) => (
                        <div
                          key={memory.id}
                          className="flex min-w-0 items-start justify-between gap-3 rounded-md border border-primary-100 bg-primary-50/40 px-3 py-2 dark:border-primary-300/14 dark:bg-primary-500/10"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-950 dark:text-slate-100">
                              {memoryLabel(memory)}
                            </p>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                              {memorySourceDetails(memory)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Remove ${memoryLabel(memory)} from selected sources`}
                            onClick={() => removeSelectedMemory(memory.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/4 dark:text-slate-400">
                      Select existing memory records above or upload source files. Uploaded files
                      become selectable source memory after ingestion completes.
                    </p>
                  )}
                </section>

                <UploadedDocumentsList
                  scope="user"
                  tagFilter="persona-source"
                  title="Uploaded source files"
                  description="Source files tagged for Persona Factory. Remove files here when they should no longer contribute source memory."
                  emptyMessage="No Persona Factory source files uploaded yet."
                />

                <details className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/78">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-950 dark:text-slate-100">
                    4. Optional governance labels
                  </summary>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {GOVERNANCE_KEYS.map((key) => (
                      <FilterSelect
                        key={key}
                        label={key.replaceAll('_', ' ')}
                        value={governance[key] ?? governanceDefaults[key] ?? ''}
                        onChange={(value) =>
                          setGovernance((current) => ({ ...current, [key]: value }))
                        }
                      >
                        {governanceOptions(governanceQuery.data, key).map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </FilterSelect>
                    ))}
                  </div>
                </details>
              </div>
            </div>

            <DialogFooter className="items-center gap-2 sm:justify-between sm:space-x-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {canDistill
                  ? `${selectedMemories.length} source memories ready.`
                  : 'Name and at least one source are required.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!canDistill || distillMutation.isPending}
                  onClick={() => distillMutation.mutate()}
                >
                  <WandSparkles className="mr-2 h-4 w-4" />
                  {distillMutation.isPending ? 'Generating...' : 'Generate draft'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function StepStat({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'destructive';
  value: number;
}) {
  const toneClass = {
    neutral:
      'border-slate-200 bg-slate-50 text-slate-950 dark:border-white/10 dark:bg-slate-950/82 dark:text-slate-100',
    primary:
      'border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-400/20 dark:bg-primary-500/10 dark:text-primary-100',
    success:
      'border-success-200 bg-success-50 text-success-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100',
    warning:
      'border-warning-200 bg-warning-50 text-warning-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100',
    destructive:
      'border-destructive-200 bg-destructive-50 text-destructive-900 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100',
  }[tone];

  return (
    <div className={cn('rounded-md border px-3 py-2', toneClass)}>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] uppercase opacity-75">{label}</p>
    </div>
  );
}

function FactoryStepCard({
  description,
  index,
  title,
}: {
  description: string;
  index: number;
  title: string;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-secondary-100 bg-white px-3 py-2 shadow-sm shadow-secondary/5 dark:border-white/10 dark:bg-slate-950/78 dark:shadow-none">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-xs font-semibold text-secondary-800 dark:bg-secondary-500/14 dark:text-secondary-100">
        {index}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-950 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium uppercase text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-all text-slate-700">{value || '-'}</dd>
    </div>
  );
}

function LifecycleStep({
  actionLabel,
  disabled = false,
  index,
  onAction,
  status,
  title,
}: {
  actionLabel: string;
  disabled?: boolean;
  index: number;
  onAction: () => void;
  status: 'active' | 'done' | 'locked';
  title: string;
}) {
  const isDone = status === 'done';
  const isActive = status === 'active';
  return (
    <div
      aria-current={isActive ? 'step' : undefined}
      className={cn(
        'rounded-md border px-3 py-3 transition',
        status === 'locked' && 'border-slate-200 bg-slate-50 text-slate-500',
        isActive && 'border-primary-300 bg-primary-50 text-primary-950 shadow-sm shadow-primary/10',
        isDone && 'border-success-200 bg-success-50 text-success-950'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
            isDone && 'bg-success-600 text-white',
            isActive && 'bg-primary-600 text-white',
            status === 'locked' && 'bg-slate-200 text-slate-700'
          )}
        >
          {isDone ? <Check className="h-4 w-4" /> : index}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <Button
        type="button"
        variant={status === 'active' ? 'default' : 'outline'}
        size="sm"
        className="mt-3 w-full justify-center"
        disabled={disabled || status === 'locked'}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

function WorkflowStep({
  done,
  index,
  label,
  required = false,
}: {
  done: boolean;
  index: number;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/80">
      <span
        className={
          done
            ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white'
            : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200'
        }
      >
        {done ? <Check className="h-4 w-4" /> : index}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-950 dark:text-slate-100">
          {label}
        </span>
        <span className="block text-[11px] uppercase text-slate-500 dark:text-slate-400">
          {required ? 'Required' : 'Optional'}
        </span>
      </span>
    </div>
  );
}

function PersonaGraphContextPanel({
  graphContext,
  isError,
  isLoading,
  onRefresh,
  preset,
  query,
  setPreset,
  setQuery,
}: {
  graphContext?: PersonaGraphContextResult;
  isError: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  preset: PersonaGraphContextPreset;
  query: string;
  setPreset: (value: PersonaGraphContextPreset) => void;
  setQuery: (value: string) => void;
}) {
  const nodes = graphContext?.graph.nodes ?? [];
  const edges = graphContext?.graph.edges ?? [];
  const policy = graphPolicy(graphContext);
  const sourcePriority = graphPolicySourcePriority(graphContext);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Connected knowledge</h3>
          <p className="mt-1 text-xs text-slate-500">
            Related sources, workflows, memories, and tools that may help this persona answer.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
        <select
          aria-label="Connected knowledge view"
          value={preset}
          onChange={(event) => setPreset(event.target.value as PersonaGraphContextPreset)}
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-primary-400 focus:outline-none"
        >
          {GRAPH_CONTEXT_PRESETS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search connected knowledge"
        />
        <div className="grid grid-cols-2 gap-2 text-center">
          <StepStat label="items" value={nodes.length} />
          <StepStat label="links" value={edges.length} />
        </div>
      </div>
      {isLoading ? (
        <p className="mt-3 text-xs text-slate-500">Loading connected knowledge...</p>
      ) : null}
      {isError ? (
        <p className="mt-3 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-900">
          Connected knowledge is unavailable. You can still edit and publish this persona.
        </p>
      ) : null}
      {graphContext ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <h4 className="text-xs font-semibold uppercase text-slate-500">Related items</h4>
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {nodes.slice(0, 8).map((node) => (
                <div key={node.id} className="rounded-md border border-slate-200 bg-white p-2">
                  <p className="truncate text-xs font-medium text-slate-950">
                    {graphPropertyLabel(node.properties) ?? node.id}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {node.type ?? 'Node'} · {(node.labels ?? []).slice(0, 3).join(', ')}
                  </p>
                </div>
              ))}
              {!nodes.length ? (
                <p className="text-xs text-slate-500">No related items returned.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <h4 className="text-xs font-semibold uppercase text-slate-500">Context preview</h4>
            {Object.keys(policy).length ? (
              <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
                <p>
                  Policy: {textValue(policy.preset) ?? preset} · fallback{' '}
                  {textValue(policy.fallback) ?? 'skip'}
                </p>
                {sourcePriority.length ? (
                  <p className="mt-1">Source priority: {sourcePriority.join(' -> ')}</p>
                ) : null}
              </div>
            ) : null}
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">
              {graphContext.prompt || 'No connected knowledge preview was generated.'}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RuntimeGraphContextTrace({
  response,
}: {
  response: ConversationPostMessageResponse | null;
}) {
  const graphContext = runtimePersonaGraphContext(response);
  if (!Object.keys(graphContext).length) {
    return null;
  }
  const policy = graphPolicy(graphContext);
  const sourcePriority = graphPolicySourcePriority(graphContext);
  const status = textValue(graphContext.status) ?? 'unknown';
  const nodeCount = numberValue(graphContext.node_count) ?? 0;
  const edgeCount = numberValue(graphContext.edge_count) ?? 0;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
      <h3 className="font-semibold uppercase text-slate-500">Connected knowledge used</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950">
          <p className="text-lg font-semibold">{status}</p>
          <p className="text-[11px] uppercase opacity-75">status</p>
        </div>
        <StepStat label="items" value={nodeCount} />
        <StepStat label="links" value={edgeCount} />
      </div>
      {Object.keys(policy).length ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p>
            View: {textValue(policy.preset) ?? 'sources and history'} · fallback{' '}
            {textValue(policy.fallback) ?? 'skip'}
          </p>
          {sourcePriority.length ? (
            <p className="mt-1">Source priority: {sourcePriority.join(' -> ')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SourceCorrectionImpact({ detail }: { detail: PersonaRunSourceDetail }) {
  const firstItem = detail.items[0] ?? null;
  const classification = itemSourceClassification(firstItem);
  const sourceRef = metadataObject(detail.source.source_ref);
  const confidence = numberValue(classification.confidence) ?? numberValue(sourceRef.confidence);
  const rationale = textValue(classification.rationale);
  const signals = stringList(classification.signals);
  const reviewStatuses = detail.source.review_statuses ?? {};
  const supersededByRedistill = (reviewStatuses.draft ?? 0) + (reviewStatuses.needs_review ?? 0);
  const preservedByRedistill = (reviewStatuses.approved ?? 0) + (reviewStatuses.rejected ?? 0);

  return (
    <section className="rounded-md border border-primary-100 bg-primary-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">System guess</h3>
          <p className="mt-1 text-xs text-slate-500">
            The system read this as {detail.source.classification}
            {detail.source.document_kind ? ` · ${detail.source.document_kind}` : ''}. Change it only
            if that looks wrong.
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            detail.source.source_intelligence_review_status === 'approved'
              ? 'border-success-200 bg-success-50 text-success-800'
              : 'border-warning-200 bg-warning-50 text-warning-900'
          }
        >
          {detail.source.source_intelligence_review_status ?? 'unreviewed'}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <StepStat
          label="confidence"
          tone={confidence && confidence >= 0.8 ? 'success' : 'warning'}
          value={confidence ? Math.round(confidence * 100) : 0}
        />
        <StepStat label="draft items affected" tone="warning" value={supersededByRedistill} />
        <StepStat label="reviewed items kept" tone="success" value={preservedByRedistill} />
        <StepStat label="sample items" value={detail.items.length} />
      </div>
      {signals.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {signals.slice(0, 6).map((signal) => (
            <Badge key={signal} variant="outline">
              {signal}
            </Badge>
          ))}
        </div>
      ) : null}
      {rationale ? <p className="mt-3 text-xs leading-5 text-slate-600">{rationale}</p> : null}
    </section>
  );
}

function SourceRedistillComparisonPanel({
  comparison,
  onSelectItem,
}: {
  comparison: SourceRedistillComparison;
  onSelectItem: (item: PersonaDistillationItem) => void;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Re-distill Before / After</h3>
          <p className="mt-1 text-xs text-slate-500">
            Superseded source items remain traceable while new items become the active review
            candidates.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <StepStat label="old" tone="warning" value={comparison.supersededItems.length} />
          <StepStat label="new" tone="primary" value={comparison.createdItems.length} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <RedistillItemColumn
          emptyText="No draft or needs-review items were superseded."
          items={comparison.supersededItems}
          title="Before"
          tone="warning"
        />
        <RedistillItemColumn
          emptyText="No new items were created."
          items={comparison.createdItems}
          onSelectItem={onSelectItem}
          title="After"
          tone="primary"
        />
      </div>
    </section>
  );
}

function RedistillItemColumn({
  emptyText,
  items,
  onSelectItem,
  title,
  tone,
}: {
  emptyText: string;
  items: PersonaDistillationItem[];
  onSelectItem?: (item: PersonaDistillationItem) => void;
  title: string;
  tone: 'primary' | 'warning';
}) {
  return (
    <div
      className={cn(
        'rounded-md border p-3',
        tone === 'primary'
          ? 'border-primary-100 bg-primary-50/40'
          : 'border-warning-100 bg-warning-50/40'
      )}
    >
      <h4 className="text-xs font-semibold uppercase text-slate-500">{title}</h4>
      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const content = (
            <>
              <p className="text-sm font-medium text-slate-950">{displayItemTitle(item)}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.content}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {itemTypeLabel(item.item_type)} · {item.memory_layer} · {item.review_status}
              </p>
            </>
          );
          return onSelectItem ? (
            <button
              key={item.id}
              type="button"
              className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:border-primary-200"
              onClick={() => onSelectItem(item)}
            >
              {content}
            </button>
          ) : (
            <div key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
              {content}
            </div>
          );
        })}
        {!items.length ? <p className="text-xs text-slate-500">{emptyText}</p> : null}
      </div>
    </div>
  );
}

function SourceIntelligenceMap({
  activeSourceKey,
  onOpenSource,
  onShowAll,
  sources,
}: {
  activeSourceKey: string;
  onOpenSource: (source: DistillationSourceSummary) => void;
  onShowAll: () => void;
  sources: DistillationSourceSummary[];
}) {
  if (!sources.length) {
    return null;
  }
  const totalItems = sources.reduce((total, source) => total + source.itemCount, 0);
  const totalNeedsReview = sources.reduce((total, source) => total + source.needsReviewCount, 0);
  return (
    <section className="mt-4 rounded-md border border-primary-100 bg-primary-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Review items by source</h3>
          <p className="mt-1 text-xs text-slate-500">
            This only groups the review table by original document. Use the source action when the
            system read a document as the wrong type or you need to re-check it.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {sources.length} sources produced {totalItems} items · {totalNeedsReview} need review
          </p>
        </div>
        <Button
          type="button"
          variant={activeSourceKey === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={onShowAll}
        >
          All sources
        </Button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => (
          <div
            key={source.key}
            className={cn(
              'min-h-32 rounded-md border bg-white px-3 py-3 text-left transition',
              activeSourceKey === source.key
                ? 'border-primary-300 shadow-sm ring-2 ring-primary-100'
                : 'border-slate-200 hover:border-primary-200'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-950">{source.label}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Source type: {source.classification}
                  {source.documentKind ? ` · ${source.documentKind}` : ''}
                </p>
              </div>
              <Badge
                variant={source.needsReviewCount ? 'secondary' : 'outline'}
                className={
                  source.needsReviewCount
                    ? 'border-warning-200 bg-warning-50 text-warning-900'
                    : 'border-success-200 bg-success-50 text-success-800'
                }
              >
                {source.itemCount} items
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {source.distillers.slice(0, 3).map((distiller) => (
                <Badge key={distiller} variant="outline">
                  {distiller}
                </Badge>
              ))}
              {source.distillers.length > 3 ? (
                <Badge variant="outline">+{source.distillers.length - 3}</Badge>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <span className="rounded-md bg-warning-50 px-2 py-1 text-warning-900">
                {source.needsReviewCount} review
              </span>
              <span className="rounded-md bg-success-50 px-2 py-1 text-success-900">
                {source.approvedCount} approved
              </span>
            </div>
            {source.vectorTags.length ? (
              <p className="mt-2 truncate text-[11px] text-slate-500">
                Tags: {source.vectorTags.slice(0, 4).join(', ')}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Fix or re-check source ${source.label}`}
                onClick={() => onOpenSource(source)}
              >
                Fix / re-check
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DistillationProvenancePanel({ item }: { item: PersonaDistillationItem | null }) {
  const payload = itemPayload(item);
  const sourceRef = itemSourceRef(item);
  const classification = itemSourceClassification(item);
  const routing = itemRouting(item);
  const vectorTags = itemVectorTags(item);
  const reviewFlags = itemReviewFlags(item);
  const extractionTargets = stringList(routing.extraction_targets);
  const memoryLayers = stringList(routing.memory_layers);
  const confidence = numberValue(classification.confidence);
  const sourceFilename = textValue(sourceRef.filename);
  const sourceDocumentId = textValue(sourceRef.document_id);
  const sourceHash = textValue(sourceRef.content_sha256);
  const storageUri = textValue(sourceRef.storage_uri);
  const uploadMode = textValue(sourceRef.upload_mode);
  const uploadSource = textValue(sourceRef.upload_intelligence_source);
  const sourceReview = textValue(sourceRef.source_intelligence_review_status);
  const chunkIndex = numberValue(sourceRef.chunk_index);
  const chunkCount = numberValue(sourceRef.chunk_count);

  return (
    <ReadOnlyDisclosure
      description="Reference only. These details explain how the system created this suggestion."
      helpLabel="What does this section mean?"
      helpText="You do not need to edit this. Open it only when you want to understand why this item appeared, which source it came from, and how confident the system was."
      icon={<Layers3 className="h-4 w-4 text-primary-700" />}
      title="Why this was suggested"
    >
      {!item ? (
        <p className="text-xs text-slate-500">
          Select an extracted item to see why it was suggested.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{itemDistillerLabel(item)}</Badge>
            <Badge variant="secondary">{itemRoutingLabel(item)}</Badge>
            {itemDocumentKind(item) ? (
              <Badge variant="secondary">{itemDocumentKind(item)}</Badge>
            ) : null}
            {textValue(payload.distiller_version) ? (
              <Badge variant="outline">{textValue(payload.distiller_version)}</Badge>
            ) : null}
          </div>

          <dl className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <DetailRow label="Extractor" value={textValue(payload.extractor) ?? '-'} />
            <DetailRow
              label="Classification"
              value={textValue(classification.label) ?? textValue(routing.label) ?? '-'}
            />
            <DetailRow
              label="Class confidence"
              value={confidence === null ? '-' : `${Math.round(confidence * 100)}%`}
            />
            <DetailRow label="Document" value={sourceFilename ?? sourceDocumentId ?? '-'} />
            <DetailRow
              label="Chunk"
              value={
                chunkIndex === null
                  ? '-'
                  : chunkCount === null
                    ? String(chunkIndex)
                    : `${chunkIndex + 1}/${chunkCount}`
              }
            />
            <DetailRow label="Upload mode" value={uploadMode ?? '-'} />
            <DetailRow label="Upload intelligence" value={uploadSource ?? '-'} />
            <DetailRow label="Source review" value={sourceReview ?? '-'} />
            <DetailRow label="Content hash" value={sourceHash ?? '-'} />
            <DetailRow label="Storage" value={storageUri ?? '-'} />
          </dl>

          {extractionTargets.length || memoryLayers.length || vectorTags.length ? (
            <div className="space-y-3">
              <TagList label="Extraction targets" values={extractionTargets} />
              <TagList label="Memory layers" values={memoryLayers} />
              <TagList label="Vector tags" values={vectorTags} />
            </div>
          ) : null}

          {reviewFlags.length ? (
            <div>
              <p className="text-xs font-medium text-slate-700">Review flags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {reviewFlags.map((flag) => (
                  <Badge key={flag} variant="secondary">
                    {flag}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </ReadOnlyDisclosure>
  );
}

function TagList({ label, values }: { label: string; values: string[] }) {
  if (!values.length) {
    return null;
  }
  return (
    <div>
      <p className="text-xs font-medium text-slate-700">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={value} variant="secondary">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function Field({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="capitalize">
        {label}
      </Label>
      {children}
    </div>
  );
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs font-medium capitalize text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-primary-400 focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}
