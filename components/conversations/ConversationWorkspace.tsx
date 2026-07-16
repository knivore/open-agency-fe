'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  AlertTriangle,
  Bot,
  Braces,
  Cable,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clipboard,
  Copy,
  FileOutput,
  FileText,
  Gauge,
  Globe2,
  Hash,
  LoaderCircle,
  MessageSquareText,
  Mic,
  Paperclip,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  Smartphone,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  AssistantMarkdown,
  formatAssistantMarkdownText,
} from '@/components/conversations/AssistantMarkdown';
import AssistantContextMenu from '@/components/conversations/AssistantContextMenu';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import { DialogClose } from '@/components/library/shadcn/dialog';
import { AppDialog } from '@/components/app-shell/AppOverlay';
import { FormField, FormFieldGroup, FormSection } from '@/components/app-shell/FormSection';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/library/shadcn/tooltip';
import UploadedDocumentsList from '@/components/memory-app/UploadedDocumentsList';
import { goalMentionHandle } from '@/components/goals/GoalSelector';
import { conversationsApi } from '@/lib/api/backend/conversations';
import { documentsApi } from '@/lib/api/backend/documents';
import { logsApi } from '@/lib/api/backend/logs';
import { personasApi } from '@/lib/api/backend/personas';
import { runsApi } from '@/lib/api/backend/runs';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type {
  ApprovalRequest,
  Conversation,
  ConversationActivityEvent,
  ConversationActivityStatus,
  ConversationCompactMode,
  ConversationCompactResponse,
  ConversationCompactSourceRange,
  ConversationContextUsage,
  ConversationEventApproval,
  ConversationMessage,
  ConversationStreamEvent,
} from '@/types/conversations';
import type { ExecutionEventRecord } from '@/types/runtime';
import type { WorkflowDefinition } from '@/types/workflows';
import type { AuthUser } from '@/types/auth';
import type { JsonObject } from '@/types/api';
import type { DocumentIngestionResult, DocumentUploadMode } from '@/types/documents';
import type { MemoryRecord } from '@/types/memory';
import type { PersonaDefinition } from '@/types/personas';
import type { GoalOperatorSummary } from '@/types/goals';
import WorkflowRunActionButton from '@/components/workflow/WorkflowRunActionButton';
import { useRegisterAssistantPageContext } from '@/components/assistant/AssistantPageContext';
import { toast } from 'sonner';

const ACTIVE_CONVERSATION_STORAGE_KEY = 'agency.active_conversation_id';
const DRAFT_INPUT_STORAGE_KEY = 'agency.conversation_draft_input';
const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const DOCUMENT_UPLOAD_ACCEPT = '.txt,.md,.markdown,.csv,.json,.log,.html,.htm,.pdf,.docx';
const conversationUploadModes: Array<{ value: DocumentUploadMode; label: string }> = [
  { value: 'context', label: 'Use in this chat' },
  { value: 'vector', label: 'Save for retrieval' },
  { value: 'both', label: 'Use now and save' },
];
const ASYNC_TURN_SLOW_MS = 30_000;
const ASYNC_TURN_STALE_MS = 120_000;
const ASYNC_TURN_TICK_MS = 5_000;
const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_FRAGMENTS = [
  'authorization',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'clientsecret',
  'secret',
  'password',
  'passwd',
  'privatekey',
  'credential',
  'webhooksecret',
  'sessioncookie',
  'setcookie',
];
const SENSITIVE_TOKEN_PATTERN =
  /\b(Bearer\s+)[A-Za-z0-9._~+/=-]+|\b(sk-[A-Za-z0-9_-]{8,})\b|\b(xox[a-z]-[A-Za-z0-9-]{8,})\b|\b(gh[pousr]_[A-Za-z0-9_]{8,})\b|\b(glpat-[A-Za-z0-9_-]{8,})\b/g;

type PendingAsyncTurn = {
  conversationId: string;
  originMessageId: string;
  startedAt: number;
  providerLabel?: string;
};

type ConversationTurnActivity = {
  turnId: string;
  conversationId: string;
  status: ConversationActivityStatus;
  events: ConversationActivityEvent[];
  draftText: string;
  finalMessageId?: string;
  startedAt?: string;
  completedAt?: string;
};

type CompactTokenBudgetPreset = 'small' | 'medium' | 'large' | 'custom';

type CompactFormState = {
  mode: ConversationCompactMode;
  tokenBudgetPreset: CompactTokenBudgetPreset;
  customTokenBudget: string;
  sourceRange: ConversationCompactSourceRange;
  sourceMessageStartId: string;
  sourceMessageEndId: string;
  recentMessageLimit: string;
  persist: boolean;
  confirmed: boolean;
  strategy: 'deterministic' | 'llm' | 'auto';
  customKeep: string;
  customDrop: string;
};

type GeneratedConversationFile = {
  id: string;
  title: string;
  type: string;
  detail?: string;
  createdAt: string;
};

const compactModeOptions: Array<{ value: ConversationCompactMode; label: string }> = [
  { value: 'brief', label: 'Brief' },
  { value: 'handoff', label: 'Handoff' },
  { value: 'memory', label: 'Memory' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'technical', label: 'Technical' },
  { value: 'archive', label: 'Archive' },
  { value: 'custom', label: 'Custom' },
];

const compactTokenBudgetOptions: Array<{
  value: CompactTokenBudgetPreset;
  label: string;
  tokens: number;
}> = [
  { value: 'small', label: 'Small', tokens: 600 },
  { value: 'medium', label: 'Medium', tokens: 1200 },
  { value: 'large', label: 'Large', tokens: 2400 },
  { value: 'custom', label: 'Custom', tokens: 1200 },
];

const compactSourceRangeOptions: Array<{ value: ConversationCompactSourceRange; label: string }> = [
  { value: 'full', label: 'Full conversation' },
  { value: 'since_last_compact', label: 'Since last compact' },
  { value: 'selected', label: 'Selected range' },
  { value: 'older_than_recent', label: 'Older than recent' },
];

const defaultAssistantPromptSuggestions: AssistantPromptSuggestion[] = [
  {
    id: 'create-workflow',
    label: 'Create a workflow',
    prompt: 'Create a workflow for a new client onboarding process.',
  },
  {
    id: 'review-runs',
    label: 'Review recent runs',
    prompt: 'Review recent runs and summarize what needs attention.',
  },
  {
    id: 'compact-handoff',
    label: 'Draft a handoff',
    prompt: 'Draft a compact handoff for this conversation.',
  },
];

const defaultCompactForm: CompactFormState = {
  mode: 'handoff',
  tokenBudgetPreset: 'medium',
  customTokenBudget: '1200',
  sourceRange: 'full',
  sourceMessageStartId: '',
  sourceMessageEndId: '',
  recentMessageLimit: '8',
  persist: false,
  confirmed: false,
  strategy: 'deterministic',
  customKeep: '',
  customDrop: '',
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<{
    0?: {
      transcript?: string;
    };
  }>;
}

function speechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function conversationDisplayTitle(conversation: Conversation) {
  const trimmed = conversation.title?.trim();
  if (trimmed) {
    return trimmed;
  }
  return `Conversation ${conversation.id.slice(0, 8)}`;
}

function formatConversationTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

function formatTokenCount(tokens: number | null | undefined) {
  if (tokens == null || !Number.isFinite(tokens)) {
    return 'Unknown';
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(tokens >= 10_000 ? 0 : 1)}k`;
  }
  return String(tokens);
}

function conversationDocumentNote(
  ingestion: DocumentIngestionResult,
  requestedMode: DocumentUploadMode
) {
  const mode = ingestion.upload_mode ?? requestedMode;
  if (mode === 'context') {
    return `Attached document "${ingestion.filename}" to this message (${ingestion.document_id}).`;
  }
  if (mode === 'both') {
    return (
      `Attached document "${ingestion.filename}" to this message and saved it for retrieval as ` +
      `${ingestion.chunks_created} chunk${ingestion.chunks_created === 1 ? '' : 's'} (${ingestion.document_id}).`
    );
  }
  return (
    `Uploaded document "${ingestion.filename}" into memory as ${ingestion.chunks_created} chunk` +
    `${ingestion.chunks_created === 1 ? '' : 's'} (${ingestion.document_id}).`
  );
}

function contextUsageTone(usage: ConversationContextUsage | null | undefined) {
  switch (usage?.status) {
    case 'overflow':
    case 'critical':
      return {
        border: 'border-red-200',
        background: 'bg-red-50',
        text: 'text-red-800',
        bar: 'bg-red-500',
        label: 'Compact now',
      };
    case 'warning':
      return {
        border: 'border-amber-200',
        background: 'bg-amber-50',
        text: 'text-amber-800',
        bar: 'bg-amber-500',
        label: 'Compact soon',
      };
    default:
      return {
        border: 'border-slate-200',
        background: 'bg-slate-50',
        text: 'text-slate-600',
        bar: 'bg-primary-500',
        label: 'Context',
      };
  }
}

function sortMessages(messages: ConversationMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.id.localeCompare(right.id);
  });
}

function mergeMessage(current: ConversationMessage[], next: ConversationMessage) {
  const existing = current.find((item) => item.id === next.id);
  if (existing) {
    return current.map((item) => (item.id === next.id ? next : item));
  }
  return sortMessages([...current, next]);
}

function isTerminalAssistantTurnMessage(message: ConversationMessage) {
  return (
    message.role === 'assistant' ||
    message.message_type === 'approval_request' ||
    message.message_type === 'approval_result' ||
    message.message_type === 'execution_completed'
  );
}

function hasTerminalAssistantTurnMessageAfterCursor(
  messages: ConversationMessage[],
  cursorMessageId: string
) {
  let seenCursor = false;
  for (const message of sortMessages(messages)) {
    if (seenCursor && isTerminalAssistantTurnMessage(message)) {
      return true;
    }
    if (message.id === cursorMessageId) {
      seenCursor = true;
    }
  }
  return false;
}

function hasApprovalAfterCursor(
  messages: ConversationMessage[],
  approvals: ApprovalRequest[],
  cursorMessageId: string
) {
  const sortedMessages = sortMessages(messages);
  const cursor = sortedMessages.find((message) => message.id === cursorMessageId);
  if (!cursor) {
    return false;
  }

  let seenCursor = false;
  const messageIdsAfterCursor = new Set<string>();
  for (const message of sortedMessages) {
    if (seenCursor) {
      messageIdsAfterCursor.add(message.id);
    }
    if (message.id === cursorMessageId) {
      seenCursor = true;
    }
  }

  const cursorTime = new Date(cursor.created_at).getTime();
  return approvals.some((approval) => {
    if (approval.conversation_id !== cursor.conversation_id) {
      return false;
    }
    if (approval.origin_message_id && messageIdsAfterCursor.has(approval.origin_message_id)) {
      return true;
    }
    const approvalTime = new Date(approval.created_at).getTime();
    return (
      Number.isFinite(cursorTime) && Number.isFinite(approvalTime) && approvalTime > cursorTime
    );
  });
}

function hasAssistantTurnCompletionAfterCursor(
  messages: ConversationMessage[],
  approvals: ApprovalRequest[],
  cursorMessageId: string
) {
  return (
    hasTerminalAssistantTurnMessageAfterCursor(messages, cursorMessageId) ||
    hasApprovalAfterCursor(messages, approvals, cursorMessageId)
  );
}

function approvalsById(approvalItems: ApprovalRequest[]) {
  return approvalItems.reduce<Record<string, ApprovalRequest>>((accumulator, approval) => {
    accumulator[approval.id] = approval;
    return accumulator;
  }, {});
}

function pendingAsyncTurnFromMessages(
  messages: ConversationMessage[],
  approvals: ApprovalRequest[] = []
): PendingAsyncTurn | null {
  const sortedMessages = sortMessages(messages);
  const latestUserMessage = [...sortedMessages]
    .reverse()
    .find((message) => message.role === 'user');
  if (!latestUserMessage) {
    return null;
  }

  if (hasAssistantTurnCompletionAfterCursor(sortedMessages, approvals, latestUserMessage.id)) {
    return null;
  }

  const startedAt = new Date(latestUserMessage.created_at).getTime();
  return {
    conversationId: latestUserMessage.conversation_id,
    originMessageId: latestUserMessage.id,
    startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
    providerLabel: assistantProviderLabel(
      isRecord(latestUserMessage.metadata) ? latestUserMessage.metadata : {}
    ),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatElapsedDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

type AssistantPageTarget = {
  label: string;
  detail?: string;
  providers: string[];
};

type AssistantPromptSuggestion = {
  id: string;
  label: string;
  prompt: string;
  intent?: string;
};

function cleanLabel(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readableKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._/-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function entityLabel(entity: JsonObject) {
  return cleanLabel(entity.label) ?? cleanLabel(entity.name) ?? cleanLabel(entity.id);
}

function selectedEntityFromPageContext(pageContext: JsonObject) {
  const selection = isRecord(pageContext.selection) ? pageContext.selection : null;
  const entities = Array.isArray(pageContext.entities)
    ? pageContext.entities.filter((item): item is JsonObject => isRecord(item))
    : [];
  if (!selection) {
    return entities.length === 1 ? entities[0] : null;
  }

  const selectedPairs = Object.entries(selection)
    .filter(([key, value]) => key.toLowerCase().endsWith('id') && typeof value === 'string')
    .map(([key, value]) => ({ key, value: String(value) }));
  const selectedIds = selectedPairs.map((item) => item.value);
  if (selectedIds.length === 0) {
    return entities.length === 1 ? entities[0] : null;
  }

  return (
    entities.find((entity) => {
      const id = cleanLabel(entity.id);
      return id ? selectedIds.includes(id) : false;
    }) ??
    ({
      type: selectedPairs[0].key.replace(/Id$/, ''),
      id: selectedIds[0],
      label: selectedIds[0],
    } as JsonObject)
  );
}

function pageTargetFromContext(pageContext: JsonObject | undefined, providers: string[] = []) {
  if (!pageContext) {
    return null;
  }
  const selectedEntity = selectedEntityFromPageContext(pageContext);
  const title = cleanLabel(pageContext.title);
  const route = cleanLabel(pageContext.route);
  const surface = cleanLabel(pageContext.surface);
  if (selectedEntity) {
    const kind = cleanLabel(selectedEntity.type);
    const label = entityLabel(selectedEntity);
    if (label) {
      return {
        label: kind ? `${readableKey(kind)}: ${label}` : label,
        detail: title ?? route ?? surface,
        providers,
      };
    }
  }
  if (title) {
    return { label: title, detail: route ?? surface, providers };
  }
  if (surface) {
    return { label: readableKey(surface), detail: route, providers };
  }
  if (route) {
    return { label: route, providers };
  }
  return null;
}

function assistantProviderLabels(metadata: JsonObject): string[] {
  const assistantProviders = metadata.assistant_providers;
  if (!isRecord(assistantProviders)) {
    return [];
  }
  const providers = assistantProviders.providers;
  if (!Array.isArray(providers)) {
    return [];
  }
  return providers
    .filter((item): item is JsonObject => isRecord(item))
    .map((provider) => cleanLabel(provider.label) ?? cleanLabel(provider.id))
    .filter((label): label is string => Boolean(label));
}

function assistantProviderLabel(metadata: JsonObject): string | undefined {
  const labels = assistantProviderLabels(metadata);
  return labels.length > 0 ? labels.join(', ') : undefined;
}

function assistantPageTarget(metadata: JsonObject): AssistantPageTarget | null {
  const pageContext = isRecord(metadata.page_context) ? metadata.page_context : undefined;
  return pageTargetFromContext(pageContext, assistantProviderLabels(metadata));
}

function assistantContextPromptSuggestions(metadata: JsonObject): AssistantPromptSuggestion[] {
  const pageContext = isRecord(metadata.page_context) ? metadata.page_context : undefined;
  const suggestions = Array.isArray(pageContext?.suggestedPrompts)
    ? pageContext.suggestedPrompts
    : [];

  return suggestions
    .filter((suggestion): suggestion is JsonObject => isRecord(suggestion))
    .flatMap((suggestion) => {
      const prompt = cleanLabel(suggestion.prompt);
      if (!prompt) {
        return [];
      }
      return [
        {
          id: cleanLabel(suggestion.id) ?? prompt,
          label: cleanLabel(suggestion.label) ?? prompt,
          prompt,
          intent: cleanLabel(suggestion.intent),
        },
      ];
    })
    .slice(0, 3);
}

function addWorkflowId(ids: Set<string>, value: unknown) {
  const workflowId = cleanLabel(value);
  if (workflowId) {
    ids.add(workflowId);
  }
}

function workflowIdsFromPageContext(pageContext: JsonObject | undefined) {
  const workflowIds = new Set<string>();
  if (!pageContext) {
    return workflowIds;
  }

  const selection = isRecord(pageContext.selection) ? pageContext.selection : undefined;
  addWorkflowId(workflowIds, selection?.workflowId);

  const summary = isRecord(pageContext.summary) ? pageContext.summary : undefined;
  addWorkflowId(workflowIds, summary?.workflowId);

  const entities = Array.isArray(pageContext.entities)
    ? pageContext.entities.filter((item): item is JsonObject => isRecord(item))
    : [];
  entities.forEach((entity) => {
    if (entity.type === 'workflow') {
      addWorkflowId(workflowIds, entity.id);
    }
  });

  return workflowIds;
}

function workflowIdsFromAssistantMetadata(metadata: JsonObject) {
  const workflowIds = new Set<string>();
  addWorkflowId(workflowIds, metadata.workflow_id);
  addWorkflowId(workflowIds, metadata.workflowId);

  const pageContext = isRecord(metadata.page_context) ? metadata.page_context : undefined;
  workflowIdsFromPageContext(pageContext).forEach((workflowId) => workflowIds.add(workflowId));

  return workflowIds;
}

function workflowIdFromAssistantMetadata(metadata: JsonObject) {
  return Array.from(workflowIdsFromAssistantMetadata(metadata))[0] ?? null;
}

function workflowIdsFromConversation(conversation: Conversation | null | undefined) {
  return conversation?.metadata
    ? workflowIdsFromAssistantMetadata(conversation.metadata)
    : new Set<string>();
}

function isInvokablePersona(persona: PersonaDefinition) {
  return Boolean(persona.slug && (persona.status === 'published' || persona.published_agent_id));
}

function personaMentionsFromText(text: string, personas: PersonaDefinition[]) {
  const personaBySlug = new Map(personas.map((persona) => [persona.slug.toLowerCase(), persona]));
  const mentions = new Map<string, JsonObject>();

  for (const match of text.matchAll(/(^|\s)@([a-z0-9][a-z0-9_-]*)/gi)) {
    const persona = personaBySlug.get(match[2].toLowerCase());
    if (!persona || mentions.has(persona.slug)) {
      continue;
    }
    mentions.set(persona.slug, {
      persona_id: persona.id,
      persona_slug: persona.slug,
      persona_name: persona.name,
      current_version_id: persona.current_version_id ?? null,
      published_agent_id: persona.published_agent_id ?? null,
    });
  }

  return Array.from(mentions.values());
}

function trailingPersonaMentionQuery(text: string) {
  const match = text.match(/(?:^|\s)@([a-z0-9_-]*)$/i);
  return match ? match[1].toLowerCase() : null;
}

function replaceTrailingPersonaMention(text: string, slug: string) {
  const mention = `@${slug}`;
  if (/(?:^|\s)@[a-z0-9_-]*$/i.test(text)) {
    return text.replace(/(^|\s)@[a-z0-9_-]*$/i, (_match, prefix: string) => `${prefix}${mention} `);
  }
  const trimmed = text.trim();
  return trimmed ? `${mention} ${trimmed}` : `${mention} `;
}

function goalMentionsFromText(text: string, selectedGoal: GoalOperatorSummary | null) {
  const mentions: JsonObject[] = [];
  const hasGenericGoalMention = /(^|\s)@goal(\s|$|:)/i.test(text);
  if (selectedGoal && hasGenericGoalMention) {
    mentions.push({
      goal_id: selectedGoal.goal.id,
      objective: selectedGoal.goal.objective,
      status: selectedGoal.goal.status,
      mention: `@goal:${goalMentionHandle(selectedGoal)}`,
    });
  }
  return mentions;
}

function replaceTrailingGoalMention(text: string, goal: GoalOperatorSummary) {
  const mention = `@goal:${goalMentionHandle(goal)}`;
  if (/(?:^|\s)@goal(?::[a-z0-9_-]*)?$/i.test(text)) {
    return text.replace(
      /(^|\s)@goal(?::[a-z0-9_-]*)?$/i,
      (_match, prefix: string) => `${prefix}${mention} `
    );
  }
  const trimmed = text.trim();
  return trimmed ? `${mention} ${trimmed}` : `${mention} `;
}

function renderMentionHighlights(
  text: string,
  personas: PersonaDefinition[],
  selectedGoal: GoalOperatorSummary | null
) {
  if (!text) {
    return null;
  }
  const personaSlugs = new Set(personas.map((persona) => persona.slug.toLowerCase()));
  const goalHandle = selectedGoal ? goalMentionHandle(selectedGoal).toLowerCase() : null;
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(/@goal(?::[a-z0-9_-]+)?|@[a-z0-9][a-z0-9_-]*/gi)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }
    const lower = value.toLowerCase();
    const isGoalMention =
      lower === '@goal' || (goalHandle !== null && lower === `@goal:${goalHandle}`);
    const isPersonaMention = !isGoalMention && personaSlugs.has(lower.slice(1));
    parts.push(
      <span
        key={`${index}-${value}`}
        className={
          isGoalMention || isPersonaMention
            ? 'rounded-md bg-primary-50 px-1 font-semibold text-primary-800 ring-1 ring-primary-100'
            : 'text-slate-900 dark:text-slate-100'
        }
      >
        {value}
      </span>
    );
    cursor = index + value.length;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts;
}

function personaAttributionLabel(message: ConversationMessage) {
  if (message.role !== 'assistant' || !isRecord(message.metadata)) {
    return null;
  }
  const delivery = cleanLabel(message.metadata.delivery);
  const slug = cleanLabel(message.metadata.persona_slug);
  return delivery === 'persona' && slug ? `Answered as @${slug}` : null;
}

type ChannelTargetPrompt = {
  key: string;
  reason: string;
  provider?: Conversation['channel_type'];
};

const channelTargetPromptMetadataKeys = [
  'channel_target_prompt',
  'requires_channel_target',
  'delivery_target_required',
  'integration_target_required',
  'needs_delivery_target',
];

const channelTargetPromptPattern =
  /\b(channel target|delivery target|delivery destination|discord channel|discord destination|telegram chat|whatsapp recipient)\b/i;

function channelProviderFromValue(value: unknown): Conversation['channel_type'] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('discord')) {
    return 'discord';
  }
  if (normalized.includes('telegram')) {
    return 'telegram';
  }
  if (normalized.includes('whatsapp') || normalized.includes('wa_id')) {
    return 'whatsapp';
  }
  if (normalized === 'web' || normalized === 'api' || normalized === 'other') {
    return normalized;
  }
  return undefined;
}

function channelProviderFromMetadata(metadata: JsonObject | null | undefined) {
  if (!metadata) {
    return undefined;
  }
  const channelTarget = isRecord(metadata.channel_target) ? metadata.channel_target : null;
  return (
    channelProviderFromValue(channelTarget?.provider) ??
    channelProviderFromValue(channelTarget?.channel_type) ??
    channelProviderFromValue(metadata.provider) ??
    channelProviderFromValue(metadata.channel_type) ??
    channelProviderFromValue(metadata.delivery_provider)
  );
}

function channelProviderFromText(text: string) {
  return channelProviderFromValue(text);
}

function activityPromptText(event: ConversationActivityEvent) {
  return [event.title, event.detail, event.text_delta].filter(Boolean).join(' ');
}

function metadataRequestsChannelTarget(metadata: JsonObject | null | undefined) {
  if (!metadata) {
    return false;
  }
  if (
    channelTargetPromptMetadataKeys.some((key) => {
      const value = metadata[key];
      return (
        value === true || (typeof value === 'string' && value.trim().toLowerCase() !== 'false')
      );
    })
  ) {
    return true;
  }
  const channelTarget = isRecord(metadata.channel_target) ? metadata.channel_target : null;
  return channelTarget?.prompt === true || channelTarget?.required === true;
}

function messagePlainText(message: ConversationMessage) {
  if (message.plain_text) {
    return message.plain_text;
  }
  return isRecord(message.content) && typeof message.content.text === 'string'
    ? message.content.text
    : '';
}

function channelTargetPromptFromMessage(message: ConversationMessage): ChannelTargetPrompt | null {
  if (message.role === 'user') {
    return null;
  }
  const metadata = isRecord(message.metadata) ? message.metadata : null;
  if (
    metadataRequestsChannelTarget(metadata) ||
    channelTargetPromptPattern.test(messagePlainText(message))
  ) {
    return {
      key: `message:${message.id}`,
      reason: 'Requested by the agent for integration delivery.',
      provider:
        channelProviderFromMetadata(metadata) ?? channelProviderFromText(messagePlainText(message)),
    };
  }
  return null;
}

function channelTargetPromptForConversation(
  conversationId: string | null | undefined,
  messages: ConversationMessage[],
  activities: Record<string, ConversationTurnActivity>
): ChannelTargetPrompt | null {
  if (!conversationId) {
    return null;
  }

  const activityPrompt = Object.values(activities)
    .filter((activity) => activity.conversationId === conversationId)
    .flatMap((activity) => activity.events)
    .reverse()
    .find((event) => {
      const metadata = isRecord(event.metadata) ? event.metadata : null;
      return (
        metadataRequestsChannelTarget(metadata) ||
        channelTargetPromptPattern.test(activityPromptText(event))
      );
    });

  if (activityPrompt) {
    const metadata = isRecord(activityPrompt.metadata) ? activityPrompt.metadata : null;
    const eventText = activityPromptText(activityPrompt);
    return {
      key: `activity:${activityPrompt.id}`,
      reason: 'Requested by the agent while updating an integration.',
      provider: channelProviderFromMetadata(metadata) ?? channelProviderFromText(eventText),
    };
  }

  // Channel-target requests can be persisted as tool/system messages before a final assistant reply.
  const latestPromptMessage = [...messages].reverse().find((message) => {
    if (message.conversation_id !== conversationId) {
      return false;
    }
    return Boolean(channelTargetPromptFromMessage(message));
  });
  if (!latestPromptMessage) {
    return null;
  }

  const prompt = channelTargetPromptFromMessage(latestPromptMessage);
  if (!prompt?.provider) {
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.conversation_id === conversationId && message.role === 'user');
    const provider = latestUserMessage
      ? channelProviderFromText(messagePlainText(latestUserMessage))
      : undefined;
    return prompt && provider ? { ...prompt, provider } : prompt;
  }

  return prompt;
}

function approvalSourceContext(approval: ApprovalRequest): AssistantPageTarget | null {
  const metadata = isRecord(approval.metadata) ? approval.metadata : null;
  if (!metadata) {
    return null;
  }
  const providerIds = Array.isArray(metadata.source_provider_ids)
    ? metadata.source_provider_ids.filter(
        (item): item is string => typeof item === 'string' && Boolean(item)
      )
    : [];
  const pageContext = isRecord(metadata.source_page_context)
    ? metadata.source_page_context
    : undefined;
  return pageTargetFromContext(pageContext, providerIds);
}

function approvalSourceLabel(approval: ApprovalRequest) {
  const source = approvalSourceContext(approval);
  if (!source) {
    return undefined;
  }
  return source.detail ? `${source.label} (${source.detail})` : source.label;
}

function ApprovalSourceBadge({ approval }: { approval: ApprovalRequest }) {
  const source = approvalSourceContext(approval);
  if (!source) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
        Source: {source.label}
      </Badge>
      {source.providers.map((provider) => (
        <Badge
          key={provider}
          variant="outline"
          className="border-slate-200 bg-white text-slate-600"
        >
          {provider}
        </Badge>
      ))}
      {source.detail ? <span className="truncate">{source.detail}</span> : null}
    </div>
  );
}

function mergeApproval(current: Record<string, ApprovalRequest>, next: ApprovalRequest) {
  return { ...current, [next.id]: next };
}

const activityEventTypes = new Set<string>([
  'turn.started',
  'turn.completed',
  'turn.failed',
  'turn.cancelled',
  'context.loading',
  'context.loaded',
  'context.compacting',
  'context.compacted',
  'memory.searching',
  'memory.found',
  'memory.writing',
  'planner.started',
  'planner.step',
  'planner.completed',
  'tool_call.started',
  'tool_call.progress',
  'tool_call.completed',
  'tool_call.failed',
  'workflow.proposed',
  'workflow.running',
  'workflow.completed',
  'approval.requested',
  'approval.resolved',
  'assistant.draft_delta',
  'assistant.summary',
  'assistant.finalizing',
  'artifact.created',
  'file.generated',
  'handoff.started',
  'handoff.completed',
]);

function isActivityEvent(payload: ConversationStreamEvent): payload is ConversationActivityEvent {
  return activityEventTypes.has(payload.event_type);
}

function isApprovalStreamEvent(
  payload: ConversationStreamEvent
): payload is ConversationEventApproval {
  return (
    (payload.event_type === 'approval.requested' || payload.event_type === 'approval.resolved') &&
    isRecord(payload.approval)
  );
}

function isTerminalActivityEvent(event: ConversationActivityEvent) {
  return (
    event.event_type === 'turn.completed' ||
    event.event_type === 'turn.failed' ||
    event.event_type === 'turn.cancelled'
  );
}

function activityEventStatus(event: ConversationActivityEvent): ConversationActivityStatus {
  if (event.status) {
    return event.status;
  }
  if (
    event.event_type.endsWith('.completed') ||
    event.event_type.endsWith('.loaded') ||
    event.event_type.endsWith('.found') ||
    event.event_type === 'approval.resolved' ||
    event.event_type === 'file.generated' ||
    event.event_type === 'artifact.created'
  ) {
    return 'completed';
  }
  if (event.event_type.endsWith('.failed') || event.event_type === 'turn.failed') {
    return 'failed';
  }
  if (event.event_type === 'turn.cancelled') {
    return 'cancelled';
  }
  return 'running';
}

function activityTitle(event: ConversationActivityEvent) {
  if (event.title?.trim()) {
    return event.title.trim();
  }
  if (event.event_type.startsWith('tool_call.')) {
    const metadata = isRecord(event.metadata) ? event.metadata : null;
    const toolName = cleanLabel(metadata?.tool_name) ?? cleanLabel(metadata?.tool_id);
    if (toolName) {
      if (toolName.includes('workflow.propose')) {
        return 'Preparing workflow proposal';
      }
      if (toolName.includes('agent.propose')) {
        return 'Preparing agent proposal';
      }
      if (toolName.includes('tool.propose')) {
        return 'Preparing tool proposal';
      }
      if (
        toolName.includes('execution.pause') ||
        toolName.includes('execution.resume') ||
        toolName.includes('execution.cancel') ||
        toolName.includes('execution.approve') ||
        toolName.includes('execution.reject')
      ) {
        return 'Controlling run';
      }
      if (
        toolName.includes('execution.get') ||
        toolName.includes('execution.events') ||
        toolName.includes('execution.artifacts') ||
        toolName.includes('execution.approvals')
      ) {
        return 'Reading run state';
      }
      if (toolName.includes('connector.credentials')) {
        return 'Reading connector credentials';
      }
      if (toolName.includes('connector.history')) {
        return 'Reading connector history';
      }
      if (toolName.includes('connector.test')) {
        return 'Testing connector';
      }
      if (toolName.includes('connector.capabilities')) {
        return 'Reading connector capabilities';
      }
    }
  }
  return event.event_type.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function visibleActivityEvents(events: ConversationActivityEvent[]) {
  return events.filter((event) => {
    if (event.visibility === 'internal') {
      return false;
    }
    return event.event_type !== 'assistant.draft_delta' || Boolean(event.title || event.detail);
  });
}

function mergeActivityEvent(
  current: Record<string, ConversationTurnActivity>,
  event: ConversationActivityEvent
) {
  if (event.visibility === 'internal') {
    return current;
  }

  const existing = current[event.turn_id];
  const existingEvents = existing?.events ?? [];
  const mergedEvents = existingEvents.some((item) => item.id === event.id)
    ? existingEvents.map((item) => (item.id === event.id ? event : item))
    : [...existingEvents, event];
  const sortedEvents = mergedEvents.sort((left, right) => {
    const leftTime = new Date(left.occurred_at).getTime();
    const rightTime = new Date(right.occurred_at).getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.id.localeCompare(right.id);
  });
  const terminalStatus = isTerminalActivityEvent(event) ? activityEventStatus(event) : null;
  const draftDelta =
    event.event_type === 'assistant.draft_delta' && typeof event.text_delta === 'string'
      ? event.text_delta
      : '';

  return {
    ...current,
    [event.turn_id]: {
      turnId: event.turn_id,
      conversationId: event.conversation_id,
      status: terminalStatus ?? existing?.status ?? 'running',
      events: sortedEvents,
      draftText: `${existing?.draftText ?? ''}${draftDelta}`,
      finalMessageId: event.message_id ?? existing?.finalMessageId,
      startedAt:
        existing?.startedAt ??
        (event.event_type === 'turn.started' ? event.occurred_at : undefined),
      completedAt: isTerminalActivityEvent(event) ? event.occurred_at : existing?.completedAt,
    },
  };
}

function attachFinalMessageToLatestTurn(
  current: Record<string, ConversationTurnActivity>,
  message: ConversationMessage
) {
  if (message.role !== 'assistant') {
    return current;
  }

  const metadataTurnId =
    message.metadata && typeof message.metadata.turn_id === 'string'
      ? message.metadata.turn_id
      : null;
  const candidates = Object.values(current)
    .filter((turn) => turn.conversationId === message.conversation_id)
    .filter((turn) => !turn.finalMessageId || turn.finalMessageId === message.id)
    .filter((turn) => (metadataTurnId ? turn.turnId === metadataTurnId : true))
    .sort((left, right) => {
      const leftTime = new Date(left.completedAt ?? left.startedAt ?? '1970-01-01').getTime();
      const rightTime = new Date(right.completedAt ?? right.startedAt ?? '1970-01-01').getTime();
      return rightTime - leftTime;
    });
  const turn = candidates[0];
  if (!turn) {
    return current;
  }

  return {
    ...current,
    [turn.turnId]: {
      ...turn,
      status: turn.status === 'running' ? 'completed' : turn.status,
      finalMessageId: message.id,
      completedAt: turn.completedAt ?? message.created_at,
    },
  };
}

function activityForMessage(
  message: ConversationMessage,
  activities: Record<string, ConversationTurnActivity>
) {
  return Object.values(activities).find((turn) => turn.finalMessageId === message.id) ?? null;
}

function latestRunningActivity(
  conversationId: string,
  activities: Record<string, ConversationTurnActivity>
) {
  return (
    Object.values(activities)
      .filter((turn) => turn.conversationId === conversationId)
      .filter((turn) => turn.status === 'running' || !turn.finalMessageId)
      .sort((left, right) => {
        const leftTime = new Date(
          left.startedAt ?? left.events[0]?.occurred_at ?? '1970-01-01'
        ).getTime();
        const rightTime = new Date(
          right.startedAt ?? right.events[0]?.occurred_at ?? '1970-01-01'
        ).getTime();
        return rightTime - leftTime;
      })[0] ?? null
  );
}

function approvalLabel(approval: ApprovalRequest | undefined) {
  if (!approval) {
    return null;
  }
  if (approval.status === 'approved') {
    return 'Approved';
  }
  if (approval.status === 'rejected') {
    return 'Rejected';
  }
  if (approval.status === 'cancelled') {
    return 'Cancelled';
  }
  return 'Pending approval';
}

function messageText(message: ConversationMessage) {
  if (typeof message.plain_text === 'string' && message.plain_text.trim()) {
    return formatAssistantMarkdownText(message.plain_text);
  }
  if (message.content && typeof message.content.text === 'string') {
    return formatAssistantMarkdownText(message.content.text);
  }
  return message.message_type;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function compactTokenBudget(form: CompactFormState) {
  if (form.tokenBudgetPreset === 'custom') {
    const parsed = Number.parseInt(form.customTokenBudget, 10);
    return Number.isFinite(parsed) ? parsed : 1200;
  }
  return (
    compactTokenBudgetOptions.find((option) => option.value === form.tokenBudgetPreset)?.tokens ??
    1200
  );
}

function compactPackMode(memory: MemoryRecord) {
  const metadataMode = memory.metadata?.mode;
  if (typeof metadataMode === 'string' && metadataMode.trim()) {
    return metadataMode.replace(/_/g, ' ');
  }
  const tagMode = memory.tags.find((tag) =>
    compactModeOptions.some((option) => option.value === tag)
  );
  return tagMode ? tagMode.replace(/_/g, ' ') : 'context pack';
}

function compactPackTitle(memory: MemoryRecord) {
  return memory.summary?.trim() || `${compactPackMode(memory)} context pack`;
}

function splitCompactList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactWorkflowName(pack: MemoryRecord) {
  const base = compactPackTitle(pack)
    .replace(/^saved\s+/i, '')
    .trim();
  const name = base ? `Workflow from ${base}` : 'Workflow from compact pack';
  return name.length > 90 ? `${name.slice(0, 87)}...` : name;
}

function workflowFromCompactPack(pack: MemoryRecord): WorkflowDefinition {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const workflowId = `workflow-context-pack-${suffix}`;
  const agentId = `agent-context-pack-${suffix}`;
  const taskId = `task-context-pack-${suffix}`;
  const nodeId = `node-${taskId}`;
  const mode = compactPackMode(pack);
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
          generated_by: 'conversation-compact-ui',
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

function messageTypeLabel(message: ConversationMessage, assistantLabel: string) {
  switch (message.message_type) {
    case 'approval_request':
      return 'Approval request';
    case 'approval_result':
      return 'Approval result';
    case 'execution_started':
      return 'Execution started';
    case 'execution_completed':
      return 'Execution completed';
    case 'workflow_proposal':
      return 'Workflow proposal';
    case 'workflow_update_proposal':
      return 'Workflow update';
    default:
      return message.role === 'user'
        ? 'You'
        : message.role === 'assistant'
          ? assistantLabel
          : 'System';
  }
}

function messageShellClasses(message: ConversationMessage) {
  if (message.role === 'user') {
    return 'agency-gradient ml-auto border border-primary-500 text-white shadow-sm shadow-primary/20';
  }
  if (message.role === 'assistant') {
    if (message.message_type === 'approval_request') {
      return 'border border-amber-200 bg-amber-50 text-amber-950 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 dark:shadow-none';
    }
    if (message.message_type === 'approval_result') {
      return 'border border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100 dark:shadow-none';
    }
    return 'border border-slate-200 bg-linear-to-br from-white via-white to-sky-50/70 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92)_0%,rgba(10,18,32,0.96)_100%)] dark:text-slate-100 dark:shadow-none';
  }
  if (message.message_type === 'execution_completed') {
    return 'mx-auto border border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100';
  }
  if (message.message_type === 'execution_started') {
    return 'mx-auto border border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100';
  }
  if (message.role === 'system') {
    return 'mx-auto border border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(28,37,55,0.96)_0%,rgba(20,28,44,0.98)_100%)] dark:text-slate-100';
  }
  return 'mx-auto border border-slate-200 bg-slate-100 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200';
}

function metadataToneClasses(message: ConversationMessage) {
  if (message.role === 'user') {
    return 'text-primary-50';
  }
  if (message.message_type === 'approval_request') {
    return 'text-amber-700 dark:text-amber-200';
  }
  if (message.message_type === 'approval_result') {
    return 'text-emerald-700 dark:text-emerald-200';
  }
  if (message.message_type === 'execution_started') {
    return 'text-sky-700 dark:text-sky-200';
  }
  if (message.message_type === 'execution_completed') {
    return 'text-emerald-700 dark:text-emerald-200';
  }
  return 'text-slate-500 dark:text-slate-300';
}

function transcriptWidthClasses(message: ConversationMessage) {
  return message.role === 'system' ? 'max-w-xl' : 'max-w-3xl';
}

function messageBodyScrollClasses(message: ConversationMessage) {
  // Long assistant/user replies should stay readable inside the transcript instead of stretching
  // the entire chat window. The cap keeps the bubble size predictable while preserving content.
  return message.role === 'system'
    ? 'max-h-48 overflow-y-auto overscroll-contain pr-1'
    : 'max-h-80 overflow-y-auto overscroll-contain pr-1';
}

function messageBodyToneClasses(message: ConversationMessage) {
  if (message.message_type === 'approval_result') {
    return 'text-slate-900 dark:text-emerald-50';
  }
  if (message.role === 'system') {
    return 'text-slate-800 dark:text-slate-50';
  }
  if (message.message_type === 'approval_request') {
    return 'text-slate-900 dark:text-amber-50';
  }
  if (message.message_type === 'execution_started') {
    return 'text-slate-900 dark:text-cyan-50';
  }
  if (message.message_type === 'execution_completed') {
    return 'text-slate-900 dark:text-emerald-50';
  }
  return 'text-inherit';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'token' || normalized === 'auth') {
    return true;
  }
  if (normalized.endsWith('token') && normalized !== 'maxtoken' && normalized !== 'maxtokens') {
    return true;
  }
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function redactSensitiveString(value: string) {
  return value.replace(SENSITIVE_TOKEN_PATTERN, (_match, bearerPrefix) => {
    if (typeof bearerPrefix === 'string' && bearerPrefix.length > 0) {
      return `${bearerPrefix}${REDACTED_VALUE}`;
    }
    return REDACTED_VALUE;
  });
}

function sanitizeForDisplay(value: unknown, key = ''): unknown {
  if (key && isSensitiveKey(key)) {
    return REDACTED_VALUE;
  }
  if (typeof value === 'string') {
    return redactSensitiveString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForDisplay(item, key));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeForDisplay(entryValue, entryKey),
      ])
    );
  }
  return value;
}

function formatValue(value: unknown) {
  if (value == null) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stableJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return formatValue(value);
  }
}

function truncatePreview(value: string, maxLength = 120) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function diffValuePreview(value: unknown) {
  if (value === undefined) {
    return 'Not set';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return truncatePreview(value.trim() || '""');
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length === 0
      ? 'Empty list'
      : `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (isRecord(value)) {
    const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : null;
    const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : null;
    if (id && name && id !== name) {
      return `{id: ${id}, name: ${name}}`;
    }
    if (id) {
      return `{id: ${id}}`;
    }
    if (name) {
      return `{name: ${name}}`;
    }
    return `{${Object.keys(value).length} field${Object.keys(value).length === 1 ? '' : 's'}}`;
  }
  return truncatePreview(formatValue(value));
}

function diffChangeSummary(current: unknown, proposed: unknown) {
  if (current === undefined) {
    return `Added ${diffValuePreview(proposed)}`;
  }
  if (proposed === undefined) {
    return `Removed ${diffValuePreview(current)}`;
  }
  return `${diffValuePreview(current)} -> ${diffValuePreview(proposed)}`;
}

function valuesEqual(left: unknown, right: unknown) {
  return stableJson(left) === stableJson(right);
}

function arrayDiffItemToken(value: unknown, index: number) {
  if (isRecord(value)) {
    const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : null;
    if (id) {
      return id;
    }
    const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : null;
    if (name) {
      return name;
    }
  }
  return String(index);
}

function arrayDiffItemPath(path: string, token: string) {
  return path ? `${path}[${token}]` : `[${token}]`;
}

function buildObjectDiffRows(
  current: unknown,
  proposed: unknown,
  path = '',
  rows: Array<{ path: string; current: unknown; proposed: unknown }> = []
) {
  if (valuesEqual(current, proposed)) {
    return rows;
  }

  if (isRecord(current) && isRecord(proposed)) {
    const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(proposed)])).sort();
    for (const key of keys) {
      buildObjectDiffRows(current[key], proposed[key], path ? `${path}.${key}` : key, rows);
    }
    return rows;
  }

  if (Array.isArray(current) && Array.isArray(proposed)) {
    // Workflow definitions are usually keyed by ids. Matching array items by identity keeps the
    // approval view anchored to the changed task/agent/tool instead of dumping whole list blobs.
    const currentTokens = new Map(
      current.map((item, index) => [arrayDiffItemToken(item, index), item])
    );
    const proposedTokens = new Map(
      proposed.map((item, index) => [arrayDiffItemToken(item, index), item])
    );
    const tokens = Array.from(new Set([...currentTokens.keys(), ...proposedTokens.keys()])).sort();
    for (const token of tokens) {
      buildObjectDiffRows(
        currentTokens.get(token),
        proposedTokens.get(token),
        arrayDiffItemPath(path, token),
        rows
      );
    }
    return rows;
  }

  rows.push({ path: path || 'root', current, proposed });
  return rows;
}

function approvalBadgeVariant(
  approval: ApprovalRequest | undefined
): 'secondary' | 'outline' | 'successful' | 'failed' {
  if (!approval) {
    return 'outline';
  }
  if (approval.status === 'approved') {
    return 'successful';
  }
  if (approval.status === 'rejected' || approval.status === 'cancelled') {
    return 'failed';
  }
  return 'secondary';
}

function workflowSummaryFromMessage(message: ConversationMessage) {
  if (!message.content || typeof message.content !== 'object') {
    return null;
  }

  const workflow = message.content.workflow;
  if (!isRecord(workflow)) {
    return null;
  }

  return {
    id: typeof workflow.id === 'string' ? workflow.id : null,
    name: typeof workflow.name === 'string' ? workflow.name : 'Proposed workflow',
    version: typeof workflow.version === 'string' ? workflow.version : null,
    revision: typeof workflow.revision === 'number' ? workflow.revision : null,
    metadata: isRecord(workflow.metadata) ? workflow.metadata : undefined,
  };
}

function stringRecordValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function generatedFilesFromMessages(messages: ConversationMessage[]) {
  const files = new Map<string, GeneratedConversationFile>();

  for (const message of messages) {
    const content = isRecord(message.content) ? message.content : null;

    if (
      message.message_type === 'workflow_proposal' ||
      message.message_type === 'workflow_update_proposal'
    ) {
      const workflow = workflowSummaryFromMessage(message);
      const id = `workflow-${message.id}`;
      files.set(id, {
        id,
        title: workflow?.name ?? 'Generated workflow proposal',
        type: message.message_type === 'workflow_update_proposal' ? 'Workflow update' : 'Workflow',
        detail: workflow?.id ? `Workflow ID: ${workflow.id}` : undefined,
        createdAt: message.created_at,
      });
    }

    if (message.message_type === 'execution_completed') {
      const execution = executionPayloadFromMessage(message);
      if (execution?.finalOutput != null || execution?.executionId) {
        const id = `execution-${message.id}`;
        files.set(id, {
          id,
          title: execution.workflowName ?? execution.executionId ?? 'Generated execution output',
          type: 'Execution output',
          detail: execution.executionId ? `Execution ID: ${execution.executionId}` : undefined,
          createdAt: message.created_at,
        });
      }
    }

    const candidateCollections = [
      content?.artifacts,
      content?.generated_files,
      content?.generatedFiles,
      content?.files,
    ];

    candidateCollections.forEach((collection, collectionIndex) => {
      if (!Array.isArray(collection)) {
        return;
      }
      collection.forEach((item, itemIndex) => {
        if (!isRecord(item)) {
          return;
        }
        const title =
          stringRecordValue(item, ['name', 'filename', 'file_name', 'title', 'id']) ??
          'Generated file';
        const artifactId = stringRecordValue(item, ['id', 'artifact_id', 'document_id']);
        const type = stringRecordValue(item, ['artifact_type', 'type', 'media_type']) ?? 'Artifact';
        const uri = stringRecordValue(item, ['uri', 'url', 'storage_uri']);
        const id = `generated-${message.id}-${collectionIndex}-${artifactId ?? itemIndex}`;
        files.set(id, {
          id,
          title,
          type,
          detail: uri ?? artifactId ?? undefined,
          createdAt: message.created_at,
        });
      });
    });
  }

  return Array.from(files.values()).sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

function workflowFromApproval(approval: ApprovalRequest | undefined) {
  if (!approval || !isRecord(approval.proposed_payload)) {
    return null;
  }
  const workflow = approval.proposed_payload.workflow;
  return isRecord(workflow) ? workflow : null;
}

function workflowIdsFromApproval(approval: ApprovalRequest | null | undefined) {
  const ids = new Set<string>();
  if (!approval) {
    return ids;
  }

  if (approval.target_type === 'workflow' && approval.target_id) {
    ids.add(approval.target_id);
  }

  const workflow = workflowFromApproval(approval);
  if (typeof workflow?.id === 'string' && workflow.id.trim()) {
    ids.add(workflow.id.trim());
  }

  return ids;
}

function agentIdsFromApproval(approval: ApprovalRequest | null | undefined) {
  const ids = new Set<string>();
  if (!approval) {
    return ids;
  }

  if (approval.target_type === 'agent' && approval.target_id) {
    ids.add(approval.target_id);
  }

  if (isRecord(approval.proposed_payload)) {
    const agentId = approval.proposed_payload.agent_id;
    if (typeof agentId === 'string' && agentId.trim()) {
      ids.add(agentId.trim());
    }

    const agent = approval.proposed_payload.agent;
    if (isRecord(agent) && typeof agent.id === 'string' && agent.id.trim()) {
      ids.add(agent.id.trim());
    }
  }

  return ids;
}

function workflowMetric(workflow: Record<string, unknown> | null, key: string) {
  const value = workflow?.[key];
  return Array.isArray(value) ? value.length : 0;
}

function workflowField(workflow: Record<string, unknown> | null, key: string) {
  const value = workflow?.[key];
  if (typeof value === 'string') {
    return value.trim() || '—';
  }
  if (value == null) {
    return '—';
  }
  return formatValue(value);
}

function compactPayloadValue(value: unknown) {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length > 0 ? keys.slice(0, 4).join(', ') : null;
  }
  return formatValue(value);
}

function approvalPayloadHighlights(approval: ApprovalRequest) {
  const payload = isRecord(approval.proposed_payload) ? approval.proposed_payload : null;
  const workflow = isRecord(payload?.workflow) ? payload.workflow : null;
  const metadata = isRecord(approval.metadata) ? approval.metadata : null;
  const targetSummary = approvalTargetSummary(approval);
  const rows: Array<{ label: string; value: string }> = [];

  const addRow = (label: string, value: unknown) => {
    const formatted = compactPayloadValue(value);
    if (formatted) {
      rows.push({ label, value: formatted });
    }
  };

  addRow('Action', metadata?.action ?? approval.approval_type.replace(/_/g, ' '));
  addRow(
    'Target',
    approval.target_id ? `${approval.target_type}: ${approval.target_id}` : approval.target_type
  );
  addRow(
    'Workflow',
    workflow?.name ?? workflow?.id ?? targetSummary.workflowId ?? payload?.workflow_id
  );
  addRow('Runtime', targetSummary.runtimeAdapterId ?? payload?.default_runtime_adapter_id);
  addRow('Tool', targetSummary.toolName ?? payload?.tool_id);
  addRow('Inputs', payload?.input_payload ?? payload?.inputs);
  addRow('Arguments', targetSummary.redactedArguments ?? payload?.arguments);
  addRow('Source', approvalSourceLabel(approval));

  return rows;
}

function PendingApprovalsPanel({
  approvals,
  mainAgentName,
  isPending,
  isPopup,
  onDecision,
}: {
  approvals: ApprovalRequest[];
  mainAgentName: string;
  isPending: boolean;
  isPopup: boolean;
  onDecision: (approvalRequestId: string, action: 'approve' | 'reject') => Promise<void> | void;
}) {
  const approvalsListId = useId();
  const [isExpanded, setIsExpanded] = useState(true);
  const pendingApprovals = approvals
    .filter((approval) => approval.status === 'pending')
    .sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );

  if (pendingApprovals.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Pending approvals"
      className={
        isPopup
          ? 'border-b border-amber-200 bg-amber-50 px-4 py-3'
          : 'border-b border-amber-200 bg-amber-50 px-6 py-4'
      }
    >
      <div className="mx-auto flex max-w-4xl min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Pending approvals
            </p>
            <p className="mt-1 text-sm text-amber-900">
              {mainAgentName} is waiting for a human decision before applying these actions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{pendingApprovals.length} pending</Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={isExpanded}
              aria-controls={approvalsListId}
              onClick={() => setIsExpanded((current) => !current)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="mr-2 h-4 w-4" />
                  Collapse approvals
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Expand approvals
                </>
              )}
            </Button>
          </div>
        </div>

        {isExpanded ? (
          <div
            id={approvalsListId}
            data-testid="pending-approvals-list"
            className={
              isPopup
                ? 'max-h-[min(36vh,22rem)] overflow-y-auto pr-1'
                : 'max-h-[min(44vh,28rem)] overflow-y-auto pr-1'
            }
          >
            <div className="grid gap-3">
              {pendingApprovals.map((approval) => {
                const highlights = approvalPayloadHighlights(approval);
                return (
                  <article
                    key={approval.id}
                    className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{approval.summary}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {approval.approval_type.replace(/_/g, ' ')} · {approval.target_type}
                          {approval.target_id ? ` · ${approval.target_id}` : ''}
                        </p>
                      </div>
                      <Badge variant={approvalBadgeVariant(approval)}>
                        {approvalLabel(approval)}
                      </Badge>
                    </div>
                    <ApprovalSourceBadge approval={approval} />

                    {approval.diff_summary ? (
                      <div className="mt-3">
                        <DataBlock title="Proposed Change Summary" value={approval.diff_summary} />
                      </div>
                    ) : null}
                    <ApprovalDiffTable approval={approval} />
                    {highlights.length > 0 ? (
                      <dl className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
                        {highlights.map((item) => (
                          <div key={`${approval.id}-${item.label}`}>
                            <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {item.label}
                            </dt>
                            <dd className="mt-1 wrap-break-word text-slate-800">{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}

                    <ApprovalInspectionPanel approval={approval} />
                    <ApprovalActions
                      approval={approval}
                      isPending={isPending}
                      onDecision={onDecision}
                    />
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-900/80">
            {pendingApprovals.length} pending approval
            {pendingApprovals.length === 1 ? '' : 's'} hidden. Expand to review and act on them.
          </p>
        )}
      </div>
    </section>
  );
}

function WorkflowReviewDiff({
  currentWorkflow,
  proposedWorkflow,
  isUpdate,
}: {
  currentWorkflow: Record<string, unknown> | null;
  proposedWorkflow: Record<string, unknown> | null;
  isUpdate: boolean;
}) {
  if (!proposedWorkflow) {
    return null;
  }

  const rows = [
    {
      label: 'Name',
      current: workflowField(currentWorkflow, 'name'),
      proposed: workflowField(proposedWorkflow, 'name'),
    },
    {
      label: 'Description',
      current: workflowField(currentWorkflow, 'description'),
      proposed: workflowField(proposedWorkflow, 'description'),
    },
    {
      label: 'Entrypoint',
      current: workflowField(currentWorkflow, 'entrypoint'),
      proposed: workflowField(proposedWorkflow, 'entrypoint'),
    },
    {
      label: 'Runtime',
      current: workflowField(currentWorkflow, 'default_runtime_adapter_id'),
      proposed: workflowField(proposedWorkflow, 'default_runtime_adapter_id'),
    },
    {
      label: 'Agents',
      current: workflowMetric(currentWorkflow, 'agent_definitions'),
      proposed: workflowMetric(proposedWorkflow, 'agent_definitions'),
    },
    {
      label: 'Tasks',
      current: workflowMetric(currentWorkflow, 'task_definitions'),
      proposed: workflowMetric(proposedWorkflow, 'task_definitions'),
    },
    {
      label: 'Tools',
      current: workflowMetric(currentWorkflow, 'tool_definitions'),
      proposed: workflowMetric(proposedWorkflow, 'tool_definitions'),
    },
  ].filter((row) => !isUpdate || String(row.current) !== String(row.proposed));

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-violet-400/20 dark:bg-[linear-gradient(180deg,rgba(30,24,56,0.52)_0%,rgba(18,23,40,0.92)_100%)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-violet-100">
        {isUpdate ? 'Changed workflow fields' : 'Proposed workflow contents'}
      </p>
      {rows.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-130 text-left text-xs">
            <thead className="text-slate-500 dark:text-violet-100/85">
              <tr>
                <th className="w-32 py-2 font-medium">{isUpdate ? 'Where' : 'Field'}</th>
                <th className="py-2 font-medium">{isUpdate ? 'Change' : 'Proposed'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-white/10 dark:text-slate-100">
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="py-2 pr-3 font-medium text-slate-600 dark:text-violet-100/90">
                    {row.label}
                  </td>
                  <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">
                    {isUpdate ? diffChangeSummary(row.current, row.proposed) : row.proposed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-violet-100/75">
          No high-level workflow fields changed.
        </p>
      )}
    </div>
  );
}

function WorkflowDetailedDiff({
  currentWorkflow,
  proposedWorkflow,
  isUpdate,
}: {
  currentWorkflow: Record<string, unknown> | null;
  proposedWorkflow: Record<string, unknown> | null;
  isUpdate: boolean;
}) {
  if (!proposedWorkflow) {
    return null;
  }

  const rows =
    isUpdate && currentWorkflow ? buildObjectDiffRows(currentWorkflow, proposedWorkflow) : [];

  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-violet-400/20 dark:bg-[linear-gradient(180deg,rgba(24,22,46,0.6)_0%,rgba(13,18,33,0.96)_100%)]">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-violet-100">
        Detailed Generated Diff
      </summary>
      {isUpdate ? (
        rows.length > 0 ? (
          <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-100 dark:border-white/10">
            <table className="w-full min-w-160 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-violet-100/85">
                <tr>
                  <th className="w-56 px-3 py-2 font-medium">Path</th>
                  <th className="px-3 py-2 font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-white/10 dark:text-slate-100">
                {rows.map((row) => (
                  <tr key={row.path}>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600 dark:text-violet-100/90">
                      {row.path}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <pre className="max-w-xl whitespace-pre-wrap wrap-break-word font-medium text-slate-900 dark:text-slate-100">
                        {diffChangeSummary(row.current, row.proposed)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500 dark:text-violet-100/75">
            No field-level changes were detected.
          </p>
        )
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-violet-100/75">
          This is a new workflow proposal. Inspect the full proposed payload below before approval.
        </p>
      )}
    </details>
  );
}

function toolPayloadFromMessage(message: ConversationMessage) {
  if (!isRecord(message.content)) {
    return null;
  }

  const toolName = typeof message.content.tool_name === 'string' ? message.content.tool_name : null;
  const toolId = typeof message.content.tool_id === 'string' ? message.content.tool_id : null;
  const argumentsPayload = isRecord(message.content.arguments)
    ? sanitizeForDisplay(message.content.arguments)
    : null;
  const rawResultPayload = isRecord(message.content.result)
    ? message.content.result
    : (message.content.result ?? null);
  const resultPayload = sanitizeForDisplay(rawResultPayload);

  if (!toolName && !toolId) {
    return null;
  }

  return {
    toolName: toolName || toolId || 'Tool',
    toolId,
    argumentsPayload,
    resultPayload,
    rawResultPayload,
  };
}

function toolMessageIds(message: ConversationMessage) {
  const ids = new Set<string>();
  const addId = (value: unknown) => {
    const id = cleanLabel(value);
    if (id) {
      ids.add(id);
    }
  };
  addId(message.tool_call_id);
  const content = isRecord(message.content) ? message.content : null;
  addId(content?.tool_call_id);
  addId(content?.toolCallId);
  addId(content?.call_id);
  return ids;
}

function messageComesAfterCursor(
  messages: ConversationMessage[],
  targetMessageId: string,
  cursorMessageId: string
) {
  let seenCursor = false;
  for (const message of sortMessages(messages)) {
    if (message.id === targetMessageId) {
      return seenCursor;
    }
    if (message.id === cursorMessageId) {
      seenCursor = true;
    }
  }
  return false;
}

function messageCreatedAfter(message: ConversationMessage, cursor: ConversationMessage) {
  return new Date(message.created_at).getTime() > new Date(cursor.created_at).getTime();
}

function toolResultMatchesCall(call: ConversationMessage, result: ConversationMessage) {
  if (result.message_type !== 'tool_result' || !messageCreatedAfter(result, call)) {
    return false;
  }

  const callIds = toolMessageIds(call);
  const resultIds = toolMessageIds(result);
  if (callIds.size > 0 && resultIds.size > 0) {
    return Array.from(callIds).some((id) => resultIds.has(id));
  }

  const callTool = toolPayloadFromMessage(call);
  const resultTool = toolPayloadFromMessage(result);
  if (!callTool || !resultTool) {
    return false;
  }

  return Boolean(
    (callTool.toolId && callTool.toolId === resultTool.toolId) ||
    (callTool.toolName && callTool.toolName === resultTool.toolName)
  );
}

function approvalMatchesToolCall(message: ConversationMessage, approval: ApprovalRequest) {
  if (approval.conversation_id !== message.conversation_id) {
    return false;
  }
  if (approval.origin_message_id === message.id) {
    return true;
  }

  const tool = toolPayloadFromMessage(message);
  const toolLabel = `${tool?.toolName ?? ''} ${tool?.toolId ?? ''}`.toLowerCase();
  const isProposalTool = /\bpropos|workflow[._-]?update|workflow[._-]?create/.test(toolLabel);
  const approvalTime = new Date(approval.created_at).getTime();
  const messageTime = new Date(message.created_at).getTime();
  return (
    isProposalTool &&
    Number.isFinite(approvalTime) &&
    Number.isFinite(messageTime) &&
    approvalTime > messageTime
  );
}

function toolCallDisplayState({
  message,
  messages,
  approvals,
  pendingMainAgentTurn,
  pendingIsStale,
  pendingTurnInterrupted,
}: {
  message: ConversationMessage;
  messages: ConversationMessage[];
  approvals: ApprovalRequest[];
  pendingMainAgentTurn: PendingAsyncTurn | null;
  pendingIsStale: boolean;
  pendingTurnInterrupted: boolean;
}) {
  if (messages.some((candidate) => toolResultMatchesCall(message, candidate))) {
    return {
      label: 'Completed',
      variant: 'successful' as const,
      detail: null,
      recoverable: false,
    };
  }

  if (approvals.some((approval) => approvalMatchesToolCall(message, approval))) {
    return {
      label: 'Approval requested',
      variant: 'secondary' as const,
      detail: 'The tool produced a human approval request. Review the approval panel above.',
      recoverable: false,
    };
  }

  const callTime = new Date(message.created_at).getTime();
  const callAgeMs = Number.isFinite(callTime) ? Date.now() - callTime : 0;
  const activePendingTurn =
    pendingMainAgentTurn?.conversationId === message.conversation_id &&
    messageComesAfterCursor(messages, message.id, pendingMainAgentTurn.originMessageId);
  const shouldShowNoResult =
    pendingTurnInterrupted ||
    (activePendingTurn && pendingIsStale) ||
    callAgeMs >= ASYNC_TURN_STALE_MS;

  if (shouldShowNoResult) {
    return {
      label: 'No result',
      variant: 'failed' as const,
      detail:
        'No tool result, approval, or assistant response has been saved for this call yet. Check the backend once, or end the turn and send a steering message.',
      recoverable: Boolean(activePendingTurn),
    };
  }

  return {
    label: 'Executing',
    variant: 'secondary' as const,
    detail: null,
    recoverable: false,
  };
}

function executionPayloadFromMessage(message: ConversationMessage) {
  if (!isRecord(message.content)) {
    return null;
  }

  return {
    executionId:
      typeof message.content.execution_id === 'string'
        ? message.content.execution_id
        : message.execution_id || null,
    workflowId:
      typeof message.content.workflow_id === 'string' ? message.content.workflow_id : null,
    workflowName:
      typeof message.content.workflow_name === 'string' ? message.content.workflow_name : null,
    status: typeof message.content.status === 'string' ? message.content.status : null,
    summary: typeof message.content.summary === 'string' ? message.content.summary : null,
    finalOutput: message.content.final_output,
  };
}

function timelineEventLabel(eventType: string) {
  return eventType.replace(/[._-]/g, ' ');
}

function timelineEventSummary(event: ExecutionEventRecord) {
  const payload = isRecord(event.payload) ? event.payload : null;
  const parts: string[] = [];

  const append = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      parts.push(value.trim());
    }
  };

  append(payload?.summary);
  append(payload?.message);
  append(payload?.tool_name);
  append(payload?.task_id ?? event.task_id);
  append(payload?.agent_id ?? event.agent_id);

  return parts.length > 0 ? parts.slice(0, 3).join(' · ') : null;
}

function approvalTargetSummary(approval: ApprovalRequest) {
  const target = isRecord(approval.proposed_payload) ? approval.proposed_payload : null;
  const redactedArguments = isRecord(target?.redacted_arguments) ? target.redacted_arguments : null;
  return {
    toolName: typeof target?.tool_name === 'string' ? target.tool_name : null,
    workflowId: typeof target?.workflow_id === 'string' ? target.workflow_id : null,
    runtimeAdapterId:
      typeof target?.runtime_adapter_id === 'string' ? target.runtime_adapter_id : null,
    redactedArguments,
  };
}

function DataBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-200">
        {title}
      </p>
      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-slate-700 dark:text-slate-50">
        {formatValue(value)}
      </pre>
    </div>
  );
}

function DetailDataBlock({ title, value }: { title: string; value: unknown }) {
  if (value == null) {
    return null;
  }

  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-200">
        {title}
      </summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-slate-700 dark:text-slate-50">
        {formatValue(value)}
      </pre>
    </details>
  );
}

interface ApprovalDiffRow {
  path: string;
  current: unknown;
  proposed: unknown;
}

function approvalDiffRows(approval: ApprovalRequest): ApprovalDiffRow[] {
  const payload = isRecord(approval.proposed_payload) ? approval.proposed_payload : null;
  const diff: unknown = payload?.diff;
  if (!Array.isArray(diff)) {
    return [];
  }
  return diff.filter(
    (row): row is ApprovalDiffRow => isRecord(row) && typeof row.path === 'string'
  );
}

function ApprovalDiffTable({ approval }: { approval: ApprovalRequest }) {
  const rows = approvalDiffRows(approval).slice(0, 12);
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/70">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
        Proposed diff
      </div>
      <div className="divide-y divide-slate-100 dark:divide-white/10">
        {rows.map((row) => (
          <div
            key={row.path}
            className="grid gap-2 px-3 py-2 text-xs md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
          >
            <div className="font-medium text-slate-700 dark:text-slate-200">{row.path}</div>
            <pre className="min-w-0 whitespace-pre-wrap wrap-break-word text-slate-900 dark:text-slate-50">
              {diffChangeSummary(row.current, row.proposed)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalInspectionPanel({ approval }: { approval: ApprovalRequest }) {
  const hasMetadata = approval.metadata && Object.keys(approval.metadata).length > 0;
  const hasPayload = approval.proposed_payload && Object.keys(approval.proposed_payload).length > 0;

  if (!hasPayload && !hasMetadata) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      <DetailDataBlock title="Full Proposed Payload" value={approval.proposed_payload} />
      <DetailDataBlock title="Approval Metadata" value={approval.metadata} />
    </div>
  );
}

function ApprovalInnerWorkings({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/70">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-200">
            {title}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-100/75">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? (
            <>
              <ChevronUp className="mr-2 h-4 w-4" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-4 w-4" />
              Show details
            </>
          )}
        </Button>
      </div>
      {isOpen ? (
        <div
          id={contentId}
          data-testid={`${title.toLowerCase().replace(/\s+/g, '-')}-content`}
          className="max-h-[min(48vh,30rem)] space-y-3 overflow-y-auto p-3 pr-2"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

function ExecutionTimelinePreview({
  executionId,
  status,
}: {
  executionId: string;
  status?: string | null;
}) {
  const isTerminal = status ? TERMINAL_RUN_STATUSES.has(status) : false;
  const timelineQuery = useQuery({
    queryKey: queryKeys.backendRunTimeline(executionId),
    queryFn: () => logsApi.getRunTimeline(executionId),
    enabled: Boolean(executionId),
    refetchInterval: isTerminal ? false : 3000,
  });

  if (timelineQuery.isLoading) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300">
        Loading execution timeline...
      </div>
    );
  }

  if (timelineQuery.isError) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
        Execution timeline could not be loaded right now.
      </div>
    );
  }

  const events = timelineQuery.data?.events ?? [];
  const visibleEvents = events.slice(-6);

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Execution timeline
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{events.length} events</Badge>
          {timelineQuery.data?.execution_duration_ms != null ? (
            <Badge variant="outline">{timelineQuery.data.execution_duration_ms} ms</Badge>
          ) : null}
        </div>
      </div>

      {visibleEvents.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          No execution events recorded yet.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {visibleEvents.map((event) => {
            const summary = timelineEventSummary(event);
            return (
              <li key={event.id} className="flex gap-3 text-xs">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {timelineEventLabel(event.event_type)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">#{event.sequence}</span>
                    {event.timestamp ? (
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    ) : null}
                  </div>
                  {summary ? (
                    <p className="mt-1 wrap-break-word text-slate-600 dark:text-slate-300">
                      {summary}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {events.length > visibleEvents.length ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Showing latest {visibleEvents.length} events. Open the run for the full timeline.
        </p>
      ) : null}
    </div>
  );
}

function RunLifecycleActions({
  runId,
  workflowId,
  status,
}: {
  runId: string;
  workflowId?: string | null;
  status?: string | null;
}) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const normalizedStatus = typeof status === 'string' ? status : 'unknown';
  const canPause = normalizedStatus === 'running';
  const canResume = normalizedStatus === 'paused';
  const canCancel = !TERMINAL_RUN_STATUSES.has(normalizedStatus);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.backendRun(runId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backendRunEvents(runId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backendRunTimeline(runId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backendAgentRuns() }),
      workflowId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowRuns(workflowId) })
        : Promise.resolve(),
    ]);
  };

  const runAction = (action: 'pause' | 'resume' | 'cancel') => {
    startTransition(() => {
      void toast.promise(
        (async () => {
          if (action === 'pause') {
            await runsApi.pauseRun(runId);
          } else if (action === 'resume') {
            await runsApi.resumeRun(runId);
          } else {
            await runsApi.cancelRun(runId);
          }
          await refreshQueries();
        })(),
        {
          loading:
            action === 'pause'
              ? 'Pausing run...'
              : action === 'resume'
                ? 'Resuming run...'
                : 'Cancelling run...',
          success:
            action === 'pause'
              ? 'Run paused.'
              : action === 'resume'
                ? 'Run resumed.'
                : 'Run cancellation requested.',
          error: (error) =>
            error instanceof Error
              ? error.message
              : action === 'pause'
                ? 'Failed to pause run.'
                : action === 'resume'
                  ? 'Failed to resume run.'
                  : 'Failed to cancel run.',
          position: 'top-right',
        }
      );
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canPause || isPending}
        onClick={() => runAction('pause')}
      >
        {isPending && canPause ? 'Pausing...' : 'Pause'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canResume || isPending}
        onClick={() => runAction('resume')}
      >
        {isPending && canResume ? 'Resuming...' : 'Resume'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canCancel || isPending}
        onClick={() => runAction('cancel')}
      >
        {isPending && canCancel ? 'Cancelling...' : 'Cancel'}
      </Button>
    </>
  );
}

function ApprovalActions({
  approval,
  isPending,
  onDecision,
}: {
  approval: ApprovalRequest;
  isPending: boolean;
  onDecision: (approvalRequestId: string, action: 'approve' | 'reject') => Promise<void> | void;
}) {
  if (approval.status === 'pending') {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          className="agency-gradient text-white hover:brightness-105"
          disabled={isPending}
          onClick={() => void onDecision(approval.id, 'approve')}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => void onDecision(approval.id, 'reject')}
        >
          Reject
        </Button>
      </div>
    );
  }

  if (approval.decision_reason) {
    return <div className="mt-3 text-xs text-slate-500">{approval.decision_reason}</div>;
  }

  return null;
}

function WorkflowProposalCard({
  message,
  approval,
  isPending,
  onDecision,
}: {
  message: ConversationMessage;
  approval?: ApprovalRequest;
  isPending: boolean;
  onDecision: (approvalRequestId: string, action: 'approve' | 'reject') => Promise<void> | void;
}) {
  const workflow = workflowSummaryFromMessage(message);
  const isUpdate = message.message_type === 'workflow_update_proposal';
  const currentWorkflowQuery = useQuery({
    queryKey: workflow?.id
      ? queryKeys.backendWorkflow(workflow.id)
      : ['backendWorkflow', 'missing'],
    queryFn: () => workflowsApi.getWorkflow(workflow?.id || ''),
    enabled: isUpdate && Boolean(workflow?.id),
  });

  if (!workflow) {
    return null;
  }

  const proposedWorkflow = workflowFromApproval(approval);
  const currentWorkflow = currentWorkflowQuery.data
    ? (currentWorkflowQuery.data as unknown as Record<string, unknown>)
    : null;

  return (
    <div className="mr-auto ml-0 max-w-3xl rounded-2xl border border-primary-100 bg-primary-50/70 p-4 text-sm shadow-sm shadow-primary/5 dark:border-primary-400/20 dark:bg-[linear-gradient(180deg,rgba(24,24,44,0.96)_0%,rgba(18,24,42,0.98)_100%)] dark:text-slate-100 dark:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isUpdate ? 'Workflow update proposal' : 'Workflow creation proposal'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-violet-100/80">
            Review the proposed workflow action before applying it.
          </p>
        </div>
        {approval ? (
          <Badge variant={approvalBadgeVariant(approval)}>{approvalLabel(approval)}</Badge>
        ) : null}
      </div>
      {approval ? <ApprovalSourceBadge approval={approval} /> : null}

      <div className="mt-3 grid gap-3 rounded-xl border border-primary-100 bg-white/90 p-4 dark:border-primary-400/15 dark:bg-white/4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-violet-100/80">
            Workflow
          </p>
          <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{workflow.name}</p>
          {workflow.id ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-violet-100/75">{workflow.id}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {workflow.version ? <Badge variant="outline">Version {workflow.version}</Badge> : null}
          {workflow.revision !== null ? (
            <Badge variant="outline">Revision {workflow.revision}</Badge>
          ) : null}
          {approval?.approval_type ? (
            <Badge variant="outline">{approval.approval_type.replace(/_/g, ' ')}</Badge>
          ) : null}
        </div>
      </div>

      {approval?.diff_summary ? (
        <DataBlock title="Diff Summary" value={approval.diff_summary} />
      ) : null}
      <ApprovalInnerWorkings
        title="Inner workings"
        description="Expanded review includes the diff, raw payload, and workflow comparison."
      >
        {approval ? <ApprovalDiffTable approval={approval} /> : null}
        {isUpdate && currentWorkflowQuery.isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300">
            Loading current workflow for review...
          </div>
        ) : null}
        {isUpdate && currentWorkflowQuery.isError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
            Current workflow could not be loaded. Review the proposed payload before approving.
          </div>
        ) : null}
        <WorkflowReviewDiff
          currentWorkflow={isUpdate ? currentWorkflow : null}
          proposedWorkflow={proposedWorkflow}
          isUpdate={isUpdate}
        />
        <WorkflowDetailedDiff
          currentWorkflow={isUpdate ? currentWorkflow : null}
          proposedWorkflow={proposedWorkflow}
          isUpdate={isUpdate}
        />
        {approval ? <ApprovalInspectionPanel approval={approval} /> : null}
      </ApprovalInnerWorkings>

      <div className="mt-3 flex flex-wrap gap-2">
        {workflow.id ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/workflows/${workflow.id}`}>Open workflow</Link>
          </Button>
        ) : null}
        {workflow.id ? (
          <WorkflowRunActionButton workflowId={workflow.id} label="Run workflow" />
        ) : null}
      </div>

      {approval ? (
        <ApprovalActions approval={approval} isPending={isPending} onDecision={onDecision} />
      ) : null}
    </div>
  );
}

function GenericApprovalCard({
  approval,
  alignRight,
  isPending,
  onDecision,
}: {
  approval: ApprovalRequest;
  alignRight: boolean;
  isPending: boolean;
  onDecision: (approvalRequestId: string, action: 'approve' | 'reject') => Promise<void> | void;
}) {
  const workflowTarget =
    approval.target_type === 'workflow' && approval.target_id
      ? `/workflows/${approval.target_id}`
      : null;
  const runTarget =
    approval.target_type === 'execution' && approval.target_id
      ? `/runs/${approval.target_id}`
      : null;
  const targetSummary = approvalTargetSummary(approval);

  return (
    <div
      className={`${
        alignRight ? 'mr-0 ml-auto' : 'mr-auto ml-0'
      } max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm dark:border-teal-400/24 dark:bg-[linear-gradient(180deg,rgba(10,49,56,0.44)_0%,rgba(13,22,38,0.98)_100%)] dark:text-slate-100 dark:shadow-none`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-medium text-slate-900 dark:text-slate-100">{approval.summary}</div>
        <Badge variant={approvalBadgeVariant(approval)}>{approvalLabel(approval)}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-teal-100/80">
        <span>{approval.approval_type.replace(/_/g, ' ')}</span>
        <span>·</span>
        <span>{approval.target_type}</span>
        {approval.target_id ? (
          <>
            <span>·</span>
            <span>{approval.target_id}</span>
          </>
        ) : null}
      </div>
      <ApprovalSourceBadge approval={approval} />
      <div className="mt-3 flex flex-wrap gap-2">
        {workflowTarget ? (
          <Button asChild variant="outline" size="sm">
            <Link href={workflowTarget}>Open workflow</Link>
          </Button>
        ) : null}
        {runTarget ? (
          <Button asChild variant="outline" size="sm">
            <Link href={runTarget}>Open run</Link>
          </Button>
        ) : null}
        {approval.target_type === 'workflow' && approval.target_id ? (
          <WorkflowRunActionButton workflowId={approval.target_id} label="Run workflow" />
        ) : null}
      </div>
      {targetSummary.toolName ||
      targetSummary.runtimeAdapterId ||
      targetSummary.redactedArguments ? (
        <div className="mt-3 space-y-3">
          {targetSummary.toolName ? (
            <DataBlock title="Tool" value={targetSummary.toolName} />
          ) : null}
          {targetSummary.runtimeAdapterId ? (
            <DataBlock title="Runtime Adapter" value={targetSummary.runtimeAdapterId} />
          ) : null}
          {targetSummary.redactedArguments ? (
            <DataBlock title="Arguments" value={targetSummary.redactedArguments} />
          ) : null}
        </div>
      ) : null}
      <ApprovalInnerWorkings
        title="Inner workings"
        description="Expanded review includes the raw diff, payload, and metadata."
      >
        <ApprovalDiffTable approval={approval} />
        <ApprovalInspectionPanel approval={approval} />
      </ApprovalInnerWorkings>
      <ApprovalActions approval={approval} isPending={isPending} onDecision={onDecision} />
    </div>
  );
}

function ExecutionStatusCard({ message }: { message: ConversationMessage }) {
  const execution = executionPayloadFromMessage(message);
  if (!execution?.executionId) {
    return null;
  }

  const isCompleted = message.message_type === 'execution_completed';

  return (
    <div className="mr-auto ml-0 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm dark:border-cyan-400/24 dark:bg-[linear-gradient(180deg,rgba(16,42,70,0.42)_0%,rgba(12,18,32,0.98)_100%)] dark:text-slate-100 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {isCompleted ? 'Execution completed' : 'Execution started'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-cyan-100/90">
            {execution.executionId}
          </p>
        </div>
        <Badge variant={isCompleted ? 'successful' : 'secondary'}>
          {execution.status ? execution.status : isCompleted ? 'Completed' : 'Running'}
        </Badge>
      </div>
      {execution.workflowName ||
      execution.workflowId ||
      execution.summary ||
      execution.finalOutput ? (
        <ApprovalInnerWorkings
          title="Execution details"
          description="Open to inspect the workflow, summary, final output, and timeline."
        >
          <div className="space-y-3">
            {execution.workflowName || execution.workflowId ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-cyan-100/85">
                Workflow:{' '}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {execution.workflowName || execution.workflowId}
                </span>
              </div>
            ) : null}
            {execution.summary ? <DataBlock title="Summary" value={execution.summary} /> : null}
            {execution.finalOutput ? (
              <DataBlock title="Final Output" value={execution.finalOutput} />
            ) : null}
          </div>
          <ExecutionTimelinePreview executionId={execution.executionId} status={execution.status} />
        </ApprovalInnerWorkings>
      ) : (
        <ExecutionTimelinePreview executionId={execution.executionId} status={execution.status} />
      )}
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/runs/${execution.executionId}`}>Open run</Link>
          </Button>
          {execution.workflowId ? (
            <WorkflowRunActionButton workflowId={execution.workflowId} label="Run again" />
          ) : null}
          <RunLifecycleActions
            runId={execution.executionId}
            workflowId={execution.workflowId}
            status={execution.status}
          />
        </div>
      </div>
    </div>
  );
}

function ToolCallCard({
  message,
  messages,
  approvals,
  pendingMainAgentTurn,
  pendingIsStale,
  pendingTurnInterrupted,
  checkingPendingTurn,
  onCheckPendingTurn,
  onEndPendingTurn,
}: {
  message: ConversationMessage;
  messages: ConversationMessage[];
  approvals: ApprovalRequest[];
  pendingMainAgentTurn: PendingAsyncTurn | null;
  pendingIsStale: boolean;
  pendingTurnInterrupted: boolean;
  checkingPendingTurn: boolean;
  onCheckPendingTurn: () => void;
  onEndPendingTurn: () => void;
}) {
  const tool = toolPayloadFromMessage(message);
  if (!tool) {
    return null;
  }
  const displayState = toolCallDisplayState({
    message,
    messages,
    approvals,
    pendingMainAgentTurn,
    pendingIsStale,
    pendingTurnInterrupted,
  });

  return (
    <div
      className={[
        'mr-auto ml-0 max-w-3xl rounded-2xl p-4 text-sm shadow-sm',
        displayState.label === 'No result'
          ? 'border border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-[linear-gradient(180deg,rgba(66,40,10,0.55)_0%,rgba(34,24,14,0.96)_100%)] dark:text-amber-50 dark:shadow-none'
          : 'border border-sky-200 bg-sky-50 dark:border-sky-400/30 dark:bg-[linear-gradient(180deg,rgba(12,48,74,0.52)_0%,rgba(14,24,42,0.96)_100%)] dark:text-sky-50 dark:shadow-none',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">Tool call</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-sky-100/95">{tool.toolName}</p>
        </div>
        <Badge variant={displayState.variant}>{displayState.label}</Badge>
      </div>
      {displayState.detail ? (
        <p
          className={`mt-3 text-xs leading-5 ${
            displayState.label === 'No result'
              ? 'text-amber-800 dark:text-amber-100/90'
              : 'text-slate-600 dark:text-sky-50/95'
          }`}
        >
          {displayState.detail}
        </p>
      ) : null}
      <ApprovalInnerWorkings
        title="Call details"
        description="Open to inspect the tool id and redacted arguments."
      >
        <div className="space-y-3">
          {tool.toolId ? <DataBlock title="Tool Id" value={tool.toolId} /> : null}
          {tool.argumentsPayload ? (
            <DataBlock title="Arguments (Redacted)" value={tool.argumentsPayload} />
          ) : null}
        </div>
      </ApprovalInnerWorkings>
      {displayState.recoverable ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
            disabled={checkingPendingTurn}
            onClick={onCheckPendingTurn}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkingPendingTurn ? 'animate-spin' : ''}`} />
            {checkingPendingTurn ? 'Checking...' : 'Check now'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
            onClick={onEndPendingTurn}
          >
            End turn
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ToolResultCard({ message }: { message: ConversationMessage }) {
  const tool = toolPayloadFromMessage(message);
  if (!tool) {
    return null;
  }

  const resultStatus =
    isRecord(tool.rawResultPayload) && typeof tool.rawResultPayload.status === 'string'
      ? tool.rawResultPayload.status
      : null;
  const linkedWorkflowId =
    isRecord(tool.rawResultPayload) && typeof tool.rawResultPayload.workflow_id === 'string'
      ? tool.rawResultPayload.workflow_id
      : null;
  const linkedRunId =
    isRecord(tool.rawResultPayload) && typeof tool.rawResultPayload.execution_id === 'string'
      ? tool.rawResultPayload.execution_id
      : null;
  const linkedRunStatus =
    isRecord(tool.rawResultPayload) && typeof tool.rawResultPayload.status === 'string'
      ? tool.rawResultPayload.status
      : null;

  return (
    <div className="mr-auto ml-0 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm shadow-sm dark:border-emerald-400/30 dark:bg-[linear-gradient(180deg,rgba(8,60,48,0.46)_0%,rgba(11,28,30,0.98)_100%)] dark:text-emerald-50 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">Tool result</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-emerald-100/95">{tool.toolName}</p>
        </div>
        <Badge variant={resultStatus === 'error' ? 'failed' : 'successful'}>
          {resultStatus || 'Completed'}
        </Badge>
      </div>
      <ApprovalInnerWorkings
        title="Result details"
        description="Open to inspect the tool id and redacted result payload."
      >
        <div className="space-y-3">
          {tool.toolId ? <DataBlock title="Tool Id" value={tool.toolId} /> : null}
          {tool.resultPayload !== null ? (
            <DataBlock title="Result (Redacted)" value={tool.resultPayload} />
          ) : null}
        </div>
      </ApprovalInnerWorkings>
      {linkedWorkflowId || linkedRunId ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkedWorkflowId ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/workflows/${linkedWorkflowId}`}>Open workflow</Link>
              </Button>
              <WorkflowRunActionButton workflowId={linkedWorkflowId} label="Run workflow" />
            </>
          ) : null}
          {linkedRunId ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/runs/${linkedRunId}`}>Open run</Link>
              </Button>
              <RunLifecycleActions
                runId={linkedRunId}
                workflowId={linkedWorkflowId}
                status={linkedRunStatus}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ConversationContextUsageMeter({
  usage,
  loading,
  onCompact,
}: {
  usage: ConversationContextUsage | null | undefined;
  loading: boolean;
  onCompact: () => void;
}) {
  if (!usage && !loading) {
    return null;
  }

  const tone = contextUsageTone(usage);
  const usagePercent = usage?.usage_percent ?? null;
  const clampedPercent =
    usagePercent == null ? 0 : Math.min(Math.max(Number(usagePercent), 0), 100);
  const modelLabel = usage?.model_profile?.model ?? usage?.model_profile?.name ?? 'selected model';
  const contextWindow = usage?.context_window;
  const hasWindow = typeof contextWindow === 'number' && contextWindow > 0;
  const shouldPrompt = Boolean(usage?.compact_recommended);
  const tooltipMessage = hasWindow
    ? `${tone.label} for ${modelLabel}. ${formatTokenCount(usage?.estimated_context_tokens)} of ${formatTokenCount(
        contextWindow
      )} context tokens are currently estimated in the next prompt.`
    : `Set a context window on ${modelLabel} to enable threshold alerts.`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`relative flex h-9 w-44 items-center justify-between gap-2 overflow-hidden rounded-md border px-3 text-xs shadow-sm ${tone.border} ${tone.background} ${tone.text} ${
              shouldPrompt ? 'cursor-pointer' : ''
            }`}
            role={shouldPrompt ? 'button' : undefined}
            tabIndex={shouldPrompt ? 0 : undefined}
            onClick={shouldPrompt ? onCompact : undefined}
            onKeyDown={(event) => {
              if (!shouldPrompt || (event.key !== 'Enter' && event.key !== ' ')) {
                return;
              }
              event.preventDefault();
              onCompact();
            }}
            aria-label={tooltipMessage}
          >
            <div className="flex min-w-0 items-center gap-2">
              {shouldPrompt ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <Gauge className="h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0 truncate font-medium">
                {loading && !usage
                  ? 'Measuring...'
                  : `${formatTokenCount(usage?.estimated_context_tokens)} tokens`}
              </span>
            </div>
            {hasWindow ? (
              <span className="shrink-0 font-medium">{usagePercent?.toFixed(0)}%</span>
            ) : null}
            <div className="absolute inset-x-3 bottom-1 h-1 overflow-hidden rounded-full bg-white/80">
              <div
                className={`h-full rounded-full ${tone.bar}`}
                style={{ width: `${hasWindow ? Math.max(clampedPercent, 2) : 0}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-80 max-w-xs text-xs leading-5"
        >
          <div className="font-medium text-slate-900">{tooltipMessage}</div>
          <div className="mt-1 text-slate-600">
            {usage
              ? `${usage.prompt_message_count} prompt messages from ${usage.message_count} conversation messages.`
              : 'Waiting for the active conversation context estimate.'}
          </div>
          {shouldPrompt ? (
            <div className="mt-1 text-slate-600">Click the meter to open compact controls.</div>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AssistantEmptyState({
  mainAgentName,
  contextLabel,
  suggestions,
  onSelectPrompt,
}: {
  mainAgentName: string;
  contextLabel?: string;
  suggestions: AssistantPromptSuggestion[];
  onSelectPrompt: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-start px-4 py-8 text-center md:justify-center md:py-10">
      <div className="relative">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-md shadow-primary/20">
          <Bot className="h-7 w-7" />
        </div>
        <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-slate-950 dark:text-slate-100">
        {contextLabel ? `What should we do with ${contextLabel}?` : 'What should we work on?'}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
        {contextLabel
          ? `${mainAgentName} can use the current page context. Suggestions only fill the composer so you can review them before sending.`
          : `${mainAgentName} is your main agent. It can help set up workflows, review runs, and decide what to do next.`}
      </p>
      <div className="mt-6 grid w-full gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            className="group flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium leading-5 text-slate-700 shadow-sm shadow-primary/5 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:border-white/10 dark:bg-white/4 dark:text-slate-200 dark:shadow-none dark:hover:border-cyan-400/20 dark:hover:bg-white/8 dark:hover:text-slate-100"
            onClick={() => onSelectPrompt(suggestion.prompt)}
            aria-label={`Use suggestion: ${suggestion.label}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-violet-400/10 dark:text-violet-200">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900 dark:text-slate-100">
                {suggestion.label}
              </span>
              {suggestion.prompt !== suggestion.label ? (
                <span className="mt-0.5 block text-xs font-normal leading-5 text-slate-500 dark:text-slate-400">
                  {suggestion.prompt}
                </span>
              ) : null}
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ConversationCompactPanel({
  conversation,
  messages,
  compactPacks,
  compactPacksLoading,
  form,
  compactResult,
  compactError,
  compactWorking,
  onFormChange,
  onPreview,
  onSave,
  onCopyContent,
  onUseContentInNewChat,
  onCopyPack,
  onUsePackInNewChat,
  onCreateWorkflowFromPack,
  onRefreshPacks,
  onClose,
}: {
  conversation: Conversation | null;
  messages: ConversationMessage[];
  compactPacks: MemoryRecord[];
  compactPacksLoading: boolean;
  form: CompactFormState;
  compactResult: ConversationCompactResponse | null;
  compactError: string | null;
  compactWorking: boolean;
  onFormChange: (patch: Partial<CompactFormState>) => void;
  onPreview: () => void;
  onSave: () => void;
  onCopyContent: (content: string) => void;
  onUseContentInNewChat: (content: string) => void;
  onCopyPack: (pack: MemoryRecord) => void;
  onUsePackInNewChat: (pack: MemoryRecord) => void;
  onCreateWorkflowFromPack: (pack: MemoryRecord) => void;
  onRefreshPacks: () => void;
  onClose: () => void;
}) {
  const selectedRangeNeedsMessages = form.sourceRange === 'selected';
  const selectedRangeReady =
    !selectedRangeNeedsMessages || (form.sourceMessageStartId && form.sourceMessageEndId);
  const canRun = Boolean(conversation?.id && messages.length > 0 && selectedRangeReady);
  const tokenBudget = compactTokenBudget(form);

  return (
    <section className="border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-[#07111f]">
      <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-cyan-500/15 dark:bg-[#08101d] dark:shadow-[0_18px_40px_rgba(2,8,23,0.42)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-600 dark:text-cyan-300" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Compact conversation
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                Create a reusable context pack from the active conversation.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">Mode</span>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                value={form.mode}
                onChange={(event) =>
                  onFormChange({ mode: event.target.value as ConversationCompactMode })
                }
              >
                {compactModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">Token budget</span>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                value={form.tokenBudgetPreset}
                onChange={(event) =>
                  onFormChange({
                    tokenBudgetPreset: event.target.value as CompactTokenBudgetPreset,
                  })
                }
              >
                {compactTokenBudgetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.value === 'custom' ? '' : ` (${option.tokens})`}
                  </option>
                ))}
              </select>
            </label>

            {form.tokenBudgetPreset === 'custom' ? (
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Custom tokens
                </span>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                  inputMode="numeric"
                  value={form.customTokenBudget}
                  onChange={(event) => onFormChange({ customTokenBudget: event.target.value })}
                />
              </label>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-cyan-500/15 dark:bg-[#0d1a2a]">
                <span className="block font-medium text-slate-700 dark:text-slate-100">
                  Resolved budget
                </span>
                <span className="text-slate-500 dark:text-cyan-200">{tokenBudget} tokens</span>
              </div>
            )}

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">Source range</span>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                value={form.sourceRange}
                onChange={(event) =>
                  onFormChange({
                    sourceRange: event.target.value as ConversationCompactSourceRange,
                  })
                }
              >
                {compactSourceRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {form.sourceRange === 'selected' ? (
              <>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Start message
                  </span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                    value={form.sourceMessageStartId}
                    onChange={(event) => onFormChange({ sourceMessageStartId: event.target.value })}
                  >
                    <option value="">Select start</option>
                    {messages.map((message) => (
                      <option key={message.id} value={message.id}>
                        {message.role} · {formatTimestamp(message.created_at)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    End message
                  </span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                    value={form.sourceMessageEndId}
                    onChange={(event) => onFormChange({ sourceMessageEndId: event.target.value })}
                  >
                    <option value="">Select end</option>
                    {messages.map((message) => (
                      <option key={message.id} value={message.id}>
                        {message.role} · {formatTimestamp(message.created_at)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}

            {form.sourceRange === 'older_than_recent' ? (
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Recent raw turns
                </span>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                  inputMode="numeric"
                  value={form.recentMessageLimit}
                  onChange={(event) => onFormChange({ recentMessageLimit: event.target.value })}
                />
              </label>
            ) : null}
          </div>

          {form.mode === 'custom' ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">Keep</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                  value={form.customKeep}
                  onChange={(event) => onFormChange({ customKeep: event.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">Drop</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
                  value={form.customDrop}
                  onChange={(event) => onFormChange({ customDrop: event.target.value })}
                />
              </label>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.persist}
                onChange={(event) => onFormChange({ persist: event.target.checked })}
              />
              Save to memory
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.confirmed}
                onChange={(event) => onFormChange({ confirmed: event.target.checked })}
              />
              Confirm sensitive save
            </label>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRun || compactWorking}
                onClick={onPreview}
              >
                Preview
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canRun || !form.persist || compactWorking}
                onClick={onSave}
              >
                {compactWorking ? 'Compacting...' : 'Save pack'}
              </Button>
            </div>
          </div>

          {compactError ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-300">{compactError}</p>
          ) : null}

          {compactResult ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-cyan-500/15 dark:bg-[#0b1523]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{compactResult.status}</Badge>
                  <Badge variant="secondary">{compactResult.mode}</Badge>
                  <span className="text-xs text-slate-500 dark:text-slate-300">
                    {compactResult.estimated_compact_tokens} compact tokens
                  </span>
                  {compactResult.sensitive ? <Badge variant="destructive">Sensitive</Badge> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onCopyContent(compactResult.content)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onUseContentInNewChat(compactResult.content)}
                  >
                    Use in new chat
                  </Button>
                </div>
              </div>
              {compactResult.progress ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                  {compactResult.progress.completed_steps} steps completed ·{' '}
                  {compactResult.progress.failed_steps} failed
                </p>
              ) : null}
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-sm leading-6 text-slate-800 dark:border dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100">
                {compactResult.content}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-cyan-500/15 dark:bg-[#0c1624] dark:shadow-[0_18px_40px_rgba(2,8,23,0.42)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-slate-500 dark:text-cyan-300" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Compact packs
              </h3>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onRefreshPacks}>
              Refresh
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {!conversation ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Open or create a conversation first.
              </p>
            ) : compactPacksLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Loading compact packs...</p>
            ) : compactPacks.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">
                No compact packs saved yet.
              </p>
            ) : (
              compactPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0f172a]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {compactPackTitle(pack)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                        {compactPackMode(pack)} · {pack.status ?? 'active'}
                      </p>
                    </div>
                    {pack.sensitive ? <Badge variant="destructive">Sensitive</Badge> : null}
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {pack.content}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCopyPack(pack)}
                    >
                      <Clipboard className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onUsePackInNewChat(pack)}
                    >
                      Use in new chat
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={compactWorking}
                      onClick={() => onCreateWorkflowFromPack(pack)}
                    >
                      Create workflow
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ConversationDocumentsDrawer({
  conversation,
  generatedFiles,
  onClose,
}: {
  conversation: Conversation | null;
  generatedFiles: GeneratedConversationFile[];
  onClose: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-[#08101d]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-white/10">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Conversation files
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            Uploaded and generated files for this chat.
          </p>
        </div>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 shrink-0 p-0"
                onClick={onClose}
                aria-label="Close conversation files"
                title="Close conversation files"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close conversation files</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 dark:bg-[#07111f]">
        {conversation ? (
          <UploadedDocumentsList
            scope="conversation"
            conversationId={conversation.id}
            tagFilter={`conversation:${conversation.id}`}
            title="Uploaded"
            description="Files attached to this conversation."
            emptyMessage="No files have been attached to this conversation yet."
          />
        ) : (
          <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0c1624]">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Uploaded</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              Start or open a conversation to see attached files.
            </p>
          </section>
        )}

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-cyan-500/15 dark:bg-[#0c1624]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Generated
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Files and outputs produced during this conversation.
              </p>
            </div>
            <Badge variant="outline">{generatedFiles.length}</Badge>
          </div>

          {generatedFiles.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">No generated files yet.</p>
          ) : (
            <div className="space-y-2">
              {generatedFiles.map((file) => (
                <div
                  key={file.id}
                  className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-[#0f172a]"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <FileOutput className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-cyan-300" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {file.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        {file.type} · {formatConversationTimestamp(file.createdAt)}
                      </p>
                      {file.detail ? (
                        <p
                          className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400"
                          title={file.detail}
                        >
                          {file.detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationActivityPanel({
  activity,
  mainAgentName,
  live = false,
}: {
  activity: ConversationTurnActivity;
  mainAgentName: string;
  live?: boolean;
}) {
  const events = visibleActivityEvents(activity.events);
  const completedCount = events.filter(
    (event) => activityEventStatus(event) === 'completed'
  ).length;
  const failedCount = events.filter((event) => activityEventStatus(event) === 'failed').length;
  const hasDraft = activity.draftText.trim().length > 0;
  const statusLabel =
    activity.status === 'failed'
      ? 'Failed'
      : activity.status === 'cancelled'
        ? 'Cancelled'
        : activity.status === 'completed'
          ? 'Completed'
          : 'Running';

  if (events.length === 0 && !hasDraft && !live) {
    return null;
  }

  return (
    <details
      className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm shadow-sm shadow-primary/5 open:space-y-3"
      open={live}
    >
      <summary className="cursor-pointer select-none text-sm font-medium text-slate-800">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{live ? `${mainAgentName} activity` : 'Activity'}</span>
          <Badge variant={activity.status === 'failed' ? 'destructive' : 'outline'}>
            {statusLabel}
          </Badge>
          {events.length > 0 ? (
            <span className="text-xs font-normal text-slate-500">
              {completedCount}/{events.length} steps
              {failedCount > 0 ? `, ${failedCount} failed` : ''}
            </span>
          ) : null}
        </span>
      </summary>

      <div className="space-y-2">
        {events.length === 0 ? (
          <p className="text-xs leading-5 text-slate-500">Waiting for activity updates...</p>
        ) : (
          <ol className="space-y-2">
            {events.map((event) => {
              const status = activityEventStatus(event);
              return (
                <li key={event.id} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <span
                    className={[
                      'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                      status === 'completed'
                        ? 'bg-emerald-500'
                        : status === 'failed'
                          ? 'bg-red-500'
                          : status === 'cancelled'
                            ? 'bg-slate-400'
                            : 'bg-sky-500',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="font-medium text-slate-800">{activityTitle(event)}</p>
                      <span className="text-xs text-slate-500">
                        {formatTimestamp(event.occurred_at)}
                      </span>
                    </div>
                    {event.detail ? (
                      <p className="mt-1 text-xs leading-5 text-slate-600">{event.detail}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {hasDraft ? (
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
              Draft response
            </div>
            <div
              className="max-w-none wrap-break-word whitespace-pre-wrap text-sky-950"
              style={{ tabSize: 8 }}
            >
              <AssistantMarkdown>{activity.draftText}</AssistantMarkdown>
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

interface ConversationWorkspaceProps {
  mode?: 'page' | 'popup';
  contextMetadata?: () => JsonObject;
  onOpenFullPage?: () => void;
}

function ConversationPageContextRegistrar({
  conversation,
  messages,
  approvals,
  mainAgentId,
  mainAgentName,
  mainAgentLookupError,
}: {
  conversation: Conversation | null;
  messages: ConversationMessage[];
  approvals: ApprovalRequest[];
  mainAgentId: string | null;
  mainAgentName: string;
  mainAgentLookupError: string | null;
}) {
  const assistantPageContext = useMemo(() => {
    const latestMessage = messages[messages.length - 1] ?? null;
    const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');
    const workflowIds = new Set<string>();
    const agentIds = new Set<string>();

    approvals.forEach((approval) => {
      workflowIdsFromApproval(approval).forEach((workflowId) => workflowIds.add(workflowId));
      agentIdsFromApproval(approval).forEach((agentId) => agentIds.add(agentId));
    });

    const firstWorkflowId = Array.from(workflowIds)[0] ?? null;
    const firstPendingApproval = pendingApprovals[0] ?? null;
    const entities = [
      conversation
        ? {
            type: 'conversation',
            id: conversation.id,
            name: conversation.title || 'Assistant conversation',
          }
        : null,
      mainAgentId
        ? {
            type: 'agent',
            id: mainAgentId,
            name: mainAgentName,
          }
        : null,
      ...Array.from(workflowIds).map((workflowId) => ({
        type: 'workflow',
        id: workflowId,
        name: workflowId,
      })),
      ...Array.from(agentIds)
        .filter((agentId) => agentId !== mainAgentId)
        .map((agentId) => ({
          type: 'agent',
          id: agentId,
          name: agentId,
        })),
    ].filter(Boolean) as Array<{ type: string; id: string; name?: string | null }>;

    return {
      surface: 'assistant' as const,
      title: 'Assistant',
      description: 'Main-agent conversation, approvals, generated artifacts, and handoff context.',
      entities,
      selection: {
        conversationId: conversation?.id ?? null,
        messageId: latestMessage?.id ?? null,
        approvalRequestId: firstPendingApproval?.id ?? null,
        agentId: mainAgentId,
        workflowId: firstWorkflowId,
      },
      summary: {
        conversationTitle: conversation?.title ?? null,
        messageCount: messages.length,
        pendingApprovalCount: pendingApprovals.length,
        approvalCount: approvals.length,
        latestMessageType: latestMessage?.message_type ?? null,
        latestMessageRole: latestMessage?.role ?? null,
        mainAgentName,
        mainAgentLookupAvailable: !mainAgentLookupError,
      },
      allowedActions: [
        ...(mainAgentId ? ['agent.inspect', 'agent.propose_update', 'agent.apply_update'] : []),
        ...(firstWorkflowId
          ? ['workflow.inspect', 'workflow.propose_update', 'workflow.apply_update', 'workflow.run']
          : []),
      ],
    };
  }, [approvals, conversation, mainAgentId, mainAgentLookupError, mainAgentName, messages]);

  useRegisterAssistantPageContext(assistantPageContext);
  return null;
}

function deliveryThreadLabel(provider: string) {
  if (provider === 'discord') {
    return 'Discord channel ID';
  }
  if (provider === 'telegram') {
    return 'Telegram chat ID';
  }
  return 'Thread ID';
}

function deliveryUserLabel(provider: string) {
  if (provider === 'whatsapp') {
    return 'Recipient phone / wa_id';
  }
  if (provider === 'telegram') {
    return 'Telegram user ID';
  }
  if (provider === 'discord') {
    return 'Discord user ID';
  }
  return 'Channel user ID';
}

type ChannelProvider = Conversation['channel_type'];

const channelProviderOptions: Array<{
  value: ChannelProvider;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: 'web', label: 'Web', Icon: Globe2 },
  { value: 'api', label: 'API', Icon: Braces },
  { value: 'telegram', label: 'Telegram', Icon: SendHorizontal },
  { value: 'discord', label: 'Discord', Icon: Hash },
  { value: 'whatsapp', label: 'WhatsApp', Icon: Smartphone },
  { value: 'other', label: 'Other', Icon: Cable },
];

function providerTargetComplete(
  conversation: Conversation | null | undefined,
  provider: ChannelProvider | undefined
) {
  if (!conversation || !provider || conversation.channel_type !== provider) {
    return false;
  }
  if (provider === 'discord' || provider === 'telegram') {
    return Boolean(conversation.channel_thread_id?.trim());
  }
  if (provider === 'whatsapp') {
    return Boolean(conversation.channel_user_id?.trim());
  }
  return Boolean(conversation.channel_thread_id?.trim() || conversation.channel_user_id?.trim());
}

function ChannelTargetDialog({
  conversation,
  isSaving,
  promptReason,
  requestedProvider,
  onDismiss,
  onSave,
}: {
  conversation: Conversation | null;
  isSaving: boolean;
  promptReason: string;
  requestedProvider?: ChannelProvider;
  onDismiss: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const metadata = isRecord(conversation?.metadata) ? conversation.metadata : {};
  const savedGuildId = typeof metadata.guild_id === 'string' ? metadata.guild_id : '';
  const initialProvider =
    requestedProvider && requestedProvider !== 'web' && requestedProvider !== 'api'
      ? requestedProvider
      : conversation?.channel_type && conversation.channel_type !== 'web'
        ? conversation.channel_type
        : 'discord';
  const [provider, setProvider] = useState<ChannelProvider>(initialProvider);
  const [threadId, setThreadId] = useState(conversation?.channel_thread_id ?? '');
  const [userId, setUserId] = useState(conversation?.channel_user_id ?? '');
  const [displayName, setDisplayName] = useState(conversation?.channel_display_name ?? '');
  const [guildId, setGuildId] = useState(savedGuildId);
  const [touched, setTouched] = useState<Set<'thread' | 'user'>>(new Set());

  if (!conversation) {
    return null;
  }

  const availableProviders = requestedProvider
    ? channelProviderOptions.filter((option) => option.value === requestedProvider)
    : channelProviderOptions.filter((option) =>
        ['telegram', 'discord', 'whatsapp'].includes(option.value)
      );
  const threadRequired = provider === 'telegram' || provider === 'discord';
  const userRequired = provider === 'whatsapp';
  const selectedProvider =
    channelProviderOptions.find((option) => option.value === provider) ?? channelProviderOptions[0];
  const SelectedProviderIcon = selectedProvider.Icon;
  const targetChanged =
    provider !== conversation.channel_type ||
    threadId !== (conversation.channel_thread_id ?? '') ||
    userId !== (conversation.channel_user_id ?? '') ||
    displayName !== (conversation.channel_display_name ?? '') ||
    (provider === 'discord' && guildId !== savedGuildId);
  const targetSaveDisabled =
    isSaving || (threadRequired && !threadId.trim()) || (userRequired && !userId.trim());
  const threadError =
    threadRequired && touched.has('thread') && !threadId.trim()
      ? `Enter the ${deliveryThreadLabel(provider).toLowerCase()}.`
      : null;
  const userError =
    userRequired && touched.has('user') && !userId.trim()
      ? `Enter the ${deliveryUserLabel(provider).toLowerCase()}.`
      : null;

  function handleSave() {
    const nextMetadata = { ...metadata };
    // Discord guild routing is provider-specific metadata; clear it when it no longer applies.
    if (provider === 'discord' && guildId.trim()) {
      nextMetadata.guild_id = guildId.trim();
    } else {
      delete nextMetadata.guild_id;
    }

    onSave({
      channel_type: provider,
      channel_thread_id: provider === 'whatsapp' ? null : threadId.trim() || null,
      channel_user_id: userId.trim() || null,
      channel_display_name: displayName.trim() || null,
      metadata: nextMetadata,
    });
  }

  return (
    <AppDialog
      open
      onOpenChange={(open) => (open ? undefined : onDismiss())}
      dirty={targetChanged}
      busy={isSaving}
      size="md"
      icon={<SelectedProviderIcon className="size-4" aria-hidden="true" />}
      title="Channel Target"
      description={promptReason}
      bodyClassName="flex flex-col gap-4"
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>
              Not now
            </Button>
          </DialogClose>
          <Button type="button" disabled={targetSaveDisabled} onClick={handleSave}>
            {isSaving ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" />
            ) : null}
            Save target
          </Button>
        </>
      }
    >
      <FormSection
        title="Delivery provider"
        description="Choose the channel that owns this conversation target."
        icon={<SelectedProviderIcon className="size-4" aria-hidden="true" />}
        contentClassName="flex flex-wrap items-center gap-2"
      >
        {availableProviders.map(({ value, label, Icon }) => {
          const isSelected = value === provider;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setProvider(value)}
              disabled={Boolean(requestedProvider)}
              className={[
                'flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-default',
                isSelected
                  ? 'border-primary-300 bg-primary-50 text-primary-800 shadow-sm shadow-primary/10'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:bg-slate-50 hover:text-slate-950',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
        <Badge variant={targetChanged ? 'default' : 'outline'}>
          {targetChanged ? 'Unsaved edits' : conversation.channel_type}
        </Badge>
      </FormSection>

      <FormSection
        title="Destination"
        description="Provide the provider-specific routing identifiers used to deliver replies."
      >
        <FormFieldGroup columns={2}>
          {provider !== 'whatsapp' ? (
            <FormField
              label={deliveryThreadLabel(provider)}
              htmlFor="conversation-channel-thread"
              error={threadError}
              required={threadRequired}
              optional={!threadRequired}
            >
              <Input
                id="conversation-channel-thread"
                required={threadRequired}
                value={threadId}
                onChange={(event) => setThreadId(event.target.value)}
                onBlur={() => setTouched((current) => new Set(current).add('thread'))}
                placeholder={threadRequired ? 'required' : 'optional'}
                aria-invalid={Boolean(threadError)}
                aria-describedby="conversation-channel-thread-feedback"
              />
            </FormField>
          ) : null}
          <FormField
            label={deliveryUserLabel(provider)}
            htmlFor="conversation-channel-user"
            error={userError}
            required={userRequired}
            optional={!userRequired}
          >
            <Input
              id="conversation-channel-user"
              required={userRequired}
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              onBlur={() => setTouched((current) => new Set(current).add('user'))}
              placeholder={userRequired ? 'required' : 'optional'}
              aria-invalid={Boolean(userError)}
              aria-describedby="conversation-channel-user-feedback"
            />
          </FormField>
          {provider === 'discord' ? (
            <FormField label="Guild ID" htmlFor="conversation-channel-guild" optional>
              <Input
                id="conversation-channel-guild"
                value={guildId}
                onChange={(event) => setGuildId(event.target.value)}
                placeholder="optional"
              />
            </FormField>
          ) : null}
          <FormField
            label="Display name"
            htmlFor="conversation-channel-display"
            description="Friendly label shown in Open Agency; it does not change provider routing."
            optional
          >
            <Input
              id="conversation-channel-display"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="optional"
              aria-describedby="conversation-channel-display-feedback"
            />
          </FormField>
        </FormFieldGroup>
      </FormSection>
    </AppDialog>
  );
}

export default function ConversationWorkspace({
  mode = 'page',
  contextMetadata,
  onOpenFullPage,
}: ConversationWorkspaceProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = session?.user as AuthUser | undefined;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [approvals, setApprovals] = useState<Record<string, ApprovalRequest>>({});
  const [mainAgentName, setMainAgentName] = useState('Main Agent');
  const [mainAgentRole, setMainAgentRole] = useState<string | null>(null);
  const [mainAgentId, setMainAgentId] = useState<string | null>(null);
  const [mainAgentLookupError, setMainAgentLookupError] = useState<string | null>(null);
  const [input, setInput] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (window.localStorage.getItem(DRAFT_INPUT_STORAGE_KEY) ?? '')
  );
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedGoalSummary, setSelectedGoalSummary] = useState<GoalOperatorSummary | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [selectedDocumentMode, setSelectedDocumentMode] = useState<DocumentUploadMode>('context');
  const [error, setError] = useState<string | null>(null);
  const [pendingAsyncTurn, setPendingAsyncTurn] = useState<PendingAsyncTurn | null>(null);
  const [interruptedPendingTurnKey, setInterruptedPendingTurnKey] = useState<string | null>(null);
  const [pendingTurnNow, setPendingTurnNow] = useState(() => Date.now());
  const [turnActivities, setTurnActivities] = useState<Record<string, ConversationTurnActivity>>(
    {}
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [desktopHistoryOpen, setDesktopHistoryOpen] = useState(true);
  const [documentsDrawerOpen, setDocumentsDrawerOpen] = useState(false);
  const [compactPanelOpen, setCompactPanelOpen] = useState(false);
  const [compactForm, setCompactForm] = useState<CompactFormState>(defaultCompactForm);
  const [compactResult, setCompactResult] = useState<ConversationCompactResponse | null>(null);
  const [compactError, setCompactError] = useState<string | null>(null);
  const [compactWorking, setCompactWorking] = useState(false);
  const [dismissedChannelTargetPromptKey, setDismissedChannelTargetPromptKey] = useState<
    string | null
  >(null);
  const [isListening, setIsListening] = useState(false);
  const [checkingPendingTurn, setCheckingPendingTurn] = useState(false);
  const [isPending, startTransition] = useTransition();
  const streamRef = useRef<EventSource | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMessageIdRef = useRef<string | undefined>(undefined);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const activeConversationIdRef = useRef<string | undefined>(undefined);
  const lastContextUsageAlertRef = useRef<string | null>(null);
  const contextScopedConversationIdsRef = useRef<Set<string>>(new Set());
  const suppressedWorkflowAutoOpenRef = useRef<Set<string>>(new Set());
  const initialConversationRestoreRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);

  const actorUserId = user?.id || user?.email || 'web-user';
  const isPopup = mode === 'popup';
  const approvalItems = useMemo(() => Object.values(approvals), [approvals]);
  const generatedFiles = generatedFilesFromMessages(messages);
  const latestConversationMessageId = messages[messages.length - 1]?.id ?? null;
  const pendingMainAgentTurn =
    pendingAsyncTurn &&
    conversation?.id === pendingAsyncTurn.conversationId &&
    !hasAssistantTurnCompletionAfterCursor(
      messages,
      approvalItems,
      pendingAsyncTurn.originMessageId
    )
      ? pendingAsyncTurn
      : null;
  const pendingActivity =
    pendingMainAgentTurn && conversation
      ? latestRunningActivity(conversation.id, turnActivities)
      : null;
  const pendingElapsedMs = pendingMainAgentTurn
    ? Math.max(0, pendingTurnNow - pendingMainAgentTurn.startedAt)
    : 0;
  const pendingIsSlow = Boolean(pendingMainAgentTurn) && pendingElapsedMs >= ASYNC_TURN_SLOW_MS;
  const pendingIsStale = Boolean(pendingMainAgentTurn) && pendingElapsedMs >= ASYNC_TURN_STALE_MS;
  const pendingTurnKey = pendingMainAgentTurn
    ? `${pendingMainAgentTurn.conversationId}:${pendingMainAgentTurn.originMessageId}`
    : null;
  const pendingTurnInterrupted =
    Boolean(pendingTurnKey) && interruptedPendingTurnKey === pendingTurnKey;
  const conversationsQuery = useQuery({
    queryKey: ['backendConversations'],
    queryFn: () => conversationsApi.listConversations(),
  });
  const compactPacksQuery = useQuery({
    queryKey: ['conversationCompactPacks', conversation?.id],
    queryFn: () =>
      conversation
        ? conversationsApi.listCompactPacks(conversation.id, { limit: 20 })
        : Promise.resolve({ items: [] }),
    enabled: Boolean(conversation?.id),
  });
  const contextUsageQuery = useQuery({
    queryKey: ['conversationContextUsage', conversation?.id, latestConversationMessageId],
    queryFn: () =>
      conversation ? conversationsApi.getContextUsage(conversation.id) : Promise.resolve(null),
    enabled: Boolean(conversation?.id),
  });
  const personasQuery = useQuery({
    queryKey: queryKeys.backendPersonas(),
    queryFn: () => personasApi.listPersonas(),
    staleTime: 60 * 1000,
    retry: 1,
  });
  function currentContextMetadata(): JsonObject {
    return contextMetadata?.() ?? {};
  }

  const currentContext = currentContextMetadata();
  const currentAssistantPageTarget = assistantPageTarget(currentContext);
  const contextualPromptSuggestions = assistantContextPromptSuggestions(currentContext);
  const visiblePromptSuggestions =
    contextualPromptSuggestions.length > 0
      ? contextualPromptSuggestions
      : defaultAssistantPromptSuggestions;
  const currentWorkflowContextId = workflowIdFromAssistantMetadata(currentContext);
  const conversationItems = useMemo(
    () =>
      [...(conversationsQuery.data?.items ?? [])].sort(
        (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
      ),
    [conversationsQuery.data?.items]
  );
  const channelTargetPrompt = useMemo(
    () => channelTargetPromptForConversation(conversation?.id, messages, turnActivities),
    [conversation?.id, messages, turnActivities]
  );
  const showChannelTargetPanel = Boolean(
    conversation &&
    channelTargetPrompt &&
    !providerTargetComplete(
      conversation,
      channelTargetPrompt.provider ?? conversation.channel_type
    ) &&
    dismissedChannelTargetPromptKey !== channelTargetPrompt.key &&
    // Workflow-scoped popup chats still need the delivery-target modal so operators can
    // finish the integration handoff without leaving the workflow surface.
    (!isPopup || Boolean(currentWorkflowContextId))
  );
  const channelTargetMutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!conversation) {
        throw new Error('Open a conversation before saving a channel target.');
      }
      return conversationsApi.updateConversation(conversation.id, patch);
    },
    onSuccess: (updated) => {
      setConversation(updated);
      queryClient.setQueryData(['backendConversation', updated.id], updated);
      queryClient.setQueryData(
        ['backendConversations'],
        (current: { items?: Conversation[] } | undefined) => ({
          ...(current ?? {}),
          items: (current?.items ?? []).map((item) => (item.id === updated.id ? updated : item)),
        })
      );
      toast.success('Conversation channel target saved.', { position: 'top-right' });
      if (channelTargetPrompt) {
        setDismissedChannelTargetPromptKey(channelTargetPrompt.key);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to save channel target.', {
        position: 'top-right',
      });
    },
  });
  const invokablePersonas = useMemo(
    () =>
      (personasQuery.data?.items ?? [])
        .filter(isInvokablePersona)
        .sort((left, right) => left.slug.localeCompare(right.slug)),
    [personasQuery.data?.items]
  );
  const personaMentionQuery = trailingPersonaMentionQuery(input);
  const personaAutocompleteOptions = useMemo(() => {
    if (personaMentionQuery === null) {
      return [];
    }
    return invokablePersonas
      .filter((persona) => persona.slug.toLowerCase().startsWith(personaMentionQuery))
      .slice(0, 6);
  }, [invokablePersonas, personaMentionQuery]);
  const [workflowApprovalConversationRef, setWorkflowApprovalConversationRef] = useState<{
    workflowId: string;
    conversationId: string;
  } | null>(null);
  const workflowMetadataConversation = currentWorkflowContextId
    ? (conversationItems.find((item) =>
        workflowIdsFromConversation(item).has(currentWorkflowContextId)
      ) ?? null)
    : null;
  const workflowApprovalConversation =
    currentWorkflowContextId &&
    workflowApprovalConversationRef?.workflowId === currentWorkflowContextId
      ? (conversationItems.find(
          (item) => item.id === workflowApprovalConversationRef.conversationId
        ) ?? null)
      : null;
  const workflowRelatedConversation = workflowMetadataConversation ?? workflowApprovalConversation;

  // Some approvals are created from the assistant page and only carry workflow linkage on the
  // approval record, not the parent conversation metadata. The popup uses this fallback so the
  // workflow page can still surface the human decision queue.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const mainAgent = await conversationsApi.getMainAgent();
        if (cancelled) {
          return;
        }
        setMainAgentLookupError(null);
        setMainAgentId(mainAgent.agent_id);
        setMainAgentName(mainAgent.name?.trim() || 'Main Agent');
        setMainAgentRole(mainAgent.description?.trim() || null);
      } catch (profileError) {
        console.error('Failed to resolve active main agent profile', profileError);
        if (!cancelled) {
          setMainAgentLookupError('Active main-agent details are temporarily unavailable.');
          setMainAgentRole(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingMainAgentTurn, turnActivities]);

  useEffect(() => {
    if (!pendingMainAgentTurn) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      setPendingTurnNow(Date.now());
    }, ASYNC_TURN_TICK_MS);
    return () => window.clearInterval(interval);
  }, [pendingMainAgentTurn]);

  useEffect(() => {
    const usage = contextUsageQuery.data;
    if (
      isPopup ||
      !conversation?.id ||
      !usage?.compact_recommended ||
      usage.usage_percent == null
    ) {
      return;
    }
    const alertKey = `${conversation.id}:${usage.status}:${Math.floor(usage.estimated_context_tokens / 1000)}`;
    if (lastContextUsageAlertRef.current === alertKey) {
      return;
    }
    lastContextUsageAlertRef.current = alertKey;
    const message = `Conversation context is ${usage.usage_percent.toFixed(1)}% full for ${
      usage.model_profile?.model ?? 'the selected model'
    }. Compact this conversation before continuing.`;
    if (usage.status === 'critical' || usage.status === 'overflow') {
      toast.error(message);
    } else {
      toast.warning(message);
    }
  }, [conversation?.id, contextUsageQuery.data, isPopup]);

  useEffect(() => {
    messagesRef.current = messages;
    latestMessageIdRef.current = messages[messages.length - 1]?.id;
  }, [messages]);

  useEffect(() => {
    activeConversationIdRef.current = conversation?.id;
  }, [conversation?.id]);

  useEffect(() => {
    return () => {
      speechRecognitionRef.current?.stop();
      speechRecognitionRef.current = null;
    };
  }, []);

  async function loadConversationThread(conversationId: string) {
    const [storedConversation, storedMessages, storedApprovals] = await Promise.all([
      conversationsApi.getConversation(conversationId),
      conversationsApi.listMessages(conversationId),
      conversationsApi.listApprovalRequests(conversationId),
    ]);

    setConversation(storedConversation);
    activeConversationIdRef.current = storedConversation.id;
    setTurnActivities({});
    const sortedMessages = sortMessages(storedMessages.items);
    const storedApprovalItems = storedApprovals.items;
    setMessages(sortedMessages);
    setPendingAsyncTurn(pendingAsyncTurnFromMessages(sortedMessages, storedApprovalItems));
    setInterruptedPendingTurnKey(null);
    setApprovals(approvalsById(storedApprovalItems));
    setError(null);
  }

  const refreshConversationApprovals = useCallback(async (conversationId: string) => {
    try {
      const storedApprovals = await conversationsApi.listApprovalRequests(conversationId);
      if (activeConversationIdRef.current !== conversationId) {
        return;
      }
      setApprovals(approvalsById(storedApprovals.items));
    } catch (refreshError) {
      console.error('Failed to refresh conversation approvals', refreshError);
    }
  }, []);

  async function refreshConversationMessages(conversationId: string) {
    const [storedMessages, storedApprovals] = await Promise.all([
      conversationsApi.listMessages(conversationId, {
        timeoutMs: 120000,
      }),
      conversationsApi.listApprovalRequests(conversationId),
    ]);
    if (activeConversationIdRef.current !== conversationId) {
      return { messages: storedMessages.items, approvals: storedApprovals.items };
    }
    const sortedMessages = sortMessages(storedMessages.items);
    const nextPendingTurn = pendingAsyncTurnFromMessages(sortedMessages, storedApprovals.items);
    setMessages(sortedMessages);
    setApprovals(approvalsById(storedApprovals.items));
    setPendingAsyncTurn(nextPendingTurn);
    if (!nextPendingTurn) {
      setInterruptedPendingTurnKey(null);
    }
    return { messages: storedMessages.items, approvals: storedApprovals.items };
  }

  async function backfillAsyncConversationMessages(
    conversationId: string,
    originMessageId: string
  ) {
    const delaysMs = [30000, 60000, 120000, 180000];
    for (const delayMs of delaysMs) {
      await sleep(delayMs);
      if (activeConversationIdRef.current !== conversationId) {
        return;
      }
      if (hasTerminalAssistantTurnMessageAfterCursor(messagesRef.current, originMessageId)) {
        return;
      }
      try {
        const snapshot = await refreshConversationMessages(conversationId);
        if (
          hasAssistantTurnCompletionAfterCursor(
            snapshot.messages,
            snapshot.approvals,
            originMessageId
          )
        ) {
          return;
        }
      } catch {
        // The main-agent response may still be occupying the local dev backend. Keep retrying quietly.
      }
    }
  }

  async function checkPendingAsyncTurnNow() {
    if (!pendingMainAgentTurn) {
      return;
    }
    setError(null);
    setCheckingPendingTurn(true);
    try {
      const snapshot = await refreshConversationMessages(pendingMainAgentTurn.conversationId);
      if (
        !hasAssistantTurnCompletionAfterCursor(
          snapshot.messages,
          snapshot.approvals,
          pendingMainAgentTurn.originMessageId
        )
      ) {
        // A dev backend reload can interrupt a tool turn after the tool_call row is saved. A manual
        // check should surface that there is no completed response to recover, not keep spinning.
        setInterruptedPendingTurnKey(
          `${pendingMainAgentTurn.conversationId}:${pendingMainAgentTurn.originMessageId}`
        );
      }
    } catch (refreshError) {
      console.error('Failed to check pending assistant turn', refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Could not check the pending assistant turn.'
      );
    } finally {
      setCheckingPendingTurn(false);
    }
  }

  function handleEndPendingTurn() {
    if (!pendingMainAgentTurn) {
      return;
    }
    // This does not mutate backend state; it only stops treating an orphaned local turn as active
    // so the operator can steer the conversation after a backend interruption or long-running tool.
    setPendingAsyncTurn(null);
    setInterruptedPendingTurnKey(null);
    setCheckingPendingTurn(false);
    window.setTimeout(() => messageInputRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (initialConversationRestoreRef.current) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    initialConversationRestoreRef.current = true;

    window.localStorage.removeItem(DRAFT_INPUT_STORAGE_KEY);

    // Workflow popup chats should resolve from workflow metadata instead of inheriting the
    // globally active assistant thread from another surface.
    if (isPopup && currentWorkflowContextId) {
      return;
    }

    const conversationId = window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY);
    if (!conversationId) {
      return;
    }

    void (async () => {
      try {
        await loadConversationThread(conversationId);
      } catch (loadError) {
        console.error('Failed to restore active conversation', loadError);
        window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
      }
    })();
  }, [currentWorkflowContextId, isPopup]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!conversation?.id) {
      window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, conversation.id);
  }, [conversation?.id]);

  useEffect(() => {
    if (
      !isPopup ||
      !currentWorkflowContextId ||
      conversationsQuery.isLoading ||
      conversationsQuery.isError ||
      workflowMetadataConversation
    ) {
      return;
    }

    let cancelled = false;
    const orderedConversations = [...conversationItems].sort(
      (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
    );

    void (async () => {
      for (const candidate of orderedConversations) {
        try {
          const approvals = await conversationsApi.listApprovalRequests(candidate.id);
          if (cancelled) {
            return;
          }

          if (
            approvals.items.some(
              (approval) =>
                approval.status === 'pending' &&
                workflowIdsFromApproval(approval).has(currentWorkflowContextId)
            )
          ) {
            setWorkflowApprovalConversationRef({
              workflowId: currentWorkflowContextId,
              conversationId: candidate.id,
            });
            return;
          }
        } catch (approvalLookupError) {
          console.error('Failed to inspect conversation approvals', approvalLookupError);
        }
      }

      if (!cancelled) {
        setWorkflowApprovalConversationRef(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    conversationItems,
    conversationsQuery.isError,
    conversationsQuery.isLoading,
    currentWorkflowContextId,
    isPopup,
    workflowMetadataConversation,
  ]);

  const applyStreamEvent = useCallback(
    (payload: ConversationStreamEvent) => {
      if (payload.event_type === 'message.created') {
        setMessages((current) => mergeMessage(current, payload.message));
        setTurnActivities((current) => attachFinalMessageToLatestTurn(current, payload.message));
        if (payload.message.approval_request_id) {
          void refreshConversationApprovals(payload.conversation_id);
        }
        return;
      }
      if (isApprovalStreamEvent(payload)) {
        setApprovals((current) => mergeApproval(current, payload.approval));
        return;
      }
      if (isActivityEvent(payload)) {
        setTurnActivities((current) => mergeActivityEvent(current, payload));
      }
    },
    [refreshConversationApprovals]
  );

  useEffect(() => {
    if (!conversation?.id) {
      return undefined;
    }

    let cancelled = false;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const attachStreamListeners = (stream: EventSource) => {
      stream.onmessage = (event) => {
        try {
          const payload = conversationsApi.parseStreamEvent(event.data);
          applyStreamEvent(payload);
        } catch (streamError) {
          console.error('Failed to parse conversation stream event', streamError);
        }
      };

      stream.addEventListener('message.created', (event) => {
        try {
          const payload = conversationsApi.parseStreamEvent((event as MessageEvent<string>).data);
          applyStreamEvent(payload);
        } catch (streamError) {
          console.error('Failed to parse message.created event', streamError);
        }
      });

      stream.addEventListener('approval.requested', (event) => {
        try {
          const payload = conversationsApi.parseStreamEvent((event as MessageEvent<string>).data);
          applyStreamEvent(payload);
        } catch (streamError) {
          console.error('Failed to parse approval.requested event', streamError);
        }
      });

      stream.addEventListener('approval.resolved', (event) => {
        try {
          const payload = conversationsApi.parseStreamEvent((event as MessageEvent<string>).data);
          applyStreamEvent(payload);
        } catch (streamError) {
          console.error('Failed to parse approval.resolved event', streamError);
        }
      });

      activityEventTypes.forEach((eventType) => {
        if (eventType === 'approval.requested' || eventType === 'approval.resolved') {
          return;
        }
        stream.addEventListener(eventType, (event) => {
          try {
            const payload = conversationsApi.parseStreamEvent((event as MessageEvent<string>).data);
            applyStreamEvent(payload);
          } catch (streamError) {
            console.error(`Failed to parse ${eventType} event`, streamError);
          }
        });
      });
    };

    const connectStream = () => {
      if (cancelled) {
        return;
      }

      const stream = new EventSource(
        conversationsApi.getStreamUrl(conversation.id, latestMessageIdRef.current)
      );
      streamRef.current = stream;
      attachStreamListeners(stream);

      stream.onopen = () => {
        clearReconnectTimeout();
        void refreshConversationApprovals(conversation.id);
      };

      stream.onerror = () => {
        if (cancelled) {
          return;
        }
        stream.close();
        if (streamRef.current === stream) {
          streamRef.current = null;
        }
        clearReconnectTimeout();
        reconnectTimeoutRef.current = setTimeout(() => {
          connectStream();
        }, 1000);
      };
    };

    connectStream();

    return () => {
      cancelled = true;
      clearReconnectTimeout();
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, [applyStreamEvent, conversation?.id, refreshConversationApprovals]);

  async function ensureConversation() {
    if (conversation) {
      return conversation;
    }
    const created = await conversationsApi.createConversation({
      created_by_user_id: actorUserId,
      channel_type: 'web',
      channel_user_id: actorUserId,
      channel_display_name: user?.name || user?.email || 'Web User',
      metadata: {
        surface: 'assistant',
        ...currentContext,
        ...(currentWorkflowContextId ? { workflow_id: currentWorkflowContextId } : {}),
      },
    });
    if (currentWorkflowContextId) {
      contextScopedConversationIdsRef.current.add(created.id);
      suppressedWorkflowAutoOpenRef.current.delete(currentWorkflowContextId);
    }
    setConversation(created);
    activeConversationIdRef.current = created.id;
    void conversationsQuery.refetch();
    return created;
  }

  const handleNewConversation = useCallback(() => {
    if (currentWorkflowContextId) {
      suppressedWorkflowAutoOpenRef.current.add(currentWorkflowContextId);
    }
    setConversation(null);
    activeConversationIdRef.current = undefined;
    setPendingAsyncTurn(null);
    setInterruptedPendingTurnKey(null);
    setTurnActivities({});
    setMessages([]);
    setApprovals({});
    setError(null);
    setCompactResult(null);
    setCompactError(null);
    setHistoryOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
    }
  }, [currentWorkflowContextId]);

  useEffect(() => {
    if (
      !isPopup ||
      !currentWorkflowContextId ||
      conversationsQuery.isLoading ||
      conversationsQuery.isError
    ) {
      return;
    }

    if (!conversation && suppressedWorkflowAutoOpenRef.current.has(currentWorkflowContextId)) {
      return;
    }

    if (
      conversation?.id &&
      (workflowIdsFromConversation(conversation).has(currentWorkflowContextId) ||
        contextScopedConversationIdsRef.current.has(conversation.id))
    ) {
      return;
    }

    if (!workflowRelatedConversation) {
      if (conversation) {
        queueMicrotask(handleNewConversation);
      }
      return;
    }

    queueMicrotask(() => {
      void loadConversationThread(workflowRelatedConversation.id);
    });
  }, [
    conversation,
    conversationsQuery.isError,
    conversationsQuery.isLoading,
    currentWorkflowContextId,
    handleNewConversation,
    isPopup,
    workflowRelatedConversation,
  ]);

  async function handleOpenConversation(conversationId: string) {
    setError(null);
    try {
      await loadConversationThread(conversationId);
      setCompactResult(null);
      setCompactError(null);
      setHistoryOpen(false);
    } catch (loadError) {
      console.error('Failed to load conversation from history', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load conversation.');
    }
  }

  function updateCompactForm(patch: Partial<CompactFormState>) {
    setCompactForm((current) => ({ ...current, ...patch }));
    setCompactError(null);
  }

  function compactPayload(persist: boolean) {
    const tokenBudget = compactTokenBudget(compactForm);
    if (tokenBudget < 100 || tokenBudget > 8000) {
      throw new Error('Token budget must be between 100 and 8000.');
    }
    const recentMessageLimit = Number.parseInt(compactForm.recentMessageLimit, 10);
    if (
      !Number.isFinite(recentMessageLimit) ||
      recentMessageLimit < 0 ||
      recentMessageLimit > 200
    ) {
      throw new Error('Recent raw turns must be between 0 and 200.');
    }
    if (
      compactForm.sourceRange === 'selected' &&
      (!compactForm.sourceMessageStartId || !compactForm.sourceMessageEndId)
    ) {
      throw new Error('Select a start and end message for selected range compaction.');
    }

    return {
      mode: compactForm.mode,
      token_budget: tokenBudget,
      format: 'markdown' as const,
      source_range: compactForm.sourceRange,
      source_message_start_id:
        compactForm.sourceRange === 'selected' ? compactForm.sourceMessageStartId : null,
      source_message_end_id:
        compactForm.sourceRange === 'selected' ? compactForm.sourceMessageEndId : null,
      recent_message_limit: recentMessageLimit,
      scope: 'conversation' as const,
      persist,
      confirmed: compactForm.confirmed,
      supersede_previous: true,
      strategy: compactForm.strategy,
      custom_keep: compactForm.mode === 'custom' ? splitCompactList(compactForm.customKeep) : null,
      custom_drop: compactForm.mode === 'custom' ? splitCompactList(compactForm.customDrop) : null,
    };
  }

  async function runCompactConversation(persist: boolean) {
    if (!conversation?.id) {
      setCompactError('Open or create a conversation before compacting.');
      return;
    }
    setCompactWorking(true);
    setCompactError(null);
    try {
      const result = await conversationsApi.compactConversation(
        conversation.id,
        compactPayload(persist)
      );
      setCompactResult(result);
      if (result.status === 'created' || result.status === 'existing') {
        await compactPacksQuery.refetch();
        await contextUsageQuery.refetch();
        await queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() });
      }
      toast.success(result.status === 'created' ? 'Compact pack saved.' : 'Compact preview ready.');
    } catch (compactRunError) {
      console.error('Failed to compact conversation', compactRunError);
      setCompactError(
        compactRunError instanceof Error
          ? compactRunError.message
          : 'Failed to compact conversation.'
      );
    } finally {
      setCompactWorking(false);
    }
  }

  async function copyCompactContent(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Compact content copied.');
    } catch (copyError) {
      console.error('Failed to copy compact content', copyError);
      setCompactError('Compact content could not be copied.');
    }
  }

  function useCompactContentInNewChat(content: string) {
    handleNewConversation();
    setInput(`Continue from this compact context pack:\n\n${content}`);
    setCompactPanelOpen(false);
  }

  function copyCompactPack(pack: MemoryRecord) {
    void copyCompactContent(pack.content);
  }

  function useCompactPackInNewChat(pack: MemoryRecord) {
    useCompactContentInNewChat(pack.content);
  }

  async function createWorkflowFromCompactPack(pack: MemoryRecord) {
    setCompactWorking(true);
    setCompactError(null);
    try {
      const workflow = await workflowsApi.createWorkflow(workflowFromCompactPack(pack));
      if (!workflow?.id) {
        throw new Error('Workflow create response did not include an ID.');
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() });
      toast.success('Workflow draft created from compact pack.');
      router.push(`/workflows/${workflow.id}`);
    } catch (workflowError) {
      console.error('Failed to create workflow from compact pack', workflowError);
      setCompactError(
        workflowError instanceof Error
          ? workflowError.message
          : 'Failed to create workflow from compact pack.'
      );
    } finally {
      setCompactWorking(false);
    }
  }

  function clearSelectedDocument() {
    setSelectedDocument(null);
    setSelectedDocumentMode('context');
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  }

  function handleDocumentSelected(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedDocument(null);
      setSelectedDocumentMode('context');
      return;
    }
    setSelectedDocument(file);
  }

  function handleVoiceInput() {
    if (isListening) {
      speechRecognitionRef.current?.stop();
      speechRecognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      setError('Voice input is not supported in this browser.');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang =
      typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript?.trim() ?? '')
        .filter(Boolean)
        .join(' ')
        .trim();
      if (transcript) {
        setInput((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript));
      }
    };
    recognition.onerror = (event) => {
      setError(event.error ? `Voice input failed: ${event.error}.` : 'Voice input failed.');
      setIsListening(false);
      speechRecognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsListening(false);
      speechRecognitionRef.current = null;
    };
    speechRecognitionRef.current = recognition;
    setError(null);
    setIsListening(true);
    recognition.start();
  }

  function selectPromptSuggestion(prompt: string) {
    setInput(prompt);
    window.setTimeout(() => messageInputRef.current?.focus(), 0);
  }

  function selectPersonaMention(persona: PersonaDefinition) {
    setInput((current) => {
      if (new RegExp(`(^|\\s)@${persona.slug}(\\s|$)`, 'i').test(current)) {
        return current;
      }
      return replaceTrailingPersonaMention(current, persona.slug);
    });
    window.setTimeout(() => messageInputRef.current?.focus(), 0);
  }

  function selectGoalMention(goal: GoalOperatorSummary | null) {
    setSelectedGoalId(goal?.goal.id ?? null);
    setSelectedGoalSummary(goal);
    if (goal) {
      setInput((current) => replaceTrailingGoalMention(current, goal));
      window.setTimeout(() => messageInputRef.current?.focus(), 0);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    const documentToUpload = selectedDocument;
    const documentUploadMode = selectedDocumentMode;
    if (!trimmed && !documentToUpload) {
      return;
    }

    setError(null);
    setInput('');
    clearSelectedDocument();

    startTransition(() => {
      void (async () => {
        try {
          const targetConversation = await ensureConversation();
          const messageMetadata = currentContextMetadata();
          const personaMentions = personaMentionsFromText(trimmed, invokablePersonas);
          if (personaMentions.length > 0) {
            messageMetadata.persona_mentions = personaMentions;
            messageMetadata.invoked_persona_slug = personaMentions[0].persona_slug;
          }
          if (selectedGoalSummary) {
            messageMetadata.goal_id = selectedGoalSummary.goal.id;
            messageMetadata.goal_objective = selectedGoalSummary.goal.objective;
            messageMetadata.goal_status = selectedGoalSummary.goal.status;
          }
          const goalMentions = goalMentionsFromText(trimmed, selectedGoalSummary);
          if (goalMentions.length > 0) {
            messageMetadata.goal_mentions = goalMentions;
            messageMetadata.invoked_goal_id = selectedGoalSummary?.goal.id;
          }
          if (/(^|\s)@goal(\s|$|:)/i.test(trimmed)) {
            messageMetadata.goal_intent = true;
          }
          let messageTextToSend = trimmed;
          if (documentToUpload) {
            const ingestion = await documentsApi.ingestDocument({
              file: documentToUpload,
              scope: 'conversation',
              conversationId: targetConversation.id,
              agentId: mainAgentId ?? undefined,
              tags: ['chat-upload', 'assistant', `conversation:${targetConversation.id}`],
              autoIntelligence: true,
              allowScopeSuggestion: false,
              allowAgentSuggestion: false,
              purpose: 'conversation',
              uploadMode: documentUploadMode,
            });
            if (documentUploadMode !== 'context') {
              await queryClient.invalidateQueries({ queryKey: queryKeys.backendMemories() });
              setDocumentsDrawerOpen(true);
            }
            if (ingestion.context_attachment_id) {
              messageMetadata.context_attachment_ids = [ingestion.context_attachment_id];
            }
            const documentNote = conversationDocumentNote(ingestion, documentUploadMode);
            messageTextToSend = messageTextToSend
              ? `${messageTextToSend}\n\n${documentNote}`
              : documentNote;
          }
          const response = await conversationsApi.postMessage(targetConversation.id, {
            message: {
              role: 'user',
              message_type: 'user_text',
              plain_text: messageTextToSend,
              content: { text: messageTextToSend },
              metadata: messageMetadata,
            },
            response_mode: 'async',
          });

          setMessages((current) => mergeMessage(current, response.message));
          if (response.assistant_message) {
            setMessages((current) => mergeMessage(current, response.assistant_message!));
            setTurnActivities((current) =>
              attachFinalMessageToLatestTurn(current, response.assistant_message!)
            );
          }
          if (response.execution_result_message) {
            setMessages((current) => mergeMessage(current, response.execution_result_message!));
          }
          if (response.approval_request) {
            setApprovals((current) => mergeApproval(current, response.approval_request!));
          }
          if (!response.assistant_message && response.stream_url) {
            setInterruptedPendingTurnKey(null);
            setPendingAsyncTurn({
              conversationId: targetConversation.id,
              originMessageId: response.message.id,
              startedAt: Date.now(),
              providerLabel: assistantProviderLabel(messageMetadata),
            });
            void backfillAsyncConversationMessages(targetConversation.id, response.message.id);
          }
          const refreshed = await conversationsApi.getConversation(targetConversation.id);
          setConversation(refreshed);
          void conversationsQuery.refetch();
        } catch (submitError) {
          console.error('Failed to send conversation message', submitError);
          setError(submitError instanceof Error ? submitError.message : 'Failed to send message.');
          setInput(trimmed);
          setSelectedDocument(documentToUpload);
          setSelectedDocumentMode(documentUploadMode);
        }
      })();
    });
  }

  async function handleApprovalDecision(approvalRequestId: string, action: 'approve' | 'reject') {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const relatedWorkflowIds = workflowIdsFromApproval(approvals[approvalRequestId]);
          const relatedAgentIds = agentIdsFromApproval(approvals[approvalRequestId]);
          const response =
            action === 'approve'
              ? await conversationsApi.approveApprovalRequest(approvalRequestId, {
                  user_id: actorUserId,
                })
              : await conversationsApi.rejectApprovalRequest(approvalRequestId, {
                  user_id: actorUserId,
                });

          if (response.message) {
            setMessages((current) => mergeMessage(current, response.message));
          }
          const assistantMessage = response.assistant_message;
          if (assistantMessage) {
            setMessages((current) => mergeMessage(current, assistantMessage));
            setTurnActivities((current) =>
              attachFinalMessageToLatestTurn(current, assistantMessage)
            );
          }
          const executionResultMessage = response.execution_result_message;
          if (executionResultMessage) {
            setMessages((current) => mergeMessage(current, executionResultMessage));
          }
          if (response.approval_request) {
            setApprovals((current) => mergeApproval(current, response.approval_request));
            workflowIdsFromApproval(response.approval_request).forEach((workflowId) => {
              relatedWorkflowIds.add(workflowId);
            });
            agentIdsFromApproval(response.approval_request).forEach((agentId) => {
              relatedAgentIds.add(agentId);
            });
          }
          if (relatedWorkflowIds.size > 0) {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
              ...Array.from(relatedWorkflowIds).flatMap((workflowId) => [
                queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
                queryClient.invalidateQueries({
                  queryKey: queryKeys.backendWorkflowMonitoringEvents(workflowId),
                }),
                queryClient.invalidateQueries({
                  queryKey: queryKeys.backendWorkflowRuntimeGovernance(workflowId),
                }),
                queryClient.invalidateQueries({
                  queryKey: queryKeys.backendWorkflowSharedMemory(workflowId),
                }),
              ]),
            ]);
          }
          if (relatedAgentIds.size > 0) {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: queryKeys.backendAgents() }),
              queryClient.invalidateQueries({ queryKey: queryKeys.backendAgentDefinitions() }),
              queryClient.invalidateQueries({ queryKey: queryKeys.backendAgentCatalog() }),
              queryClient.invalidateQueries({ queryKey: queryKeys.backendMainAgent() }),
              ...Array.from(relatedAgentIds).map((agentId) =>
                queryClient.invalidateQueries({
                  queryKey: queryKeys.backendAgentObservabilityMetrics(agentId),
                })
              ),
            ]);
          }
        } catch (decisionError) {
          console.error(`Failed to ${action} approval`, decisionError);
          setError(
            decisionError instanceof Error ? decisionError.message : `Failed to ${action} approval.`
          );
        }
      })();
    });
  }

  const historyPanel = (
    <div
      className={`relative flex h-full min-h-0 flex-col border-slate-200 bg-white transition-opacity duration-300 dark:border-white/10 dark:bg-slate-950/60 ${
        desktopHistoryOpen ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={`absolute top-1/2 right-0 z-10 hidden h-10 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-r-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-300 hover:text-slate-900 dark:border-cyan-400/15 dark:bg-slate-950/95 dark:text-slate-500 dark:shadow-none dark:hover:bg-slate-900 dark:hover:text-slate-100 md:flex ${
                desktopHistoryOpen
                  ? 'pointer-events-auto opacity-100'
                  : 'pointer-events-none opacity-0'
              }`}
              onClick={() => setDesktopHistoryOpen(false)}
              aria-label="Minimize history sidebar"
              title="Minimize history sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Minimize history sidebar</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="border-b border-slate-200 px-4 py-4 dark:border-cyan-400/10 dark:bg-white/2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Conversation history
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
              Recent threads and agent context
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="dark:border-cyan-400/15 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            aria-label="New conversation"
            onClick={handleNewConversation}
          >
            New Chat
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {conversationsQuery.isLoading ? (
          <p className="px-2 text-sm text-slate-500 dark:text-slate-400">Loading history...</p>
        ) : conversationsQuery.isError ? (
          <p className="px-2 text-sm text-red-600">Conversation history could not be loaded.</p>
        ) : conversationItems.length === 0 ? (
          <p className="px-2 text-sm text-slate-500 dark:text-slate-400">
            No saved conversations yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/30">
            {conversationItems.map((item) => {
              const isActive = item.id === conversation?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={conversationDisplayTitle(item)}
                  className={`w-full border-b border-slate-200 px-3 py-3 text-left transition last:border-b-0 dark:border-white/10 ${
                    isActive
                      ? 'bg-primary-50 shadow-[inset_3px_0_0_var(--color-primary-500)] dark:bg-primary-500/10'
                      : 'bg-white hover:bg-slate-50 dark:bg-transparent dark:hover:bg-white/5'
                  }`}
                  onClick={() => void handleOpenConversation(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {conversationDisplayTitle(item)}
                    </p>
                    {isActive ? (
                      <Badge
                        variant="outline"
                        className="dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-100"
                      >
                        Open
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {formatConversationTimestamp(item.updated_at)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const conversationShell = (
    <>
      <div
        className={
          isPopup
            ? 'border-b border-primary-100 bg-white px-5 py-4 dark:border-white/10 dark:bg-slate-950'
            : 'border-b border-primary-100 bg-white/95 px-5 py-4 shadow-sm shadow-primary/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/95 dark:shadow-none'
        }
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-md shadow-primary/20">
              <Bot className="h-6 w-6" />
              <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-slate-950 dark:text-slate-100">
                  {mainAgentName} Chat
                </h1>
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  Online
                </Badge>
              </div>
              <p className="sr-only">Chat with {mainAgentName}.</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                <span className="max-w-xs truncate">
                  {mainAgentRole || 'Conversational orchestrator'}
                </span>
                <span className="hidden text-slate-300 sm:inline">/</span>
                <span className="max-w-88 truncate">
                  {conversation ? conversationDisplayTitle(conversation) : 'New conversation'}
                </span>
                {!conversation ? (
                  <span className="sr-only">Conversation will be created on first message</span>
                ) : null}
              </div>
              {isPopup && currentAssistantPageTarget ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                    Context: {currentAssistantPageTarget.label}
                  </Badge>
                </div>
              ) : null}
              {mainAgentLookupError ? (
                <p className="mt-2 text-sm text-amber-700">{mainAgentLookupError}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:shrink-0 lg:items-end">
            <div className="flex flex-wrap gap-2 sm:flex-nowrap lg:justify-end">
              {!isPopup ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="md:hidden"
                    onClick={() => setHistoryOpen((current) => !current)}
                  >
                    {historyOpen ? 'Hide history' : 'View history'}
                  </Button>
                  {conversation ? (
                    <ConversationContextUsageMeter
                      usage={contextUsageQuery.data}
                      loading={contextUsageQuery.isLoading || contextUsageQuery.isFetching}
                      onCompact={() => setCompactPanelOpen(true)}
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCompactPanelOpen((current) => !current)}
                    aria-expanded={compactPanelOpen}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Compact
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDocumentsDrawerOpen((current) => !current)}
                    aria-expanded={documentsDrawerOpen}
                    aria-controls="conversation-files-drawer"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Files
                  </Button>
                </>
              ) : null}
              {isPopup ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="New conversation"
                    onClick={handleNewConversation}
                  >
                    New Chat
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={onOpenFullPage}>
                    Open full page
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
        {!isPopup && historyOpen ? (
          <div className="mt-4 border-t border-primary-100 pt-4 md:hidden">{historyPanel}</div>
        ) : null}
      </div>

      {!isPopup && compactPanelOpen ? (
        <ConversationCompactPanel
          conversation={conversation}
          messages={messages}
          compactPacks={compactPacksQuery.data?.items ?? []}
          compactPacksLoading={compactPacksQuery.isLoading}
          form={compactForm}
          compactResult={compactResult}
          compactError={compactError}
          compactWorking={compactWorking}
          onFormChange={updateCompactForm}
          onPreview={() => void runCompactConversation(false)}
          onSave={() => void runCompactConversation(true)}
          onCopyContent={(content) => void copyCompactContent(content)}
          onUseContentInNewChat={useCompactContentInNewChat}
          onCopyPack={copyCompactPack}
          onUsePackInNewChat={useCompactPackInNewChat}
          onCreateWorkflowFromPack={(pack) => void createWorkflowFromCompactPack(pack)}
          onRefreshPacks={() => void compactPacksQuery.refetch()}
          onClose={() => setCompactPanelOpen(false)}
        />
      ) : null}

      {showChannelTargetPanel && channelTargetPrompt ? (
        <ChannelTargetDialog
          key={`${conversation?.id ?? 'none'}:${conversation?.updated_at ?? ''}:${conversation?.channel_type ?? ''}`}
          conversation={conversation}
          isSaving={channelTargetMutation.isPending}
          promptReason={channelTargetPrompt.reason}
          requestedProvider={channelTargetPrompt.provider}
          onDismiss={() => setDismissedChannelTargetPromptKey(channelTargetPrompt.key)}
          onSave={(patch) => channelTargetMutation.mutate(patch)}
        />
      ) : null}

      <PendingApprovalsPanel
        approvals={approvalItems}
        mainAgentName={mainAgentName}
        isPending={isPending}
        isPopup={isPopup}
        onDecision={handleApprovalDecision}
      />

      <div
        className={
          isPopup
            ? 'min-h-0 flex-1 overflow-y-auto bg-white px-4 py-6 dark:bg-slate-950'
            : 'flex-1 overflow-y-auto bg-slate-50/70 px-4 py-6 dark:bg-slate-950/45'
        }
      >
        {messages.length === 0 ? (
          <AssistantEmptyState
            mainAgentName={mainAgentName}
            contextLabel={isPopup ? currentAssistantPageTarget?.label : undefined}
            suggestions={visiblePromptSuggestions}
            onSelectPrompt={selectPromptSuggestion}
          />
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.map((message, index) => {
              const approval = message.approval_request_id
                ? approvals[message.approval_request_id]
                : undefined;
              const messageActivity = activityForMessage(message, turnActivities);
              const personaAttribution = personaAttributionLabel(message);
              return (
                <div key={message.id} className="space-y-2">
                  {messageActivity ? (
                    <ConversationActivityPanel
                      activity={messageActivity}
                      mainAgentName={mainAgentName}
                    />
                  ) : null}
                  <div
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={[
                        'w-full rounded-3xl px-4 py-3',
                        transcriptWidthClasses(message),
                        messageShellClasses(message),
                        index === messages.length - 1 ? 'ring-1 ring-slate-200/70' : '',
                      ].join(' ')}
                    >
                      <div
                        className={`mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] ${metadataToneClasses(message)}`}
                      >
                        <span>{messageTypeLabel(message, mainAgentName)}</span>
                        <span>{formatTimestamp(message.created_at)}</span>
                      </div>
                      {personaAttribution ? (
                        <Badge
                          variant="outline"
                          className="mb-2 border-primary-200 bg-primary-50 text-primary-800"
                        >
                          {personaAttribution}
                        </Badge>
                      ) : null}
                      {message.role === 'assistant' ? (
                        <div
                          className={[
                            'mb-3 h-px w-full',
                            message.message_type === 'approval_result'
                              ? 'bg-linear-to-r from-emerald-300 via-emerald-200/70 to-transparent dark:from-emerald-300/90 dark:via-emerald-200/55'
                              : message.message_type === 'approval_request'
                                ? 'bg-linear-to-r from-amber-300 via-amber-200/70 to-transparent dark:from-amber-300/90 dark:via-amber-200/55'
                                : 'bg-linear-to-r from-sky-200 via-primary-200/60 to-transparent dark:from-cyan-300/70 dark:via-violet-300/35',
                          ].join(' ')}
                        />
                      ) : null}
                      <div
                        data-testid="message-body"
                        className={[
                          'max-w-none wrap-break-word whitespace-pre-wrap',
                          messageBodyToneClasses(message),
                          messageBodyScrollClasses(message),
                        ].join(' ')}
                        style={{ tabSize: 8 }}
                      >
                        <AssistantMarkdown>{messageText(message)}</AssistantMarkdown>
                      </div>
                    </div>
                  </div>
                  {message.message_type === 'workflow_proposal' ||
                  message.message_type === 'workflow_update_proposal' ? (
                    <WorkflowProposalCard
                      message={message}
                      approval={approval}
                      isPending={isPending}
                      onDecision={handleApprovalDecision}
                    />
                  ) : null}
                  {approval &&
                  message.message_type !== 'workflow_proposal' &&
                  message.message_type !== 'workflow_update_proposal' ? (
                    <GenericApprovalCard
                      approval={approval}
                      alignRight={message.role === 'user'}
                      isPending={isPending}
                      onDecision={handleApprovalDecision}
                    />
                  ) : null}
                  {message.message_type === 'execution_started' ||
                  message.message_type === 'execution_completed' ? (
                    <ExecutionStatusCard message={message} />
                  ) : null}
                  {message.message_type === 'tool_call' ? (
                    <ToolCallCard
                      message={message}
                      messages={messages}
                      approvals={approvalItems}
                      pendingMainAgentTurn={pendingMainAgentTurn}
                      pendingIsStale={pendingIsStale}
                      pendingTurnInterrupted={pendingTurnInterrupted}
                      checkingPendingTurn={checkingPendingTurn}
                      onCheckPendingTurn={() => void checkPendingAsyncTurnNow()}
                      onEndPendingTurn={handleEndPendingTurn}
                    />
                  ) : null}
                  {message.message_type === 'tool_result' ? (
                    <ToolResultCard message={message} />
                  ) : null}
                </div>
              );
            })}
            {pendingMainAgentTurn ? (
              <div className="flex justify-start">
                <div
                  className={[
                    'w-full max-w-[min(82%,48rem)] rounded-2xl px-4 py-3 text-sm shadow-sm',
                    pendingTurnInterrupted || pendingIsStale
                      ? 'border border-amber-200 bg-amber-50 text-amber-950'
                      : 'border border-sky-100 bg-sky-50 text-sky-900',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    {pendingTurnInterrupted || pendingIsStale ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                    ) : (
                      <LoaderCircle className="mt-0.5 h-4 w-4 animate-spin text-sky-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{mainAgentName} is working</span>
                        <Badge variant="outline">{formatElapsedDuration(pendingElapsedMs)}</Badge>
                      </div>
                      <div
                        className={[
                          'mt-1 text-xs leading-5',
                          pendingTurnInterrupted || pendingIsStale
                            ? 'text-amber-800'
                            : 'text-sky-700',
                        ].join(' ')}
                      >
                        {pendingMainAgentTurn.providerLabel ? (
                          <span>Using {pendingMainAgentTurn.providerLabel}. </span>
                        ) : null}
                        {pendingTurnInterrupted
                          ? 'No completed response was found after checking the backend. The turn was likely interrupted during a backend restart; send the request again to continue.'
                          : pendingIsStale
                            ? 'This turn is taking longer than expected. The app is still checking for the result in the background.'
                            : pendingIsSlow
                              ? 'Still waiting on the model or tool provider; long agent turns can take several minutes.'
                              : 'Waiting on the model or tool provider; the response will appear here when it is ready.'}
                      </div>
                      {pendingIsStale ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="relative z-10 gap-2"
                            disabled={checkingPendingTurn}
                            onClick={() => void checkPendingAsyncTurnNow()}
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${checkingPendingTurn ? 'animate-spin' : ''}`}
                            />
                            {checkingPendingTurn
                              ? 'Checking...'
                              : pendingTurnInterrupted
                                ? 'Check again'
                                : 'Check now'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="relative z-10 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                            onClick={handleEndPendingTurn}
                          >
                            End turn
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {pendingActivity ? (
              <ConversationActivityPanel
                activity={pendingActivity}
                mainAgentName={mainAgentName}
                live
              />
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className={
          isPopup
            ? 'border-t border-primary-100 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-950'
            : 'border-t border-primary-100 bg-white/95 px-4 py-3 shadow-sm shadow-primary/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/95 dark:shadow-none'
        }
      >
        <div className="mx-auto max-w-4xl">
          {isPopup && messages.length > 0 && contextualPromptSuggestions.length > 0 ? (
            <div
              className="mb-3 flex flex-col gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2.5 dark:border-cyan-400/15 dark:bg-cyan-400/5 sm:flex-row sm:items-center"
              aria-label="Context suggestions"
            >
              <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-sky-800 dark:text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Suggested here
              </div>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {contextualPromptSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-medium text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-cyan-300/20 dark:bg-slate-950/70 dark:text-cyan-100 dark:hover:bg-cyan-300/10"
                    onClick={() => selectPromptSuggestion(suggestion.prompt)}
                    aria-label={`Use suggestion: ${suggestion.label}`}
                    title={suggestion.prompt}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          {pendingIsStale ? (
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {pendingTurnInterrupted
                  ? 'No completed assistant response was found for the last turn.'
                  : 'The assistant turn is still pending. End it to send a steering message now.'}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                  disabled={checkingPendingTurn}
                  onClick={() => void checkPendingAsyncTurnNow()}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${checkingPendingTurn ? 'animate-spin' : ''}`}
                  />
                  {checkingPendingTurn
                    ? 'Checking...'
                    : pendingTurnInterrupted
                      ? 'Check again'
                      : 'Check now'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                  onClick={handleEndPendingTurn}
                >
                  End turn
                </Button>
              </div>
            </div>
          ) : null}
          {selectedGoalSummary ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <Badge variant="outline" className="border-emerald-300 bg-white/80 text-emerald-700">
                Goal
              </Badge>
              <span className="min-w-0 max-w-full truncate font-medium">
                {selectedGoalSummary.goal.objective}
              </span>
              <Badge variant="outline" className="border-emerald-200 bg-white/70 text-emerald-700">
                {selectedGoalSummary.autonomy}
              </Badge>
              <span className="shrink-0 text-emerald-600">
                @goal:{goalMentionHandle(selectedGoalSummary)}
              </span>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="ml-auto rounded-full p-1 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-950"
                      onClick={() => selectGoalMention(null)}
                      aria-label="Clear selected goal"
                      title="Clear selected goal"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Clear selected goal</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : null}
          {personaAutocompleteOptions.length > 0 ? (
            <div className="mb-3 rounded-xl border border-primary-100 bg-white p-2 shadow-sm shadow-primary/5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Match persona
              </div>
              <div className="flex flex-wrap gap-2">
                {personaAutocompleteOptions.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-900 transition hover:border-primary-300 hover:bg-primary-100"
                    onClick={() => selectPersonaMention(persona)}
                  >
                    Use @{persona.slug}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {selectedDocument ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="min-w-0 truncate font-medium text-slate-900">
                {selectedDocument.name}
              </span>
              <span className="shrink-0 text-slate-500">
                {formatFileSize(selectedDocument.size)}
              </span>
              <div className="flex flex-wrap gap-1">
                {conversationUploadModes.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
                      selectedDocumentMode === mode.value
                        ? 'border-primary-300 bg-primary-50 text-primary-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200'
                    }`}
                    onClick={() => setSelectedDocumentMode(mode.value)}
                    title={mode.label}
                    aria-pressed={selectedDocumentMode === mode.value}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="ml-auto rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                      onClick={clearSelectedDocument}
                      aria-label="Remove selected document"
                      title="Remove document"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Remove document</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : null}
          <div className="flex items-center gap-2 rounded-2xl border border-primary-100 bg-white px-2 py-2 shadow-sm shadow-primary/5 focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary/10 dark:border-white/10 dark:bg-slate-950 dark:shadow-none dark:focus-within:border-cyan-400/24">
            <input
              ref={documentInputRef}
              type="file"
              accept={DOCUMENT_UPLOAD_ACCEPT}
              className="hidden"
              onChange={handleDocumentSelected}
            />
            <AssistantContextMenu
              selectedGoalId={selectedGoalId}
              selectedGoalSummary={selectedGoalSummary}
              personas={invokablePersonas}
              personasLoading={personasQuery.isLoading}
              personasError={personasQuery.isError}
              disabled={isPending}
              onGoalSelect={selectGoalMention}
              onPersonaSelect={selectPersonaMention}
            />
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-10 shrink-0 rounded-xl p-0"
                    disabled={isPending}
                    onClick={handleVoiceInput}
                    aria-label={isListening ? 'Stop speech input' : 'Start speech input'}
                    title={isListening ? 'Stop speech input' : 'Start speech input'}
                  >
                    <Mic className={`h-4 w-4 ${isListening ? 'text-primary-600' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isListening ? 'Stop speech input' : 'Start speech input'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-10 shrink-0 rounded-xl p-0"
                    disabled={isPending}
                    onClick={() => documentInputRef.current?.click()}
                    aria-label="Attach document"
                    title="Attach document"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach document</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
              <MessageSquareText className="hidden h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 sm:block" />
              <div className="relative min-w-0 flex-1">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-1 top-1/2 z-0 min-w-0 -translate-y-1/2 overflow-hidden whitespace-pre text-sm text-slate-900 dark:text-slate-100"
                >
                  {renderMentionHighlights(input, invokablePersonas, selectedGoalSummary)}
                </div>
                <input
                  ref={messageInputRef}
                  className="relative z-10 min-w-0 w-full border-0 bg-transparent px-1 py-2 text-sm text-transparent caret-slate-900 outline-none placeholder:text-slate-400 selection:bg-primary/20 dark:caret-slate-100 dark:placeholder:text-slate-500"
                  value={input}
                  placeholder={`Message ${mainAgentName}`}
                  aria-label={`Message ${mainAgentName}`}
                  onChange={(event) => setInput(event.target.value)}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="h-10 shrink-0 rounded-xl px-3 text-white sm:px-4"
              disabled={isPending || (input.trim().length === 0 && !selectedDocument)}
            >
              <SendHorizontal className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">
                {isPending ? (selectedDocument ? 'Uploading' : 'Sending') : 'Send'}
              </span>
            </Button>
          </div>
        </div>
      </form>
    </>
  );

  if (isPopup) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-950">
        {conversationShell}
      </div>
    );
  }

  return (
    <>
      <ConversationPageContextRegistrar
        conversation={conversation}
        messages={messages}
        approvals={approvalItems}
        mainAgentId={mainAgentId}
        mainAgentName={mainAgentName}
        mainAgentLookupError={mainAgentLookupError}
      />
      <div className="flex h-[calc(100dvh-72px)] min-h-0 bg-transparent md:h-[calc(100vh-134px)]">
        <aside
          className={`relative hidden shrink-0 overflow-visible border-r border-primary-100 bg-primary-50/60 transition-[width,border-color] duration-300 ease-out md:block ${
            desktopHistoryOpen ? 'w-80' : 'w-0 border-r-transparent'
          }`}
          aria-hidden={!desktopHistoryOpen}
        >
          <div
            className={`h-full transition-transform duration-300 ease-out ${
              desktopHistoryOpen ? 'translate-x-0' : '-translate-x-6'
            }`}
          >
            {historyPanel}
          </div>
        </aside>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`hidden self-center rounded-r-full border border-primary-100 bg-white px-1.5 py-3 text-slate-500 shadow-sm shadow-primary/5 transition-all duration-300 hover:text-primary-900 dark:border-white/10 dark:bg-slate-950 dark:text-slate-400 dark:shadow-none dark:hover:text-slate-100 md:block ${
                  desktopHistoryOpen
                    ? 'pointer-events-none -ml-6 opacity-0'
                    : 'pointer-events-auto ml-0 opacity-100'
                }`}
                onClick={() => setDesktopHistoryOpen(true)}
                aria-label="Open history sidebar"
                title="Open history sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Open history sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex min-w-0 flex-1 flex-col">{conversationShell}</div>
        <aside
          id="conversation-files-drawer"
          className={`relative hidden shrink-0 overflow-hidden border-l border-primary-100 bg-white transition-[width,border-color] duration-300 ease-out md:block ${
            documentsDrawerOpen ? 'w-96' : 'w-0 border-l-transparent'
          }`}
          aria-hidden={!documentsDrawerOpen}
        >
          <div
            className={`h-full w-96 transition-transform duration-300 ease-out ${
              documentsDrawerOpen ? 'translate-x-0' : 'translate-x-6'
            }`}
          >
            <ConversationDocumentsDrawer
              conversation={conversation}
              generatedFiles={generatedFiles}
              onClose={() => setDocumentsDrawerOpen(false)}
            />
          </div>
        </aside>
        {documentsDrawerOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-950/30 md:hidden">
            <button
              type="button"
              className="absolute inset-0 h-full w-full cursor-default"
              aria-label="Close conversation files"
              onClick={() => setDocumentsDrawerOpen(false)}
            />
            <aside className="absolute right-0 top-0 h-full w-[min(92vw,24rem)] shadow-2xl">
              <ConversationDocumentsDrawer
                conversation={conversation}
                generatedFiles={generatedFiles}
                onClose={() => setDocumentsDrawerOpen(false)}
              />
            </aside>
          </div>
        ) : null}
      </div>
    </>
  );
}
