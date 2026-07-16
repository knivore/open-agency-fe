'use client';

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { behaviorProfilesApi } from '@/lib/api/backend/behaviorProfiles';
import { modelProfilesApi, modelProvidersApi } from '@/lib/api/backend/models';
import type { ModelProviderModelOption, ProviderAuthorizeResponse } from '@/lib/api/backend/models';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { BehaviorTuningProfile } from '@/types/agents';
import type {
  ModelFallbackRetryReason,
  ModelFallbackStrategy,
  ModelProviderDefinition,
} from '@/types/integrations';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import { DialogClose } from '../library/shadcn/dialog';
import { AppDialog } from '@/components/app-shell/AppOverlay';
import {
  FieldFeedback,
  FormField,
  FormFieldGroup,
  FormSection,
} from '@/components/app-shell/FormSection';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';
import { Toggle } from '../library/shadcn/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../library/shadcn/tooltip';
import {
  ArrowDown,
  ArrowUp,
  BrainCog,
  Copy,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import { useRegisterAssistantPageContext } from '@/components/assistant/AssistantPageContext';
import PageHeader from '@/components/app-shell/PageHeader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const OPENAI_CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const OPENAI_CODEX_REDIRECT_URI = 'http://localhost:1455/auth/callback';
const AGENCY_OAUTH_CALLBACK_MESSAGE_TYPE = 'agency-oauth-callback';
const MAX_FALLBACK_MODELS = 5;
const FALLBACK_RETRY_REASONS: ModelFallbackRetryReason[] = [
  'rate_limit',
  'timeout',
  'service_unavailable',
  'network',
  'auth',
];
const FALLBACK_RETRY_REASON_LABELS: Record<ModelFallbackRetryReason, string> = {
  rate_limit: 'Rate limit',
  timeout: 'Timeout',
  service_unavailable: 'Service unavailable',
  network: 'Network',
  auth: 'Auth',
};
const FALLBACK_RETRY_REASON_TITLES: Record<ModelFallbackRetryReason, string> = {
  rate_limit: 'Switch when the provider reports quota or rate-limit pressure.',
  timeout: 'Switch when the model request times out.',
  service_unavailable: 'Switch on temporary provider outages or overloaded service responses.',
  network: 'Switch on connection or transport failures.',
  auth: 'Switch on access failures such as unauthorized or forbidden responses.',
};
const DEFAULT_FALLBACK_POLICY: ProfileFallbackPolicyForm = {
  retryOn: FALLBACK_RETRY_REASONS,
  sameProviderOnly: false,
  requireCapabilityMatch: true,
};

type RuntimeTuningField = 'temperature' | 'maxTokens' | 'topP';
type RuntimeTuningValues = Pick<CreateLlmModelState, RuntimeTuningField>;
type RuntimeTuningErrors = Partial<Record<RuntimeTuningField, string>>;

const RUNTIME_TUNING_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  values: RuntimeTuningValues;
}> = [
  {
    id: 'provider-default',
    label: 'Provider default',
    description:
      'Let the provider choose sampling and response length. Safest across model families.',
    values: { temperature: '', maxTokens: '', topP: '' },
  },
  {
    id: 'precise',
    label: 'Precise',
    description: 'More consistent output for extraction, planning, and tool-heavy work.',
    values: { temperature: '0.2', maxTokens: '2048', topP: '0.9' },
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'A practical mix of consistency and variety for general assistant work.',
    values: { temperature: '0.5', maxTokens: '4096', topP: '1' },
  },
  {
    id: 'creative',
    label: 'Creative',
    description: 'More variation for ideation and drafting, with a controlled response limit.',
    values: { temperature: '0.9', maxTokens: '4096', topP: '1' },
  },
];

type AgencyOAuthCallbackMessage = {
  type: typeof AGENCY_OAUTH_CALLBACK_MESSAGE_TYPE;
  redirectUrl: string;
};

function isLoopbackCallbackOrigin(origin: string, redirectUri?: string) {
  try {
    const originUrl = new URL(origin);
    if (redirectUri) {
      const redirectOrigin = new URL(redirectUri).origin;
      if (originUrl.origin === redirectOrigin) {
        return true;
      }
    }
    return (
      (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') &&
      originUrl.port === '1455'
    );
  } catch {
    return false;
  }
}

function oauthCallbackRedirectUrlFromMessage(
  event: MessageEvent,
  authData: ProviderAuthorizeResponse
) {
  if (!isLoopbackCallbackOrigin(event.origin, authData.redirect_uri)) {
    return null;
  }
  if (!isRecord(event.data)) {
    return null;
  }
  const message = event.data as Partial<AgencyOAuthCallbackMessage>;
  if (
    message.type !== AGENCY_OAUTH_CALLBACK_MESSAGE_TYPE ||
    typeof message.redirectUrl !== 'string'
  ) {
    return null;
  }
  try {
    const redirectUrl = new URL(message.redirectUrl);
    if (redirectUrl.searchParams.get('state') !== authData.state) {
      return null;
    }
    return message.redirectUrl;
  } catch {
    return null;
  }
}

type ProfileFormState = {
  name: string;
  description: string;
  provider: string;
  model: string;
  temperature: string;
  maxTokens: string;
  topP: string;
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  oauthProfileId: string;
  fallbackStrategy: ModelFallbackStrategy;
  fallbackModels: ProfileFallbackFormTarget[];
  fallbackPolicy: ProfileFallbackPolicyForm;
};

type ProfileFallbackFormTarget = {
  provider: string;
  model: string;
};

type ProfileFallbackPolicyForm = {
  retryOn: ModelFallbackRetryReason[];
  sameProviderOnly: boolean;
  requireCapabilityMatch: boolean;
};

type ProviderFamily =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'openai_compatible'
  | 'huggingface'
  | 'xai'
  | 'deepseek'
  | 'qwen'
  | 'openai_codex'
  | 'azure_openai';

type ProviderFormState = {
  family: ProviderFamily;
  name: string;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  clientId?: string;
  tenantId?: string;
  redirectUri?: string;
  authProfileId?: string;
};

type ProviderEditFormState = ProviderFormState & {
  description: string;
};

type ProviderPresetDefaultProfile = {
  name: string;
  description: string;
  temperature: string;
  maxTokens: string;
  topP: string;
};

type ProviderPreset = {
  label: string;
  providerType: string;
  defaultName: string;
  defaultBaseUrl: string;
  modelHint: string;
  modelOptions: ModelProviderModelOption[];
  requiresApiKey: boolean;
  requiresOAuth?: boolean;
  defaultProfile?: ProviderPresetDefaultProfile;
};

type CreateLlmModelState = {
  mode: 'existing' | 'new';
  provider: ProviderFormState;
  selectedProviderId: string;
  profileName: string;
  profileDescription: string;
  model: string;
  temperature: string;
  maxTokens: string;
  topP: string;
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  oauthProfileId: string;
  fallbackStrategy: ModelFallbackStrategy;
  fallbackModels: ProfileFallbackFormTarget[];
  fallbackPolicy: ProfileFallbackPolicyForm;
};

const PROVIDER_PRESETS: Record<ProviderFamily, ProviderPreset> = {
  openai: {
    label: 'OpenAI',
    providerType: 'openai',
    defaultName: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    modelHint: 'gpt-5.5',
    modelOptions: [
      { id: 'gpt-5.5', name: 'GPT-5.5' },
      { id: 'gpt-5.5-pro', name: 'GPT-5.5 Pro' },
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini' },
      { id: 'gpt-5.4-nano', name: 'GPT-5.4 nano' },
      { id: 'gpt-5-mini', name: 'GPT-5 mini' },
      { id: 'gpt-5-nano', name: 'GPT-5 nano' },
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
    ],
    requiresApiKey: true,
  },
  anthropic: {
    label: 'Anthropic Claude',
    providerType: 'anthropic',
    defaultName: 'Anthropic',
    defaultBaseUrl: '',
    modelHint: 'claude-opus-4-7',
    modelOptions: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4-1', name: 'Claude Opus 4.1' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
    ],
    requiresApiKey: true,
  },
  google: {
    label: 'Google Gemini',
    providerType: 'google',
    defaultName: 'Google Gemini',
    defaultBaseUrl: '',
    modelHint: 'gemini-3.1-pro-preview',
    modelOptions: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
      { id: 'gemini-3.1-pro-preview-customtools', name: 'Gemini 3.1 Pro Preview Custom Tools' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
    ],
    requiresApiKey: true,
  },
  ollama: {
    label: 'Ollama',
    providerType: 'ollama',
    defaultName: 'Ollama Local',
    defaultBaseUrl: 'http://host.docker.internal:11434',
    modelHint: 'llama3:8b',
    modelOptions: [
      { id: 'llama3:8b', name: 'Llama 3 8B' },
      { id: 'qwen3:30b', name: 'Qwen3 30B' },
      { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B' },
    ],
    requiresApiKey: false,
  },
  openai_compatible: {
    label: 'OpenAI-compatible',
    providerType: 'openai_compatible',
    defaultName: 'OpenAI-compatible Gateway',
    defaultBaseUrl: 'http://localhost:8001/v1',
    modelHint: 'model-id',
    modelOptions: [{ id: 'model-id', name: 'Custom model ID' }],
    requiresApiKey: false,
  },
  huggingface: {
    label: 'HuggingFace TGI',
    providerType: 'openai_compatible',
    defaultName: 'HuggingFace TGI',
    defaultBaseUrl: 'https://your-endpoint/v1',
    modelHint: 'meta-llama/Llama-3.1-8B-Instruct',
    modelOptions: [
      { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instruct' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B Instruct' },
    ],
    requiresApiKey: true,
  },
  xai: {
    label: 'xAI / Grok',
    providerType: 'openai_compatible',
    defaultName: 'xAI',
    defaultBaseUrl: 'https://api.x.ai/v1',
    modelHint: 'grok-4.3',
    modelOptions: [
      { id: 'grok-4.3', name: 'Grok 4.3' },
      { id: 'grok-4.20', name: 'Grok 4.20' },
      { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast Reasoning' },
      { id: 'grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast Non-Reasoning' },
      { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast Reasoning' },
      { id: 'grok-4-fast-non-reasoning', name: 'Grok 4 Fast Non-Reasoning' },
      { id: 'grok-4', name: 'Grok 4' },
    ],
    requiresApiKey: true,
  },
  deepseek: {
    label: 'DeepSeek',
    providerType: 'deepseek',
    defaultName: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    modelHint: 'deepseek-v4-flash',
    modelOptions: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
      { id: 'deepseek-chat', name: 'DeepSeek Chat (legacy)' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (legacy)' },
    ],
    requiresApiKey: true,
  },
  qwen: {
    label: 'Qwen / DashScope',
    providerType: 'qwen',
    defaultName: 'Qwen',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    modelHint: 'qwen-plus',
    modelOptions: [
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-max', name: 'Qwen Max' },
      { id: 'qwen-flash', name: 'Qwen Flash' },
      { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus' },
      { id: 'qwen3.5-flash', name: 'Qwen3.5 Flash' },
      { id: 'qwen3-coder-plus', name: 'Qwen3 Coder Plus' },
    ],
    requiresApiKey: true,
  },
  openai_codex: {
    label: 'OpenAI Codex',
    providerType: 'openai_codex',
    defaultName: 'OpenAI Codex',
    defaultBaseUrl: 'https://codex-api.openai.com/v1',
    modelHint: 'gpt-5.5',
    modelOptions: [
      { id: 'gpt-5.5', name: 'GPT-5.5' },
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini' },
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex' },
      { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark' },
      { id: 'gpt-5.2', name: 'GPT-5.2' },
    ],
    requiresApiKey: false,
    requiresOAuth: true,
    defaultProfile: {
      name: 'OpenAI Codex GPT-5.5',
      description: 'OpenAI Codex via OAuth 2.1 PKCE',
      temperature: '0.7',
      maxTokens: '4096',
      topP: '1.0',
    },
  },
  azure_openai: {
    label: 'Azure OpenAI (OAuth)',
    providerType: 'azure_openai',
    defaultName: 'Azure OpenAI',
    defaultBaseUrl: '',
    modelHint: 'gpt-5.5',
    modelOptions: [
      { id: 'gpt-5.5', name: 'GPT-5.5 deployment' },
      { id: 'gpt-5.4', name: 'GPT-5.4 deployment' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini deployment' },
      { id: 'gpt-4o', name: 'GPT-4o deployment' },
      { id: 'gpt-4.1', name: 'GPT-4.1 deployment' },
    ],
    requiresApiKey: false,
    requiresOAuth: true,
    defaultProfile: {
      name: 'Azure OpenAI GPT-4o',
      description: 'Azure OpenAI via Microsoft Entra ID',
      temperature: '0.7',
      maxTokens: '4096',
      topP: '1.0',
    },
  },
};

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'provider'
  );
}

function providerPresetForFamily(family: ProviderFamily) {
  return PROVIDER_PRESETS[family];
}

function defaultProviderForm(family: ProviderFamily = 'ollama'): ProviderFormState {
  const preset = providerPresetForFamily(family);
  return {
    family,
    name: preset.defaultName,
    providerId: slugify(preset.defaultName),
    baseUrl: preset.defaultBaseUrl,
    apiKey: '',
    clientId: '',
    tenantId: '',
    redirectUri: OPENAI_CODEX_REDIRECT_URI,
    authProfileId: 'default',
  };
}

function stringFromConfig(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function shouldWarnAboutDockerOllamaBaseUrl(providerFamily: ProviderFamily, baseUrl: string) {
  return providerFamily === 'ollama' && /localhost(?::11434)?/i.test(baseUrl);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function defaultOAuthProfileId(provider: ModelProviderDefinition) {
  return stringFromConfig(provider.config?.default_oauth_profile_id) || 'default';
}

function oauthProfilesForProvider(
  provider: ModelProviderDefinition
): Array<{ id: string; data: Record<string, unknown> }> {
  const profiles = provider.config?.auth_profiles;
  if (isRecord(profiles)) {
    return Object.entries(profiles).flatMap(([id, data]) => (isRecord(data) ? [{ id, data }] : []));
  }

  if (provider.config?.access_token || provider.config?.refresh_token) {
    return [
      { id: defaultOAuthProfileId(provider), data: provider.config as Record<string, unknown> },
    ];
  }

  return [];
}

function oauthProfileForProvider(provider: ModelProviderDefinition, profileId?: string) {
  const selectedProfileId = profileId || defaultOAuthProfileId(provider);
  return (
    oauthProfilesForProvider(provider).find((profile) => profile.id === selectedProfileId)?.data ??
    null
  );
}

function hasOAuthToken(provider: ModelProviderDefinition, profileId?: string) {
  const profile = oauthProfileForProvider(provider, profileId);
  return Boolean(profile?.access_token || provider.config?.access_token);
}

function oauthAccountId(provider: ModelProviderDefinition, profileId?: string) {
  const profile = oauthProfileForProvider(provider, profileId);
  return stringFromConfig(
    profile?.account_id ??
      profile?.accountId ??
      provider.config?.account_id ??
      provider.config?.accountId
  );
}

function oauthExpiresAt(provider: ModelProviderDefinition, profileId?: string) {
  const profile = oauthProfileForProvider(provider, profileId);
  const value = profile?.expires_at ?? provider.config?.expires_at;
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : null;
}

function oauthStatusLabel(provider: ModelProviderDefinition, profileId?: string) {
  if (!hasOAuthToken(provider, profileId)) {
    return 'Not linked';
  }
  const expiresAt = oauthExpiresAt(provider, profileId);
  if (expiresAt && Date.now() / 1000 > expiresAt) {
    return 'Expired';
  }
  return 'Linked';
}

function isProviderFamily(value: unknown): value is ProviderFamily {
  return typeof value === 'string' && value in PROVIDER_PRESETS;
}

function providerFamilyFromProvider(provider: ModelProviderDefinition): ProviderFamily {
  if (isProviderFamily(provider.config?.provider_family)) {
    return provider.config.provider_family;
  }
  if (isProviderFamily(provider.provider_type)) {
    return provider.provider_type;
  }
  return 'openai_compatible';
}

function llmCardTone(family: ProviderFamily | null) {
  switch (family) {
    case 'openai':
    case 'openai_codex':
    case 'azure_openai':
      return {
        accent: 'bg-primary-500',
        badge:
          'border-primary-200 bg-primary-50 text-primary-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200',
        card: 'border-primary-200 bg-primary-50/25 dark:border-sky-500/25 dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),rgba(10,17,30,0.94)_58%)]',
      };
    case 'anthropic':
    case 'xai':
    case 'deepseek':
      return {
        accent: 'bg-secondary-500',
        badge:
          'border-secondary-200 bg-secondary-50 text-secondary-800 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200',
        card: 'border-secondary-200 bg-secondary-50/25 dark:border-violet-500/25 dark:bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.14),rgba(10,17,30,0.94)_58%)]',
      };
    case 'google':
    case 'huggingface':
    case 'qwen':
      return {
        accent: 'bg-warning-400',
        badge:
          'border-warning-200 bg-warning-50 text-warning-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200',
        card: 'border-warning-200 bg-warning-50/30 dark:border-amber-500/25 dark:bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.13),rgba(10,17,30,0.94)_58%)]',
      };
    case 'ollama':
      return {
        accent: 'bg-success-500',
        badge:
          'border-success-200 bg-success-50 text-success-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200',
        card: 'border-success-200 bg-success-50/30 dark:border-emerald-500/25 dark:bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.13),rgba(10,17,30,0.94)_58%)]',
      };
    default:
      return {
        accent: 'bg-neutral-400',
        badge:
          'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-white/12 dark:bg-white/8 dark:text-slate-200',
        card: 'border-neutral-200 bg-white dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(20,30,48,0.92),rgba(9,14,24,0.96))]',
      };
  }
}

function toProviderEditFormState(provider: ModelProviderDefinition): ProviderEditFormState {
  const config = provider.config ?? {};
  const apiKey = config.api_key;
  const clientId = config.client_id;
  const tenantId = config.tenant_id;
  const redirectUri = config.redirect_uri ?? config.redirectUri;
  const authProfileId = config.default_oauth_profile_id;
  return {
    family: providerFamilyFromProvider(provider),
    name: provider.name,
    providerId: provider.id,
    baseUrl: provider.endpoint?.base_url ?? '',
    apiKey: typeof apiKey === 'string' ? apiKey : '',
    description: provider.description ?? '',
    clientId: typeof clientId === 'string' ? clientId : '',
    tenantId: typeof tenantId === 'string' ? tenantId : '',
    redirectUri:
      typeof redirectUri === 'string' && redirectUri.trim()
        ? redirectUri
        : OPENAI_CODEX_REDIRECT_URI,
    authProfileId:
      typeof authProfileId === 'string' && authProfileId.trim() ? authProfileId : 'default',
  };
}

function defaultCreateLlmModelState(providers: ModelProviderDefinition[]): CreateLlmModelState {
  const fallbackProvider = defaultProviderForm();
  const firstProvider = providers[0];
  return {
    mode: firstProvider ? 'existing' : 'new',
    provider: fallbackProvider,
    selectedProviderId: firstProvider?.id ?? '',
    profileName: '',
    profileDescription: '',
    model: firstProvider
      ? modelHintForProvider(providers, firstProvider.id)
      : providerPresetForFamily(fallbackProvider.family).modelHint,
    temperature: '',
    maxTokens: '',
    topP: '',
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsVision: false,
    supportsStreaming: true,
    oauthProfileId: '',
    fallbackStrategy: 'auto',
    fallbackModels: [],
    fallbackPolicy: { ...DEFAULT_FALLBACK_POLICY },
  };
}

function providerPatchFromForm(
  provider: ModelProviderDefinition | Partial<ModelProviderDefinition>,
  form: ProviderEditFormState | ProviderFormState
) {
  const preset = providerPresetForFamily(form.family);
  const baseUrl = form.baseUrl.trim() || null;
  const apiKey = form.apiKey.trim() || null;
  const config = {
    ...(provider.config ?? {}),
    provider_family: form.family,
    api_key: apiKey,
  };
  if (preset.requiresOAuth) {
    Object.assign(config, {
      client_id: form.clientId?.trim() || undefined,
      tenant_id: form.tenantId?.trim() || undefined,
      redirect_uri: form.redirectUri?.trim() || OPENAI_CODEX_REDIRECT_URI,
      default_oauth_profile_id: form.authProfileId?.trim() || 'default',
    });
  }
  const patch = {
    name: form.name.trim(),
    provider_type: preset.providerType,
    endpoint: baseUrl ? { ...(provider.endpoint ?? {}), base_url: baseUrl } : null,
    config,
  };
  return 'description' in form ? { ...patch, description: form.description.trim() || null } : patch;
}

function toFormState(profile?: BehaviorTuningProfile): ProfileFormState {
  const retryOn = profile?.fallbackPolicy?.retry_on;
  return {
    name: profile?.name ?? '',
    description: profile?.description ?? '',
    provider: profile?.provider ?? '',
    model: profile?.model ?? '',
    temperature: profile?.temperature == null ? '' : String(profile.temperature),
    maxTokens: profile?.maxTokens == null ? '' : String(profile.maxTokens),
    topP: profile?.topP == null ? '' : String(profile.topP),
    supportsTools: profile?.supportsTools ?? true,
    supportsStructuredOutput: profile?.supportsStructuredOutput ?? false,
    supportsVision: profile?.supportsVision ?? false,
    supportsStreaming: profile?.supportsStreaming ?? true,
    oauthProfileId:
      typeof profile?.parameters?.oauth_profile_id === 'string'
        ? profile.parameters.oauth_profile_id
        : '',
    fallbackStrategy: profile?.fallbackStrategy ?? 'auto',
    fallbackModels:
      profile?.fallbackModels?.slice(0, MAX_FALLBACK_MODELS).map((target) => ({
        provider: target.provider ?? profile.provider,
        model: target.model,
      })) ?? [],
    fallbackPolicy: {
      retryOn: Array.isArray(retryOn) && retryOn.length > 0 ? retryOn : FALLBACK_RETRY_REASONS,
      sameProviderOnly: profile?.fallbackPolicy?.same_provider_only ?? false,
      requireCapabilityMatch: profile?.fallbackPolicy?.require_capability_match ?? true,
    },
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function runtimeTuningErrors(values: RuntimeTuningValues): RuntimeTuningErrors {
  const errors: RuntimeTuningErrors = {};
  const temperature = parseOptionalNumber(values.temperature);
  const maxTokens = parseOptionalNumber(values.maxTokens);
  const topP = parseOptionalNumber(values.topP);

  if (values.temperature.trim() && temperature === null) {
    errors.temperature = 'Enter a number from 0 to 2.';
  } else if (temperature !== null && (temperature < 0 || temperature > 2)) {
    errors.temperature = 'Temperature must be from 0 to 2.';
  }

  if (values.maxTokens.trim() && maxTokens === null) {
    errors.maxTokens = 'Enter a whole number from 1 to 1,000,000.';
  } else if (
    maxTokens !== null &&
    (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 1_000_000)
  ) {
    errors.maxTokens = 'Max tokens must be a whole number from 1 to 1,000,000.';
  }

  if (values.topP.trim() && topP === null) {
    errors.topP = 'Enter a number from 0 to 1.';
  } else if (topP !== null && (topP < 0 || topP > 1)) {
    errors.topP = 'Top p must be from 0 to 1.';
  }

  return errors;
}

function hasRuntimeTuningErrors(values: RuntimeTuningValues) {
  return Object.keys(runtimeTuningErrors(values)).length > 0;
}

function activeRuntimeTuningPreset(values: RuntimeTuningValues) {
  return RUNTIME_TUNING_PRESETS.find(
    (preset) =>
      preset.values.temperature === values.temperature.trim() &&
      preset.values.maxTokens === values.maxTokens.trim() &&
      preset.values.topP === values.topP.trim()
  );
}

function RuntimeTuningFields({
  values,
  onChange,
  disabled,
  idPrefix,
}: {
  values: RuntimeTuningValues;
  onChange: (values: RuntimeTuningValues) => void;
  disabled: boolean;
  idPrefix: string;
}) {
  const [touched, setTouched] = useState<Set<RuntimeTuningField>>(new Set());
  const errors = runtimeTuningErrors(values);
  const activePreset = activeRuntimeTuningPreset(values);
  const visibleError = (field: RuntimeTuningField) =>
    touched.has(field) || values[field].trim() ? errors[field] : null;
  const updateField = (field: RuntimeTuningField, value: string) => {
    onChange({ ...values, [field]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-(--agency-shell-text)">Quick preset</legend>
        <div
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
          role="group"
          aria-label="Runtime tuning preset"
        >
          {RUNTIME_TUNING_PRESETS.map((preset) => (
            <Toggle
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              pressed={activePreset?.id === preset.id}
              onPressedChange={(pressed) => {
                if (!pressed) return;
                onChange(preset.values);
                setTouched(new Set());
              }}
              disabled={disabled}
              aria-label={`${preset.label} runtime preset`}
            >
              {preset.label}
            </Toggle>
          ))}
        </div>
        <p className="text-xs leading-5 text-(--agency-shell-muted)">
          {activePreset?.description ??
            'Custom tuning. Values are validated below before this preset can be saved.'}
        </p>
      </fieldset>
      <FormFieldGroup columns={3}>
        <FormField
          label="Temperature"
          htmlFor={`${idPrefix}-temperature`}
          description="Randomness from 0 (stable) to 2 (varied)."
          error={visibleError('temperature')}
          optional
          disabled={disabled}
        >
          <Input
            id={`${idPrefix}-temperature`}
            type="number"
            inputMode="decimal"
            min={0}
            max={2}
            step={0.1}
            value={values.temperature}
            onChange={(event) => updateField('temperature', event.target.value)}
            onBlur={() => setTouched((current) => new Set(current).add('temperature'))}
            disabled={disabled}
            aria-invalid={Boolean(visibleError('temperature'))}
            aria-describedby={`${idPrefix}-temperature-feedback`}
            placeholder="Provider default"
          />
        </FormField>
        <FormField
          label="Max tokens"
          htmlFor={`${idPrefix}-max-tokens`}
          description="Maximum generated tokens; provider limits still apply."
          error={visibleError('maxTokens')}
          optional
          disabled={disabled}
        >
          <Input
            id={`${idPrefix}-max-tokens`}
            type="number"
            inputMode="numeric"
            min={1}
            max={1_000_000}
            step={1}
            value={values.maxTokens}
            onChange={(event) => updateField('maxTokens', event.target.value)}
            onBlur={() => setTouched((current) => new Set(current).add('maxTokens'))}
            disabled={disabled}
            aria-invalid={Boolean(visibleError('maxTokens'))}
            aria-describedby={`${idPrefix}-max-tokens-feedback`}
            placeholder="Provider default"
          />
        </FormField>
        <FormField
          label="Top p"
          htmlFor={`${idPrefix}-top-p`}
          description="Token sampling range from 0 (narrow) to 1 (full)."
          error={visibleError('topP')}
          optional
          disabled={disabled}
        >
          <Input
            id={`${idPrefix}-top-p`}
            type="number"
            inputMode="decimal"
            min={0}
            max={1}
            step={0.1}
            value={values.topP}
            onChange={(event) => updateField('topP', event.target.value)}
            onBlur={() => setTouched((current) => new Set(current).add('topP'))}
            disabled={disabled}
            aria-invalid={Boolean(visibleError('topP'))}
            aria-describedby={`${idPrefix}-top-p-feedback`}
            placeholder="Provider default"
          />
        </FormField>
      </FormFieldGroup>
    </div>
  );
}

function providerNameFromId(providers: ModelProviderDefinition[], providerId: string) {
  return providers.find((provider) => provider.id === providerId)?.name ?? providerId;
}

function providerBaseUrl(providers: ModelProviderDefinition[], providerId: string) {
  return providers.find((provider) => provider.id === providerId)?.endpoint?.base_url ?? null;
}

function providerApiKey(providers: ModelProviderDefinition[], providerId: string) {
  const value = providers.find((provider) => provider.id === providerId)?.config?.api_key;
  return typeof value === 'string' && value.trim() ? value : null;
}

function modelHintForProvider(providers: ModelProviderDefinition[], providerId: string) {
  const provider = providers.find((item) => item.id === providerId);
  return provider
    ? providerPresetForFamily(providerFamilyFromProvider(provider)).modelHint
    : PROVIDER_PRESETS.openai_compatible.modelHint;
}

const CUSTOM_MODEL_OPTION = '__custom_model__';

type ProviderModelOptionsById = Record<string, ModelProviderModelOption[]>;

function modelOptionsForProvider(
  providers: ModelProviderDefinition[],
  providerId: string,
  modelOptionsByProvider: ProviderModelOptionsById = {}
) {
  const selectedProvider = providers.find((provider) => provider.id === providerId);
  if (!selectedProvider) {
    return [];
  }
  const liveOptions = modelOptionsByProvider[providerId] ?? [];
  if (liveOptions.length > 0) {
    return liveOptions;
  }
  return providerPresetForFamily(providerFamilyFromProvider(selectedProvider)).modelOptions;
}

function firstModelForProvider(
  providers: ModelProviderDefinition[],
  providerId: string,
  modelOptionsByProvider: ProviderModelOptionsById = {}
) {
  return (
    modelOptionsForProvider(providers, providerId, modelOptionsByProvider)[0]?.id ??
    modelHintForProvider(providers, providerId)
  );
}

function defaultFallbackTarget(
  providers: ModelProviderDefinition[],
  primaryProviderId: string,
  modelOptionsByProvider: ProviderModelOptionsById = {}
): ProfileFallbackFormTarget {
  const providerId =
    providers.find((provider) => provider.id !== primaryProviderId)?.id ??
    primaryProviderId ??
    providers[0]?.id ??
    '';
  return {
    provider: providerId,
    model: providerId ? firstModelForProvider(providers, providerId, modelOptionsByProvider) : '',
  };
}

function toFallbackPayload(
  fallbackStrategy: ModelFallbackStrategy,
  fallbackModels: ProfileFallbackFormTarget[],
  fallbackPolicy: ProfileFallbackPolicyForm
) {
  return {
    fallback_strategy: fallbackStrategy,
    fallback_policy: {
      retry_on: fallbackPolicy.retryOn,
      same_provider_only: fallbackPolicy.sameProviderOnly,
      require_capability_match: fallbackPolicy.requireCapabilityMatch,
    },
    fallback_models:
      fallbackStrategy === 'manual'
        ? fallbackModels
            .filter((target) => target.model.trim())
            .slice(0, MAX_FALLBACK_MODELS)
            .map((target) => {
              const provider = target.provider.trim();
              return provider
                ? { provider, model: target.model.trim() }
                : { model: target.model.trim() };
            })
        : [],
  };
}

function fallbackBadgeLabel(profile: BehaviorTuningProfile) {
  if (profile.fallbackStrategy === 'disabled') {
    return 'No backups';
  }
  if (profile.fallbackStrategy === 'manual') {
    const count = profile.fallbackModels?.length ?? 0;
    return `${count} backup${count === 1 ? '' : 's'}`;
  }
  return 'Auto backups';
}

function ModelSelector({
  id,
  label = 'Model',
  value,
  onChange,
  options,
  placeholder,
  disabled,
  error,
  required = false,
  onBlur,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ModelProviderModelOption[];
  placeholder: string;
  disabled: boolean;
  error?: string | null;
  required?: boolean;
  onBlur?: () => void;
}) {
  const [customMode, setCustomMode] = useState(false);
  const modelIds = new Set(options.map((option) => option.id));
  const usesCustomModel = Boolean(value) && !modelIds.has(value);
  const selectValue = customMode || usesCustomModel ? CUSTOM_MODEL_OPTION : value;

  return (
    <FormField label={label} htmlFor={id} error={error} required={required} disabled={disabled}>
      <select
        id={id}
        required={required}
        value={selectValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue === CUSTOM_MODEL_OPTION) {
            setCustomMode(true);
            onChange('');
            return;
          }
          setCustomMode(false);
          onChange(nextValue);
        }}
        disabled={disabled}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-feedback`}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">Select a model</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name && option.name !== option.id ? `${option.name} (${option.id})` : option.id}
          </option>
        ))}
        <option value={CUSTOM_MODEL_OPTION}>Custom model ID...</option>
      </select>
      {customMode || usesCustomModel || options.length === 0 ? (
        <Input
          aria-label={`${label} custom value`}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-feedback`}
        />
      ) : null}
    </FormField>
  );
}

function fallbackStatusLabel(
  fallback: ProfileFallbackFormTarget,
  providers: ModelProviderDefinition[],
  modelOptionsByProvider: ProviderModelOptionsById = {}
) {
  const provider = providers.find((item) => item.id === fallback.provider);
  if (!provider) {
    return { label: 'Provider missing', variant: 'destructive' as const };
  }
  const preset = providerPresetForFamily(providerFamilyFromProvider(provider));
  if (preset.requiresOAuth && !hasOAuthToken(provider)) {
    return { label: 'Needs OAuth', variant: 'destructive' as const };
  }
  if (preset.requiresApiKey && !provider.config?.api_key) {
    return { label: 'Needs API key', variant: 'destructive' as const };
  }
  if (!fallback.model.trim()) {
    return { label: 'Model required', variant: 'secondary' as const };
  }
  const options = modelOptionsForProvider(providers, fallback.provider, modelOptionsByProvider);
  if (options.length === 0) {
    return { label: 'Model unverified', variant: 'secondary' as const };
  }
  if (options.some((option) => option.id === fallback.model)) {
    return { label: 'Listed model', variant: 'outline' as const };
  }
  return { label: 'Custom model', variant: 'secondary' as const };
}

function FallbackModelFields({
  idPrefix,
  strategy,
  models,
  policy,
  providers,
  primaryProviderId,
  modelOptionsByProvider,
  disabled,
  onChange,
}: {
  idPrefix: string;
  strategy: ModelFallbackStrategy;
  models: ProfileFallbackFormTarget[];
  policy: ProfileFallbackPolicyForm;
  providers: ModelProviderDefinition[];
  primaryProviderId: string;
  modelOptionsByProvider?: ProviderModelOptionsById;
  disabled: boolean;
  onChange: (next: {
    fallbackStrategy: ModelFallbackStrategy;
    fallbackModels: ProfileFallbackFormTarget[];
    fallbackPolicy: ProfileFallbackPolicyForm;
  }) => void;
}) {
  const updatePolicy = (nextPolicy: ProfileFallbackPolicyForm) => {
    onChange({ fallbackStrategy: strategy, fallbackModels: models, fallbackPolicy: nextPolicy });
  };

  const toggleRetryReason = (reason: ModelFallbackRetryReason, checked: boolean) => {
    const nextRetryOn = checked
      ? [...new Set([...policy.retryOn, reason])]
      : policy.retryOn.filter((item) => item !== reason);
    updatePolicy({ ...policy, retryOn: nextRetryOn.length > 0 ? nextRetryOn : [reason] });
  };

  const addFallback = () => {
    if (models.length >= MAX_FALLBACK_MODELS) {
      return;
    }
    onChange({
      fallbackStrategy: strategy,
      fallbackModels: [
        ...models,
        defaultFallbackTarget(providers, primaryProviderId, modelOptionsByProvider),
      ],
      fallbackPolicy: policy,
    });
  };

  const updateModel = (index: number, nextModel: ProfileFallbackFormTarget) => {
    onChange({
      fallbackStrategy: strategy,
      fallbackModels: models.map((model, modelIndex) => (modelIndex === index ? nextModel : model)),
      fallbackPolicy: policy,
    });
  };

  const removeModel = (index: number) => {
    onChange({
      fallbackStrategy: strategy,
      fallbackModels: models.filter((_, modelIndex) => modelIndex !== index),
      fallbackPolicy: policy,
    });
  };

  const moveModel = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= models.length) {
      return;
    }
    const nextModels = [...models];
    [nextModels[index], nextModels[nextIndex]] = [nextModels[nextIndex], nextModels[index]];
    onChange({ fallbackStrategy: strategy, fallbackModels: nextModels, fallbackPolicy: policy });
  };

  const updateStrategy = (fallbackStrategy: ModelFallbackStrategy) => {
    onChange({
      fallbackStrategy,
      fallbackModels:
        fallbackStrategy === 'manual' && models.length === 0 && providers.length > 0
          ? [defaultFallbackTarget(providers, primaryProviderId, modelOptionsByProvider)]
          : models,
      fallbackPolicy: policy,
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-[rgba(10,17,30,0.84)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label htmlFor={`${idPrefix}-fallback-strategy`}>Fallback models</Label>
        <div className="inline-flex overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-white/5">
          {(['auto', 'manual', 'disabled'] as ModelFallbackStrategy[]).map((option) => (
            <Button
              key={option}
              type="button"
              variant={strategy === option ? 'default' : 'ghost'}
              className="h-8 rounded-none px-3 text-xs capitalize"
              disabled={disabled}
              onClick={() => updateStrategy(option)}
            >
              {option}
            </Button>
          ))}
        </div>
        <select
          id={`${idPrefix}-fallback-strategy`}
          value={strategy}
          onChange={(event) => updateStrategy(event.target.value as ModelFallbackStrategy)}
          disabled={disabled}
          className="sr-only"
        >
          <option value="auto">Auto</option>
          <option value="manual">Manual</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {strategy === 'manual' ? (
        <div className="space-y-3">
          {models.map((fallback, index) => {
            const selectedModelOptions = modelOptionsForProvider(
              providers,
              fallback.provider,
              modelOptionsByProvider
            );
            const status = fallbackStatusLabel(fallback, providers, modelOptionsByProvider);
            const moveUpLabel = `Move backup ${index + 1} up`;
            const moveDownLabel = `Move backup ${index + 1} down`;
            const removeLabel = `Remove backup ${index + 1}`;
            return (
              <div
                key={`${index}-${fallback.provider}`}
                className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
              >
                <div className="space-y-1.5">
                  <Label htmlFor={`${idPrefix}-fallback-provider-${index}`}>
                    Backup {index + 1} provider
                  </Label>
                  <select
                    id={`${idPrefix}-fallback-provider-${index}`}
                    value={fallback.provider}
                    onChange={(event) => {
                      const provider = event.target.value;
                      updateModel(index, {
                        provider,
                        model: provider
                          ? firstModelForProvider(providers, provider, modelOptionsByProvider)
                          : '',
                      });
                    }}
                    disabled={disabled || providers.length === 0}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>
                <ModelSelector
                  key={`${fallback.provider}-${index}`}
                  id={`${idPrefix}-fallback-model-${index}`}
                  label={`Backup ${index + 1} model`}
                  value={fallback.model}
                  onChange={(model) => updateModel(index, { ...fallback, model })}
                  options={selectedModelOptions}
                  placeholder={
                    fallback.provider
                      ? modelHintForProvider(providers, fallback.provider)
                      : 'model-id'
                  }
                  disabled={disabled}
                />
                <div className="flex items-end gap-1">
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={disabled || index === 0}
                          onClick={() => moveModel(index, -1)}
                          aria-label={moveUpLabel}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{moveUpLabel}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={disabled || index === models.length - 1}
                          onClick={() => moveModel(index, 1)}
                          aria-label={moveDownLabel}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{moveDownLabel}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={disabled}
                          onClick={() => removeModel(index)}
                          aria-label={removeLabel}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{removeLabel}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="md:col-span-3">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={disabled || models.length >= MAX_FALLBACK_MODELS || providers.length === 0}
            onClick={addFallback}
          >
            <Plus className="h-4 w-4" />
            Add backup
          </Button>
        </div>
      ) : strategy === 'auto' ? (
        <p className="text-xs text-neutral-500 dark:text-slate-400">
          Auto chooses up to two provider defaults and keeps model capabilities from this preset.
        </p>
      ) : (
        <p className="text-xs text-neutral-500 dark:text-slate-400">
          Disabled stops the run when the primary model fails.
        </p>
      )}

      {strategy !== 'disabled' ? (
        <div className="space-y-2 border-t border-neutral-200 pt-3 dark:border-white/10">
          <div className="text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">
            Fallback policy
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {FALLBACK_RETRY_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex items-center gap-2 text-neutral-700 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={policy.retryOn.includes(reason)}
                  disabled={disabled}
                  title={FALLBACK_RETRY_REASON_TITLES[reason]}
                  onChange={(event) => toggleRetryReason(reason, event.target.checked)}
                />
                <span>{FALLBACK_RETRY_REASON_LABELS[reason]}</span>
              </label>
            ))}
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <label className="flex items-center gap-2 text-neutral-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={policy.sameProviderOnly}
                disabled={disabled}
                title="Only use fallback models from the same provider as the primary model."
                onChange={(event) =>
                  updatePolicy({ ...policy, sameProviderOnly: event.target.checked })
                }
              />
              <span>Same provider only</span>
            </label>
            <label className="flex items-center gap-2 text-neutral-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={policy.requireCapabilityMatch}
                disabled={disabled}
                title="Require backups to support the primary model preset's enabled tools, structured output, vision, and streaming capabilities."
                onChange={(event) =>
                  updatePolicy({ ...policy, requireCapabilityMatch: event.target.checked })
                }
              />
              <span>Match capabilities</span>
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function toProfilePayloadFromLlmModelState({
  state,
  providerId,
  baseUrl,
  apiKey,
}: {
  state: CreateLlmModelState;
  providerId: string;
  baseUrl: string | null;
  apiKey: string | null;
}) {
  const parameters = state.oauthProfileId.trim()
    ? { oauth_profile_id: state.oauthProfileId.trim() }
    : {};
  const payload = {
    name: state.profileName.trim(),
    description: state.profileDescription.trim() || null,
    provider: providerId,
    model: state.model.trim(),
    base_url: baseUrl,
    api_key_ref: apiKey,
    temperature: parseOptionalNumber(state.temperature),
    max_tokens: parseOptionalNumber(state.maxTokens),
    top_p: parseOptionalNumber(state.topP),
    supports_tools: state.supportsTools,
    supports_structured_output: state.supportsStructuredOutput,
    supports_vision: state.supportsVision,
    supports_streaming: state.supportsStreaming,
    ...toFallbackPayload(state.fallbackStrategy, state.fallbackModels, state.fallbackPolicy),
  };
  return Object.keys(parameters).length > 0 ? { ...payload, parameters } : payload;
}

function ProfileFields({
  form,
  setForm,
  providers,
  modelOptionsByProvider,
  disabled,
  idPrefix,
}: {
  form: ProfileFormState;
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
  providers: ModelProviderDefinition[];
  modelOptionsByProvider?: ProviderModelOptionsById;
  disabled: boolean;
  idPrefix: string;
}) {
  const selectedProvider = providers.find((provider) => provider.id === form.provider);
  const selectedOAuthProfiles = selectedProvider ? oauthProfilesForProvider(selectedProvider) : [];
  const selectedProviderRequiresOAuth = selectedProvider
    ? providerPresetForFamily(providerFamilyFromProvider(selectedProvider)).requiresOAuth
    : false;
  const selectedModelOptions = modelOptionsForProvider(
    providers,
    form.provider,
    modelOptionsByProvider
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          disabled={disabled}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-provider`}>Provider</Label>
          <select
            id={`${idPrefix}-provider`}
            value={form.provider}
            onChange={(event) => {
              const providerId = event.target.value;
              setForm((current) => ({
                ...current,
                provider: providerId,
                model: providerId
                  ? firstModelForProvider(providers, providerId, modelOptionsByProvider)
                  : '',
                oauthProfileId: '',
              }));
            }}
            disabled={disabled || providers.length === 0}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a provider</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>
        <ModelSelector
          key={form.provider}
          id={`${idPrefix}-model`}
          value={form.model}
          onChange={(model) => setForm((current) => ({ ...current, model }))}
          options={selectedModelOptions}
          placeholder={form.provider ? modelHintForProvider(providers, form.provider) : 'model-id'}
          disabled={disabled}
        />
      </div>
      {selectedProviderRequiresOAuth ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-oauth-profile`}>OAuth account</Label>
          <select
            id={`${idPrefix}-oauth-profile`}
            value={form.oauthProfileId}
            onChange={(event) =>
              setForm((current) => ({ ...current, oauthProfileId: event.target.value }))
            }
            disabled={disabled}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">
              Use connection default (
              {selectedProvider ? defaultOAuthProfileId(selectedProvider) : 'default'})
            </option>
            {selectedOAuthProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.id}
                {stringFromConfig(profile.data.account_id)
                  ? ` (${stringFromConfig(profile.data.account_id)})`
                  : ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <FallbackModelFields
        idPrefix={idPrefix}
        strategy={form.fallbackStrategy}
        models={form.fallbackModels}
        policy={form.fallbackPolicy}
        providers={providers}
        primaryProviderId={form.provider}
        modelOptionsByProvider={modelOptionsByProvider}
        disabled={disabled}
        onChange={(fallback) => setForm((current) => ({ ...current, ...fallback }))}
      />
      <RuntimeTuningFields
        idPrefix={idPrefix}
        values={form}
        onChange={(values) => setForm((current) => ({ ...current, ...values }))}
        disabled={disabled}
      />
      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.supportsTools}
            onChange={(event) =>
              setForm((current) => ({ ...current, supportsTools: event.target.checked }))
            }
            disabled={disabled}
          />
          Supports tools
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.supportsStructuredOutput}
            onChange={(event) =>
              setForm((current) => ({ ...current, supportsStructuredOutput: event.target.checked }))
            }
            disabled={disabled}
          />
          Structured output
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.supportsVision}
            onChange={(event) =>
              setForm((current) => ({ ...current, supportsVision: event.target.checked }))
            }
            disabled={disabled}
          />
          Vision
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.supportsStreaming}
            onChange={(event) =>
              setForm((current) => ({ ...current, supportsStreaming: event.target.checked }))
            }
            disabled={disabled}
          />
          Streaming
        </label>
      </div>
    </div>
  );
}

function OAuthDialog({
  provider,
  onComplete,
}: {
  provider: ModelProviderDefinition;
  onComplete: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'start' | 'waiting' | 'manual'>('start');
  const [authData, setAuthData] = useState<ProviderAuthorizeResponse | null>(null);
  const [completionInput, setCompletionInput] = useState('');
  const [authProfileId, setAuthProfileId] = useState(defaultOAuthProfileId(provider));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const completedRedirectRef = useRef<string | null>(null);
  const oauthProfiles = oauthProfilesForProvider(provider);
  const statusLabel = oauthStatusLabel(provider, authProfileId);
  const accountId = oauthAccountId(provider, authProfileId);
  const oauthIsDirty =
    step !== 'start' ||
    authProfileId !== defaultOAuthProfileId(provider) ||
    Boolean(completionInput);

  const resetOAuth = () => {
    setStep('start');
    setAuthData(null);
    setCompletionInput('');
    setAuthProfileId(defaultOAuthProfileId(provider));
    setError(null);
    completedRedirectRef.current = null;
  };

  const handleStart = () => {
    setError(null);
    completedRedirectRef.current = null;
    startTransition(async () => {
      try {
        const res = await modelProvidersApi.authorizeProvider(provider.id, { authProfileId });
        setAuthData(res);
        setAuthProfileId(res.auth_profile_id || authProfileId);
        window.open(res.auth_url, '_blank');
        setStep('waiting');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start OAuth flow');
      }
    });
  };

  const completeOAuth = useCallback(
    (input: string) => {
      if (!authData) return;
      const trimmedInput = input.trim();
      if (!trimmedInput) return;
      const isRedirectUrl = /^https?:\/\//i.test(trimmedInput);
      setError(null);
      startTransition(async () => {
        try {
          await modelProvidersApi.completeAuthorizeProvider(provider.id, {
            code: isRedirectUrl ? undefined : trimmedInput,
            redirect_url: isRedirectUrl ? trimmedInput : undefined,
            pkce_verifier: authData.pkce_verifier,
            state: authData.state,
            auth_profile_id: authData.auth_profile_id || authProfileId,
            client_id: authData.client_id,
          });
          toast.success('OAuth authorization successful!');
          setIsOpen(false);
          await onComplete();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to complete OAuth flow');
        }
      });
    },
    [authData, authProfileId, onComplete, provider.id, startTransition]
  );

  useEffect(() => {
    if (!isOpen || step !== 'waiting' || !authData) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const redirectUrl = oauthCallbackRedirectUrlFromMessage(event, authData);
      if (!redirectUrl || completedRedirectRef.current === redirectUrl) {
        return;
      }
      completedRedirectRef.current = redirectUrl;
      setCompletionInput(redirectUrl);
      completeOAuth(redirectUrl);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [authData, completeOAuth, isOpen, step]);

  const handleManualComplete = () => {
    if (!authData) return;
    completeOAuth(completionInput);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="gap-2">
        <RefreshCw className="h-3 w-3" />
        {hasOAuthToken(provider, authProfileId) ? 'Re-authorize OAuth' : 'Authorize OAuth'}
      </Button>
      <AppDialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open && !isPending) resetOAuth();
        }}
        dirty={oauthIsDirty}
        busy={isPending}
        onDiscard={resetOAuth}
        size="sm"
        icon={<RefreshCw className="size-4" aria-hidden="true" />}
        title={`OAuth authorization: ${provider.name}`}
        description="Connect your account using OAuth 2.1 PKCE."
        bodyClassName="flex flex-col gap-4"
        footer={
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Close
            </Button>
          </DialogClose>
        }
      >
        {step === 'start' && (
          <FormSection
            title="Account profile"
            description="Choose the saved account alias that should own this authorization."
            icon={<RefreshCw className="size-4" aria-hidden="true" />}
            contentClassName="flex flex-col gap-4"
          >
            <FormField
              label="OAuth profile"
              htmlFor={`${provider.id}-oauth-profile-id`}
              description="Use default unless you intentionally keep multiple accounts for this provider."
              required
            >
              <Input
                id={`${provider.id}-oauth-profile-id`}
                required
                value={authProfileId}
                onChange={(event) => setAuthProfileId(event.target.value.trim() || 'default')}
                disabled={isPending}
                aria-describedby={`${provider.id}-oauth-profile-id-feedback`}
              />
            </FormField>
            {oauthProfiles.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-(--agency-shell-muted)">Saved profiles</p>
                <div className="flex flex-wrap gap-2">
                  {oauthProfiles.map((profile) => (
                    <Button
                      key={profile.id}
                      type="button"
                      variant={profile.id === authProfileId ? 'brand' : 'outline'}
                      size="sm"
                      onClick={() => setAuthProfileId(profile.id)}
                    >
                      {profile.id}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-lg border border-(--agency-shell-border) bg-(--agency-row-hover) px-3 py-2.5 text-xs text-(--agency-shell-muted)">
              <p>
                Status:{' '}
                <span className="font-medium text-(--agency-shell-text)">{statusLabel}</span>
              </p>
              {accountId ? (
                <p>
                  Account:{' '}
                  <span className="font-medium text-(--agency-shell-text)">{accountId}</span>
                </p>
              ) : null}
            </div>
            <Button onClick={handleStart} disabled={isPending} className="w-full">
              {isPending ? 'Starting...' : 'Browser authorization'}
            </Button>
          </FormSection>
        )}

        {step === 'waiting' && (
          <FormSection
            title="Complete authorization"
            description="Finish in the opened browser tab. Paste the redirect value only if automatic completion does not return."
            contentClassName="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-(--agency-shell-muted)">Authorization URL</p>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Copy authorization URL"
                        onClick={() => {
                          if (authData?.auth_url) {
                            navigator.clipboard.writeText(authData.auth_url);
                            toast.success('URL copied to clipboard');
                          }
                        }}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy authorization URL</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <code className="break-all rounded-lg bg-muted p-3 text-xs">
                {authData?.auth_url}
              </code>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-(--agency-shell-border) bg-(--agency-row-hover) p-3 text-xs text-(--agency-shell-muted)">
              <p>
                <strong>Configured Redirect URI:</strong> {authData?.redirect_uri}
              </p>
              <p>
                <strong>Configured Client ID:</strong>{' '}
                {authData?.client_id || `${OPENAI_CODEX_CLIENT_ID} (Default)`}
              </p>
              <p>
                <strong>OAuth Profile:</strong> {authData?.auth_profile_id || authProfileId}
              </p>
            </div>
            <FormField
              label="Redirect URL or authorization code"
              htmlFor={`${provider.id}-oauth-completion`}
              description="Paste the full redirect URL when available; a raw authorization code also works."
              required
            >
              <Input
                id={`${provider.id}-oauth-completion`}
                required
                value={completionInput}
                onChange={(e) => setCompletionInput(e.target.value)}
                placeholder="Paste the full redirect URL or raw code"
                aria-describedby={`${provider.id}-oauth-completion-feedback`}
              />
            </FormField>
            <FieldFeedback error={error} />
            <div className="flex gap-2">
              <Button
                onClick={handleManualComplete}
                disabled={isPending || !completionInput.trim()}
                className="flex-1"
              >
                {isPending ? 'Completing...' : 'Complete Manually'}
              </Button>
              <Button variant="ghost" onClick={() => setStep('start')}>
                Back
              </Button>
            </div>
          </FormSection>
        )}
      </AppDialog>
    </>
  );
}

function ProviderConnectionCard({
  provider,
  linkedProfiles,
  onRefresh,
}: {
  provider: ModelProviderDefinition;
  linkedProfiles: BehaviorTuningProfile[];
  onRefresh: () => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderEditFormState>(() => toProviderEditFormState(provider));
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setForm(toProviderEditFormState(provider));
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const patch = providerPatchFromForm(provider, form);
          const nextBaseUrl = form.baseUrl.trim() || null;
          const nextApiKey = form.apiKey.trim() || null;
          await modelProvidersApi.updateProvider(provider.id, patch);
          await Promise.all(
            linkedProfiles.map((profile) =>
              modelProfilesApi.updateProfile(profile.id, {
                base_url: nextBaseUrl,
                api_key_ref: nextApiKey,
              })
            )
          );
          await onRefresh();
          toast.success('LLM connection updated.', { position: 'top-right' });
          setIsEditing(false);
        } catch (saveError) {
          setError(
            saveError instanceof Error ? saveError.message : 'Failed to update LLM connection.'
          );
        }
      })();
    });
  };

  const family = providerFamilyFromProvider(provider);
  const baseUrl = provider.endpoint?.base_url;
  const hasApiKey = Boolean(provider.config?.api_key);
  const providerRequiresOAuth = Boolean(providerPresetForFamily(family).requiresOAuth);
  const oauthProfiles = oauthProfilesForProvider(provider);
  const defaultProfileId = defaultOAuthProfileId(provider);
  const defaultOAuthStatus = oauthStatusLabel(provider, defaultProfileId);
  const tone = llmCardTone(family);

  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-none border-0 border-b border-neutral-200 bg-transparent shadow-none transition-colors last:border-b-0 dark:border-white/10 dark:bg-transparent dark:shadow-none',
        !isEditing && 'hover:bg-neutral-50/75 dark:hover:bg-white/[0.025]'
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', tone.accent)} />
      {isEditing ? (
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg dark:text-slate-50">{provider.name}</CardTitle>
              <CardDescription className="dark:text-slate-300">
                {provider.description || `${providerPresetForFamily(family).label} connection`}
              </CardDescription>
            </div>
            <Badge variant="outline" className={tone.badge}>
              {provider.provider_type}
            </Badge>
          </div>
        </CardHeader>
      ) : null}
      <CardContent
        className={cn(
          'text-sm text-neutral-600 dark:text-slate-200',
          isEditing ? 'space-y-3' : 'p-0'
        )}
      >
        {isEditing ? (
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-slate-950/60">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${provider.id}-connection-family`}>Provider family</Label>
                <select
                  id={`${provider.id}-connection-family`}
                  value={form.family}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      family: event.target.value as ProviderFamily,
                    }))
                  }
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(PROVIDER_PRESETS).map(([familyKey, preset]) => (
                    <option key={familyKey} value={familyKey}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${provider.id}-connection-name`}>Connection name</Label>
                <Input
                  id={`${provider.id}-connection-name`}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${provider.id}-connection-description`}>Description</Label>
              <Textarea
                id={`${provider.id}-connection-description`}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                disabled={isPending}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${provider.id}-connection-id`}>Connection ID</Label>
                <Input id={`${provider.id}-connection-id`} value={form.providerId} disabled />
                <p className="text-xs text-neutral-500 dark:text-slate-400">
                  IDs stay fixed because model presets reference this connection.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${provider.id}-connection-base-url`}>Base URL</Label>
                <Input
                  id={`${provider.id}-connection-base-url`}
                  value={form.baseUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, baseUrl: event.target.value }))
                  }
                  disabled={isPending}
                />
                {shouldWarnAboutDockerOllamaBaseUrl(form.family, form.baseUrl) ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    localhost usually points at the backend container itself. For Dockerized local
                    backends, prefer http://host.docker.internal:11434.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${provider.id}-connection-api-key`}>API key</Label>
              <Input
                id={`${provider.id}-connection-api-key`}
                type="password"
                value={form.apiKey}
                onChange={(event) =>
                  setForm((current) => ({ ...current, apiKey: event.target.value }))
                }
                disabled={isPending}
                placeholder={
                  providerPresetForFamily(form.family).requiresApiKey
                    ? 'Required for this provider'
                    : 'Optional'
                }
              />
            </div>
            {providerPresetForFamily(form.family).requiresOAuth && (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${provider.id}-connection-client-id`}>Client ID</Label>
                    <Input
                      id={`${provider.id}-connection-client-id`}
                      value={form.clientId}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, clientId: event.target.value }))
                      }
                      disabled={isPending}
                      placeholder="OAuth Client ID"
                    />
                  </div>
                  {form.family === 'azure_openai' && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`${provider.id}-connection-tenant-id`}>Tenant ID</Label>
                      <Input
                        id={`${provider.id}-connection-tenant-id`}
                        value={form.tenantId}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, tenantId: event.target.value }))
                        }
                        disabled={isPending}
                        placeholder="Azure Tenant ID"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${provider.id}-connection-redirect-uri`}>Redirect URI</Label>
                  <Input
                    id={`${provider.id}-connection-redirect-uri`}
                    value={form.redirectUri}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, redirectUri: event.target.value }))
                    }
                    disabled={isPending}
                    placeholder={`e.g. ${OPENAI_CODEX_REDIRECT_URI}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${provider.id}-connection-auth-profile`}>
                    Default OAuth profile
                  </Label>
                  <Input
                    id={`${provider.id}-connection-auth-profile`}
                    value={form.authProfileId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, authProfileId: event.target.value }))
                    }
                    disabled={isPending}
                    placeholder="default"
                  />
                </div>
              </>
            )}
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Saving this connection also refreshes endpoint and credential references on{' '}
              {linkedProfiles.length} linked model preset{linkedProfiles.length === 1 ? '' : 's'}.
            </p>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                className="agency-gradient text-white hover:brightness-105"
                disabled={isPending || !form.name.trim()}
                onClick={handleSave}
              >
                {isPending ? 'Saving...' : 'Save connection'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  reset();
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1.1fr)_minmax(15rem,1.5fr)_minmax(12rem,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-neutral-950 dark:text-slate-50">{provider.name}</p>
                <Badge variant="outline" className={tone.badge}>
                  {provider.provider_type}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-neutral-500 dark:text-slate-400">
                {provider.description || `${providerPresetForFamily(family).label} connection`}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400 lg:hidden">
                Endpoint
              </p>
              <p className="mt-1 truncate text-sm font-medium text-neutral-800 dark:text-slate-100 lg:mt-0">
                {baseUrl || 'Not set'}
              </p>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="outline">
                {linkedProfiles.length} preset{linkedProfiles.length === 1 ? '' : 's'}
              </Badge>
              {providerRequiresOAuth ? (
                hasOAuthToken(provider, defaultProfileId) ? (
                  <Badge variant="successful">OAuth {defaultOAuthStatus}</Badge>
                ) : (
                  <Badge variant="destructive">OAuth required</Badge>
                )
              ) : hasApiKey ? (
                <Badge variant="successful">API key set</Badge>
              ) : (
                <Badge variant="secondary">No API key</Badge>
              )}
              {!baseUrl ? <Badge variant="secondary">No base URL</Badge> : null}
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setIsEditing(true);
                }}
              >
                Edit connection
              </Button>
              {providerRequiresOAuth && <OAuthDialog provider={provider} onComplete={onRefresh} />}
            </div>

            {providerRequiresOAuth ? (
              <div className="border-t border-neutral-200 pt-3 sm:col-span-2 lg:col-span-4 dark:border-white/10">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                  OAuth profiles
                </p>
                {oauthProfiles.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {oauthProfiles.map((profile) => {
                      const accountId = oauthAccountId(provider, profile.id);
                      return (
                        <div key={profile.id} className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant={profile.id === defaultProfileId ? 'default' : 'outline'}>
                            {profile.id}
                          </Badge>
                          <Badge variant="outline">{oauthStatusLabel(provider, profile.id)}</Badge>
                          {accountId ? (
                            <span className="truncate text-xs text-neutral-500 dark:text-slate-400">
                              Account {accountId}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                    No OAuth account linked.
                  </p>
                )}
              </div>
            ) : null}
            {error ? (
              <p className="text-xs text-red-600 sm:col-span-2 lg:col-span-4">{error}</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateLlmModelDialog({
  providers,
  modelOptionsByProvider,
  onRefresh,
}: {
  providers: ModelProviderDefinition[];
  modelOptionsByProvider: ProviderModelOptionsById;
  onRefresh: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<CreateLlmModelState>(() =>
    defaultCreateLlmModelState(providers)
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [touched, setTouched] = useState<
    Set<'provider' | 'providerName' | 'providerId' | 'apiKey' | 'profileName' | 'model'>
  >(new Set());

  // OAuth specific state
  const [oauthStep, setOauthStep] = useState<'idle' | 'waiting' | 'manual'>('idle');
  const [oauthData, setOauthData] = useState<ProviderAuthorizeResponse | null>(null);
  const [completionInput, setCompletionInput] = useState('');
  const [createdProviderId, setCreatedProviderId] = useState<string | null>(null);
  const completedRedirectRef = useRef<string | null>(null);
  const formIsDirty =
    JSON.stringify(state) !== JSON.stringify(defaultCreateLlmModelState(providers)) ||
    oauthStep !== 'idle' ||
    Boolean(completionInput);

  const reset = useCallback(() => {
    setState(defaultCreateLlmModelState(providers));
    setError(null);
    setOauthStep('idle');
    setOauthData(null);
    setCompletionInput('');
    setCreatedProviderId(null);
    setTouched(new Set());
    completedRedirectRef.current = null;
  }, [providers]);

  const updateProviderFamily = (family: ProviderFamily) => {
    const provider = defaultProviderForm(family);
    setState((current) => ({
      ...current,
      provider,
      model:
        providerPresetForFamily(family).modelOptions[0]?.id ??
        providerPresetForFamily(family).modelHint,
    }));
    setError(null);
  };

  const updateSelectedProvider = (providerId: string) => {
    setState((current) => ({
      ...current,
      selectedProviderId: providerId,
      model: providerId ? firstModelForProvider(providers, providerId, modelOptionsByProvider) : '',
      oauthProfileId: '',
    }));
  };

  const handleCreate = () => {
    if (hasRuntimeTuningErrors(state)) {
      setError('Fix the runtime tuning values before adding this model.');
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          let providerId = state.selectedProviderId;
          let baseUrl = providerBaseUrl(providers, providerId);
          let apiKey = providerApiKey(providers, providerId);

          if (state.mode === 'new') {
            const providerPayload = providerPatchFromForm({}, state.provider);
            providerId = state.provider.providerId.trim() || slugify(state.provider.name);
            baseUrl = state.provider.baseUrl.trim() || null;
            apiKey = state.provider.apiKey.trim() || null;
            const newProvider = await modelProvidersApi.createProvider({
              id: providerId,
              ...providerPayload,
            });

            const preset = providerPresetForFamily(state.provider.family);
            if (preset.requiresOAuth) {
              const authProfileId = state.provider.authProfileId?.trim() || 'default';
              completedRedirectRef.current = null;
              const res = await modelProvidersApi.authorizeProvider(newProvider.id, {
                clientId: state.provider.clientId,
                authProfileId,
              });
              setOauthData(res);
              setCreatedProviderId(newProvider.id);
              window.open(res.auth_url, '_blank');
              setOauthStep('waiting');
              toast.info(
                'OAuth flow started in a new tab. Please complete authorization to finish model creation.',
                {
                  duration: 10000,
                }
              );
              return; // Stop here, wait for OAuth
            }
          }

          await modelProfilesApi.createProfile(
            toProfilePayloadFromLlmModelState({ state, providerId, baseUrl, apiKey })
          );
          await onRefresh();
          toast.success('Model added.', { position: 'top-right' });
          reset();
          setIsOpen(false);
        } catch (createError) {
          setError(createError instanceof Error ? createError.message : 'Failed to add model.');
        }
      })();
    });
  };

  const completeOAuthAndCreateModel = useCallback(
    (input: string) => {
      if (!oauthData || !createdProviderId) return;
      const trimmedInput = input.trim();
      if (!trimmedInput) return;
      const isRedirectUrl = /^https?:\/\//i.test(trimmedInput);
      setError(null);
      startTransition(async () => {
        try {
          await modelProvidersApi.completeAuthorizeProvider(createdProviderId, {
            code: isRedirectUrl ? undefined : trimmedInput,
            redirect_url: isRedirectUrl ? trimmedInput : undefined,
            pkce_verifier: oauthData.pkce_verifier,
            client_id: oauthData.client_id,
            state: oauthData.state,
            auth_profile_id: oauthData.auth_profile_id || state.provider.authProfileId || 'default',
          });

          const preset = providerPresetForFamily(state.provider.family);
          const modelState = {
            ...state,
            // OAuth fills in the profile metadata after the model picker has been used. Keep that
            // explicit selection; the preset's latest model is only a no-selection fallback.
            model: state.model.trim() || preset.modelOptions[0]?.id || preset.modelHint,
          };
          if (preset.defaultProfile) {
            const dp = preset.defaultProfile;
            modelState.profileName = dp.name;
            modelState.profileDescription = dp.description;
            modelState.temperature = dp.temperature;
            modelState.maxTokens = dp.maxTokens;
            modelState.topP = dp.topP;
          }

          await modelProfilesApi.createProfile(
            toProfilePayloadFromLlmModelState({
              state: {
                ...modelState,
                oauthProfileId:
                  oauthData.auth_profile_id || state.provider.authProfileId || 'default',
              },
              providerId: createdProviderId,
              baseUrl: state.provider.baseUrl.trim() || null,
              apiKey: null,
            })
          );

          await onRefresh();
          toast.success('OAuth successful and model created!');
          reset();
          setIsOpen(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to complete OAuth and create model');
        }
      });
    },
    [createdProviderId, oauthData, onRefresh, reset, startTransition, state]
  );

  useEffect(() => {
    if (!isOpen || oauthStep !== 'waiting' || !oauthData) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const redirectUrl = oauthCallbackRedirectUrlFromMessage(event, oauthData);
      if (!redirectUrl || completedRedirectRef.current === redirectUrl) {
        return;
      }
      completedRedirectRef.current = redirectUrl;
      setCompletionInput(redirectUrl);
      completeOAuthAndCreateModel(redirectUrl);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [completeOAuthAndCreateModel, isOpen, oauthData, oauthStep]);

  const handleOAuthComplete = () => {
    completeOAuthAndCreateModel(completionInput);
  };

  const selectedPreset = providerPresetForFamily(state.provider.family);
  const selectedProvider = providers.find((provider) => provider.id === state.selectedProviderId);
  const selectedProviderRequiresOAuth = selectedProvider
    ? providerPresetForFamily(providerFamilyFromProvider(selectedProvider)).requiresOAuth
    : false;
  const selectedOAuthProfiles = selectedProvider ? oauthProfilesForProvider(selectedProvider) : [];
  const selectedExistingModelOptions = modelOptionsForProvider(
    providers,
    state.selectedProviderId,
    modelOptionsByProvider
  );
  const newProviderModelOptions = selectedPreset.modelOptions;
  const primaryProviderId =
    state.mode === 'existing' ? state.selectedProviderId : state.provider.providerId;
  const canCreate =
    (selectedPreset.requiresOAuth ? true : state.profileName.trim()) &&
    state.model.trim() &&
    (state.mode === 'existing'
      ? state.selectedProviderId
      : state.provider.name.trim() &&
        state.provider.providerId.trim() &&
        (!selectedPreset.requiresApiKey || state.provider.apiKey.trim())) &&
    !hasRuntimeTuningErrors(state);
  const markTouched = (
    field: 'provider' | 'providerName' | 'providerId' | 'apiKey' | 'profileName' | 'model'
  ) => setTouched((current) => new Set(current).add(field));
  const selectedProviderError =
    state.mode === 'existing' && touched.has('provider') && !state.selectedProviderId
      ? 'Choose an existing connection.'
      : null;
  const providerNameError =
    state.mode === 'new' && touched.has('providerName') && !state.provider.name.trim()
      ? 'Enter a connection name.'
      : null;
  const providerIdError =
    state.mode === 'new' && touched.has('providerId') && !state.provider.providerId.trim()
      ? 'Enter a stable connection ID.'
      : null;
  const apiKeyError =
    state.mode === 'new' &&
    selectedPreset.requiresApiKey &&
    touched.has('apiKey') &&
    !state.provider.apiKey.trim()
      ? 'Enter the API key required by this provider.'
      : null;
  const profileNameError =
    !selectedPreset.requiresOAuth && touched.has('profileName') && !state.profileName.trim()
      ? 'Enter a preset name.'
      : null;
  const modelError = touched.has('model') && !state.model.trim() ? 'Choose a model.' : null;

  return (
    <>
      <Button
        type="button"
        className="agency-gradient text-white hover:brightness-105"
        onClick={() => setIsOpen(true)}
      >
        Add Model
      </Button>
      <AppDialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open && !isPending) {
            reset();
          }
        }}
        dirty={formIsDirty}
        busy={isPending}
        onDiscard={reset}
        size="lg"
        icon={<BrainCog className="size-4" aria-hidden="true" />}
        title="Add model"
        description="Create a selectable model preset and connect it to an existing or new provider."
        bodyClassName="flex flex-col gap-5"
        footer={
          <>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            {oauthStep === 'idle' ? (
              <Button
                type="button"
                variant="brand"
                disabled={isPending || !canCreate}
                onClick={handleCreate}
              >
                {isPending
                  ? 'Creating...'
                  : selectedPreset.requiresOAuth
                    ? 'Authorize & Add'
                    : 'Add model'}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormSection
            title="Connection"
            description="Reuse a configured provider or add a new connection for this model."
            icon={<BrainCog className="size-4" aria-hidden="true" />}
            contentClassName="flex flex-col gap-4"
          >
            <div
              className="grid gap-2 md:grid-cols-2"
              role="radiogroup"
              aria-label="Connection source"
            >
              <Button
                type="button"
                variant={state.mode === 'existing' ? 'brand' : 'outline'}
                disabled={isPending || providers.length === 0}
                onClick={() =>
                  setState((current) => ({
                    ...current,
                    mode: 'existing',
                    selectedProviderId: current.selectedProviderId || providers[0]?.id || '',
                    model: current.selectedProviderId
                      ? firstModelForProvider(
                          providers,
                          current.selectedProviderId,
                          modelOptionsByProvider
                        )
                      : providers[0]
                        ? firstModelForProvider(providers, providers[0].id, modelOptionsByProvider)
                        : '',
                  }))
                }
              >
                Existing connection
              </Button>
              <Button
                type="button"
                variant={state.mode === 'new' ? 'brand' : 'outline'}
                disabled={isPending}
                onClick={() =>
                  setState((current) => ({
                    ...current,
                    mode: 'new',
                    model:
                      providerPresetForFamily(current.provider.family).modelOptions[0]?.id ||
                      providerPresetForFamily(current.provider.family).modelHint,
                  }))
                }
              >
                New connection
              </Button>
            </div>

            {state.mode === 'existing' ? (
              <FormFieldGroup columns={2}>
                <FormField
                  label="LLM connection"
                  htmlFor="llm-existing-provider"
                  error={selectedProviderError}
                  required
                >
                  <select
                    id="llm-existing-provider"
                    required
                    value={state.selectedProviderId}
                    onChange={(event) => updateSelectedProvider(event.target.value)}
                    onBlur={() => markTouched('provider')}
                    disabled={isPending || providers.length === 0}
                    aria-invalid={Boolean(selectedProviderError)}
                    aria-describedby="llm-existing-provider-feedback"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a connection</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                {selectedProviderRequiresOAuth ? (
                  <FormField
                    label="OAuth account"
                    htmlFor="llm-existing-oauth-profile"
                    description="Use the connection default unless this preset needs a specific account."
                    optional
                  >
                    <select
                      id="llm-existing-oauth-profile"
                      value={state.oauthProfileId}
                      onChange={(event) =>
                        setState((current) => ({ ...current, oauthProfileId: event.target.value }))
                      }
                      disabled={isPending}
                      aria-describedby="llm-existing-oauth-profile-feedback"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">
                        Use connection default (
                        {selectedProvider ? defaultOAuthProfileId(selectedProvider) : 'default'})
                      </option>
                      {selectedOAuthProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.id}
                          {stringFromConfig(profile.data.account_id)
                            ? ` (${stringFromConfig(profile.data.account_id)})`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </FormField>
                ) : null}
              </FormFieldGroup>
            ) : (
              <div className="flex flex-col gap-4">
                <FormFieldGroup columns={2}>
                  <FormField label="Provider family" htmlFor="llm-provider-family" required>
                    <select
                      id="llm-provider-family"
                      required
                      value={state.provider.family}
                      onChange={(event) =>
                        updateProviderFamily(event.target.value as ProviderFamily)
                      }
                      disabled={isPending}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {Object.entries(PROVIDER_PRESETS).map(([family, preset]) => (
                        <option key={family} value={family}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField
                    label="Connection name"
                    htmlFor="llm-provider-name"
                    error={providerNameError}
                    required
                  >
                    <Input
                      id="llm-provider-name"
                      required
                      value={state.provider.name}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          provider: {
                            ...current.provider,
                            name: event.target.value,
                            providerId: slugify(event.target.value),
                          },
                        }))
                      }
                      onBlur={() => markTouched('providerName')}
                      disabled={isPending}
                      aria-invalid={Boolean(providerNameError)}
                      aria-describedby="llm-provider-name-feedback"
                    />
                  </FormField>
                </FormFieldGroup>
                <FormFieldGroup columns={2}>
                  <FormField
                    label="Connection ID"
                    htmlFor="llm-provider-id"
                    description="Stable identifier used by agents and workflows."
                    error={providerIdError}
                    required
                  >
                    <Input
                      id="llm-provider-id"
                      required
                      value={state.provider.providerId}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          provider: { ...current.provider, providerId: event.target.value },
                        }))
                      }
                      onBlur={() => markTouched('providerId')}
                      disabled={isPending}
                      aria-invalid={Boolean(providerIdError)}
                      aria-describedby="llm-provider-id-feedback"
                    />
                  </FormField>
                  <FormField
                    label="Base URL"
                    htmlFor="llm-provider-base-url"
                    description="Use the provider default unless you run a compatible local or proxy endpoint."
                    optional
                  >
                    <Input
                      id="llm-provider-base-url"
                      value={state.provider.baseUrl}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          provider: { ...current.provider, baseUrl: event.target.value },
                        }))
                      }
                      disabled={isPending}
                      aria-describedby="llm-provider-base-url-feedback"
                    />
                    {shouldWarnAboutDockerOllamaBaseUrl(
                      state.provider.family,
                      state.provider.baseUrl
                    ) ? (
                      <p className="text-xs text-amber-700">
                        localhost usually points at the backend container itself. For Dockerized
                        local backends, prefer http://host.docker.internal:11434.
                      </p>
                    ) : null}
                  </FormField>
                </FormFieldGroup>
                <FormField
                  label="API key"
                  htmlFor="llm-provider-api-key"
                  description={
                    selectedPreset.requiresApiKey
                      ? 'Stored through the backend connection configuration.'
                      : 'Only needed when this provider requires credential authentication.'
                  }
                  error={apiKeyError}
                  required={selectedPreset.requiresApiKey}
                  optional={!selectedPreset.requiresApiKey}
                >
                  <Input
                    id="llm-provider-api-key"
                    type="password"
                    required={selectedPreset.requiresApiKey}
                    value={state.provider.apiKey}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        provider: { ...current.provider, apiKey: event.target.value },
                      }))
                    }
                    onBlur={() => markTouched('apiKey')}
                    disabled={isPending}
                    aria-invalid={Boolean(apiKeyError)}
                    aria-describedby="llm-provider-api-key-feedback"
                    placeholder={
                      selectedPreset.requiresApiKey ? 'Required for this provider' : 'Optional'
                    }
                  />
                </FormField>
                {selectedPreset.requiresOAuth && (
                  <FormFieldGroup columns={2}>
                    <FormField label="Client ID" htmlFor="llm-provider-client-id" optional>
                      <Input
                        id="llm-provider-client-id"
                        value={state.provider.clientId}
                        onChange={(event) =>
                          setState((current) => ({
                            ...current,
                            provider: { ...current.provider, clientId: event.target.value },
                          }))
                        }
                        disabled={isPending}
                        placeholder="OAuth Client ID"
                      />
                    </FormField>
                    {state.provider.family === 'azure_openai' && (
                      <FormField label="Tenant ID" htmlFor="llm-provider-tenant-id" optional>
                        <Input
                          id="llm-provider-tenant-id"
                          value={state.provider.tenantId}
                          onChange={(event) =>
                            setState((current) => ({
                              ...current,
                              provider: { ...current.provider, tenantId: event.target.value },
                            }))
                          }
                          disabled={isPending}
                          placeholder="Azure Tenant ID"
                        />
                      </FormField>
                    )}
                    <FormField
                      label="Redirect URI"
                      htmlFor="llm-provider-redirect-uri"
                      description="Must match the Redirect URI registered with your Client ID."
                      optional
                    >
                      <Input
                        id="llm-provider-redirect-uri"
                        value={state.provider.redirectUri}
                        onChange={(event) =>
                          setState((current) => ({
                            ...current,
                            provider: { ...current.provider, redirectUri: event.target.value },
                          }))
                        }
                        disabled={isPending}
                        placeholder={`e.g. ${OPENAI_CODEX_REDIRECT_URI}`}
                        aria-describedby="llm-provider-redirect-uri-feedback"
                      />
                    </FormField>
                    <FormField
                      label="OAuth profile"
                      htmlFor="llm-provider-auth-profile-id"
                      description="Use a stable account alias such as default or work."
                      optional
                    >
                      <Input
                        id="llm-provider-auth-profile-id"
                        value={state.provider.authProfileId}
                        onChange={(event) =>
                          setState((current) => ({
                            ...current,
                            provider: { ...current.provider, authProfileId: event.target.value },
                          }))
                        }
                        disabled={isPending}
                        placeholder="default"
                        aria-describedby="llm-provider-auth-profile-id-feedback"
                      />
                    </FormField>
                  </FormFieldGroup>
                )}
              </div>
            )}
          </FormSection>

          {oauthStep === 'idle' ? (
            <>
              <FormSection
                title="Model preset"
                description="Name the reusable preset and choose the model agents will call."
                icon={<Sparkles className="size-4" aria-hidden="true" />}
                contentClassName="flex flex-col gap-4"
              >
                <FormFieldGroup columns={2}>
                  <FormField
                    label="Preset name"
                    htmlFor="llm-profile-name"
                    description={
                      selectedPreset.requiresOAuth
                        ? 'Filled from the provider preset after OAuth completes.'
                        : 'Use a name that explains the model’s intended role.'
                    }
                    error={profileNameError}
                    required={!selectedPreset.requiresOAuth}
                    optional={selectedPreset.requiresOAuth}
                  >
                    <Input
                      id="llm-profile-name"
                      required={!selectedPreset.requiresOAuth}
                      value={state.profileName}
                      onChange={(event) =>
                        setState((current) => ({ ...current, profileName: event.target.value }))
                      }
                      onBlur={() => markTouched('profileName')}
                      disabled={isPending}
                      aria-invalid={Boolean(profileNameError)}
                      aria-describedby="llm-profile-name-feedback"
                      placeholder={selectedPreset.requiresOAuth ? '(Auto-filled after OAuth)' : ''}
                    />
                  </FormField>
                  <ModelSelector
                    key={`${state.mode}-${state.mode === 'new' ? state.provider.family : state.selectedProviderId}`}
                    id="llm-model"
                    value={state.model}
                    onChange={(model) => setState((current) => ({ ...current, model }))}
                    options={
                      state.mode === 'new' ? newProviderModelOptions : selectedExistingModelOptions
                    }
                    placeholder={
                      state.mode === 'new'
                        ? selectedPreset.modelHint
                        : modelHintForProvider(providers, state.selectedProviderId)
                    }
                    disabled={isPending}
                    error={modelError}
                    required
                    onBlur={() => markTouched('model')}
                  />
                </FormFieldGroup>
                <FormField
                  label="Description"
                  htmlFor="llm-profile-description"
                  description="Explain when agents and workflows should choose this preset."
                  optional
                >
                  <Textarea
                    id="llm-profile-description"
                    value={state.profileDescription}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        profileDescription: event.target.value,
                      }))
                    }
                    disabled={isPending}
                    aria-describedby="llm-profile-description-feedback"
                    placeholder={selectedPreset.requiresOAuth ? '(Auto-filled after OAuth)' : ''}
                  />
                </FormField>
              </FormSection>
              <FormSection
                title="Runtime and fallback"
                description="Tune generation, capabilities, and recovery only when the defaults are not enough."
                advanced
                advancedLabel="Show runtime settings"
                contentClassName="flex flex-col gap-4"
              >
                <FallbackModelFields
                  idPrefix="llm"
                  strategy={state.fallbackStrategy}
                  models={state.fallbackModels}
                  policy={state.fallbackPolicy}
                  providers={providers}
                  primaryProviderId={primaryProviderId}
                  modelOptionsByProvider={modelOptionsByProvider}
                  disabled={isPending}
                  onChange={(fallback) => setState((current) => ({ ...current, ...fallback }))}
                />
                <RuntimeTuningFields
                  idPrefix="llm"
                  values={state}
                  onChange={(values) => setState((current) => ({ ...current, ...values }))}
                  disabled={isPending}
                />
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium text-(--agency-shell-text)">
                    Model capabilities
                  </legend>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-lg border border-(--agency-shell-border) bg-(--agency-row-hover) px-3 py-2.5 text-sm text-(--agency-shell-text)">
                      <input
                        type="checkbox"
                        checked={state.supportsTools}
                        onChange={(event) =>
                          setState((current) => ({
                            ...current,
                            supportsTools: event.target.checked,
                          }))
                        }
                        disabled={isPending}
                      />
                      Supports tools
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-(--agency-shell-border) bg-(--agency-row-hover) px-3 py-2.5 text-sm text-(--agency-shell-text)">
                      <input
                        type="checkbox"
                        checked={state.supportsStructuredOutput}
                        onChange={(event) =>
                          setState((current) => ({
                            ...current,
                            supportsStructuredOutput: event.target.checked,
                          }))
                        }
                        disabled={isPending}
                      />
                      Structured output
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-(--agency-shell-border) bg-(--agency-row-hover) px-3 py-2.5 text-sm text-(--agency-shell-text)">
                      <input
                        type="checkbox"
                        checked={state.supportsVision}
                        onChange={(event) =>
                          setState((current) => ({
                            ...current,
                            supportsVision: event.target.checked,
                          }))
                        }
                        disabled={isPending}
                      />
                      Vision
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-(--agency-shell-border) bg-(--agency-row-hover) px-3 py-2.5 text-sm text-(--agency-shell-text)">
                      <input
                        type="checkbox"
                        checked={state.supportsStreaming}
                        onChange={(event) =>
                          setState((current) => ({
                            ...current,
                            supportsStreaming: event.target.checked,
                          }))
                        }
                        disabled={isPending}
                      />
                      Streaming
                    </label>
                  </div>
                </fieldset>
              </FormSection>
            </>
          ) : (
            <FormSection
              title="OAuth authorization in progress"
              description="Complete authorization in the opened tab. Paste the redirect value only if the flow does not return automatically."
              icon={<RefreshCw className="size-4" aria-hidden="true" />}
              contentClassName="flex flex-col gap-4"
            >
              <FormField
                label="Redirect URL or authorization code"
                htmlFor="oauth-manual-code"
                description="The full redirect URL is preferred; a raw code is also accepted."
                required
              >
                <Input
                  id="oauth-manual-code"
                  required
                  value={completionInput}
                  onChange={(e) => setCompletionInput(e.target.value)}
                  placeholder="Paste redirect URL or code"
                  aria-describedby="oauth-manual-code-feedback"
                />
              </FormField>
              <div className="flex gap-2">
                <Button
                  onClick={handleOAuthComplete}
                  disabled={isPending || !completionInput.trim()}
                  variant="brand"
                >
                  {isPending ? 'Completing...' : 'Complete & Create Model'}
                </Button>
                <Button variant="outline" onClick={() => setOauthStep('idle')} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </FormSection>
          )}
          <FieldFeedback error={error} />
        </div>
      </AppDialog>
    </>
  );
}

function ProfileCard({
  profile,
  providers,
  modelOptionsByProvider,
  onRefresh,
}: {
  profile: BehaviorTuningProfile;
  providers: ModelProviderDefinition[];
  modelOptionsByProvider: ProviderModelOptionsById;
  onRefresh: () => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileFormState>(() => toFormState(profile));
  const [isPending, startTransition] = useTransition();
  const provider = providers.find((candidate) => candidate.id === profile.provider) ?? null;
  const tone = llmCardTone(provider ? providerFamilyFromProvider(provider) : null);
  const runtimeTuningIsValid = !hasRuntimeTuningErrors(form);

  const reset = () => {
    setForm(toFormState(profile));
    setDeleteMode(false);
    setError(null);
  };

  const handleSave = () => {
    if (!runtimeTuningIsValid) {
      setError('Fix the runtime tuning values before saving this model preset.');
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const selectedBaseUrl = providerBaseUrl(providers, form.provider);
          const selectedApiKey = providerApiKey(providers, form.provider);
          const profilePatch = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            provider: form.provider,
            model: form.model.trim(),
            base_url: selectedBaseUrl,
            api_key_ref: selectedApiKey,
            temperature: parseOptionalNumber(form.temperature),
            max_tokens: parseOptionalNumber(form.maxTokens),
            top_p: parseOptionalNumber(form.topP),
            supports_tools: form.supportsTools,
            supports_structured_output: form.supportsStructuredOutput,
            supports_vision: form.supportsVision,
            supports_streaming: form.supportsStreaming,
            ...toFallbackPayload(form.fallbackStrategy, form.fallbackModels, form.fallbackPolicy),
          };
          await modelProfilesApi.updateProfile(
            profile.id,
            form.oauthProfileId.trim()
              ? { ...profilePatch, parameters: { oauth_profile_id: form.oauthProfileId.trim() } }
              : profilePatch
          );
          await onRefresh();
          toast.success('Model preset updated.', { position: 'top-right' });
          setIsEditing(false);
        } catch (saveError) {
          setError(
            saveError instanceof Error ? saveError.message : 'Failed to update model preset.'
          );
        }
      })();
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await modelProfilesApi.deleteProfile(profile.id);
          await onRefresh();
          toast.success('Model preset deleted.', { position: 'top-right' });
        } catch (deleteError) {
          setError(
            deleteError instanceof Error ? deleteError.message : 'Failed to delete model preset.'
          );
        }
      })();
    });
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-none border-0 border-b border-neutral-200 bg-transparent shadow-none transition-colors last:border-b-0 dark:border-white/10 dark:bg-transparent dark:shadow-none',
        !isEditing && 'hover:bg-neutral-50/75 dark:hover:bg-white/[0.025]'
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', tone.accent)} />
      {isEditing ? (
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg dark:text-slate-50">{profile.name}</CardTitle>
              <CardDescription className="dark:text-slate-300">
                {profile.description ||
                  `${providerNameFromId(providers, profile.provider)} / ${profile.model}`}
              </CardDescription>
            </div>
            <Badge variant="outline" className={tone.badge}>
              {providerNameFromId(providers, profile.provider)}
            </Badge>
          </div>
        </CardHeader>
      ) : null}
      <CardContent
        className={cn(
          'text-sm text-neutral-600 dark:text-slate-200',
          isEditing ? 'space-y-3' : 'p-0'
        )}
      >
        {isEditing ? (
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-slate-950/60">
            <ProfileFields
              form={form}
              setForm={setForm}
              providers={providers}
              modelOptionsByProvider={modelOptionsByProvider}
              disabled={isPending}
              idPrefix={profile.id}
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                className="agency-gradient text-white hover:brightness-105"
                disabled={
                  isPending ||
                  !form.name.trim() ||
                  !form.provider ||
                  !form.model.trim() ||
                  !runtimeTuningIsValid
                }
                onClick={handleSave}
              >
                {isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  reset();
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1.15fr)_minmax(13rem,1.2fr)_minmax(9rem,0.75fr)_minmax(12rem,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-neutral-950 dark:text-slate-50">{profile.name}</p>
                <Badge variant="outline" className={tone.badge}>
                  {providerNameFromId(providers, profile.provider)}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-neutral-500 dark:text-slate-400">
                {profile.description || fallbackBadgeLabel(profile)}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400 lg:hidden">
                Model
              </p>
              <p className="mt-1 truncate text-sm font-medium text-neutral-800 dark:text-slate-100 lg:mt-0">
                {profile.model}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                {fallbackBadgeLabel(profile)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {profile.temperature !== null && profile.temperature !== undefined ? (
                <Badge variant="outline">Temp: {profile.temperature}</Badge>
              ) : null}
              {profile.maxTokens !== null && profile.maxTokens !== undefined ? (
                <Badge variant="outline">Max tokens: {profile.maxTokens}</Badge>
              ) : null}
              {profile.topP !== null && profile.topP !== undefined ? (
                <Badge variant="outline">Top p: {profile.topP}</Badge>
              ) : null}
            </div>

            <div className="flex min-h-7 flex-wrap gap-2">
              {profile.supportsTools ? <Badge variant="outline">Tools</Badge> : null}
              {profile.supportsStructuredOutput ? (
                <Badge variant="outline">Structured output</Badge>
              ) : null}
              {profile.supportsVision ? <Badge variant="outline">Vision</Badge> : null}
              {profile.supportsStreaming ? <Badge variant="outline">Streaming</Badge> : null}
              {!profile.supportsTools &&
              !profile.supportsStructuredOutput &&
              !profile.supportsVision &&
              !profile.supportsStreaming ? (
                <span className="text-xs text-neutral-500 dark:text-slate-400">
                  No optional capabilities
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  reset();
                  setIsEditing(true);
                }}
              >
                Edit preset
              </Button>
              {deleteMode ? (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={handleDelete}
                  >
                    {isPending ? 'Deleting...' : 'Confirm delete'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setDeleteMode(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteMode(true)}
                >
                  Delete preset
                </Button>
              )}
            </div>
            {error ? (
              <p className="text-xs text-red-600 sm:col-span-2 lg:col-span-5">{error}</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BehaviorProfilesWorkspace() {
  const profilesQuery = useQuery({
    queryKey: queryKeys.backendBehaviorProfiles(),
    queryFn: () => behaviorProfilesApi.listProfiles(),
  });
  const providersQuery = useQuery({
    queryKey: ['backendModelProviders'],
    queryFn: async () => {
      const response = await modelProvidersApi.listProviders();
      return response.items;
    },
  });

  const providers = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);
  const providerModelsQuery = useQuery({
    queryKey: ['backendModelProviderModels', providers.map((provider) => provider.id).join(',')],
    enabled: providers.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        providers.map(async (provider) => {
          try {
            const response = await modelProvidersApi.listProviderModels(provider.id);
            return [provider.id, response.models] as const;
          } catch {
            return [
              provider.id,
              providerPresetForFamily(providerFamilyFromProvider(provider)).modelOptions,
            ] as const;
          }
        })
      );
      return Object.fromEntries(entries) as ProviderModelOptionsById;
    },
  });
  const modelOptionsByProvider = useMemo(
    () => providerModelsQuery.data ?? {},
    [providerModelsQuery.data]
  );
  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const assistantPageContext = useMemo(
    () => ({
      surface: 'model.list' as const,
      title: 'Models',
      description: 'LLM connections and selectable model presets for agents and workflows.',
      entities: [
        ...providers.slice(0, 8).map((provider) => ({
          type: 'model_provider',
          id: provider.id,
          name: provider.name,
        })),
        ...profiles.slice(0, 8).map((profile) => ({
          type: 'model_profile',
          id: profile.id,
          name: profile.name,
        })),
      ],
      summary: {
        providerCount: providers.length,
        profileCount: profiles.length,
        loading: profilesQuery.isLoading || providersQuery.isLoading,
        providerError: providersQuery.isError ? providersQuery.error.message : null,
        profileError: profilesQuery.isError ? profilesQuery.error.message : null,
      },
      allowedActions: ['model.inspect', 'model.configure', 'model.test'],
    }),
    [
      profiles,
      profilesQuery.error,
      profilesQuery.isError,
      profilesQuery.isLoading,
      providers,
      providersQuery.error,
      providersQuery.isError,
      providersQuery.isLoading,
    ]
  );
  useRegisterAssistantPageContext(assistantPageContext);

  const refreshAll = async () => {
    await Promise.all([
      profilesQuery.refetch(),
      providersQuery.refetch(),
      providerModelsQuery.refetch(),
    ]);
  };

  if (profilesQuery.isLoading || providersQuery.isLoading) {
    return <LoadingCard title="Models" description="Loading model configuration." />;
  }

  if (profilesQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load models"
        message={profilesQuery.error.message}
        onRetry={() => void refreshAll()}
      />
    );
  }

  if (providersQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load LLM connections"
        message={providersQuery.error.message}
        onRetry={() => void refreshAll()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={BrainCog}
        tone="model"
        title="Models"
        description="Set up LLM connections and selectable model presets for agents and workflows."
        actions={
          <>
            <CreateLlmModelDialog
              providers={providers}
              modelOptionsByProvider={modelOptionsByProvider}
              onRefresh={refreshAll}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void refreshAll()}
              disabled={profilesQuery.isFetching || providersQuery.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${profilesQuery.isFetching || providersQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </>
        }
      />

      <section className="flex flex-col gap-3" aria-labelledby="llm-connections-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="llm-connections-heading"
              className="text-xl font-semibold text-neutral-950 dark:text-slate-50"
            >
              LLM connections
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-slate-400">
              Provider endpoints and authentication shared by your model presets.
            </p>
          </div>
          <Badge variant="secondary">
            {providers.length} connection{providers.length === 1 ? '' : 's'}
          </Badge>
        </div>
        {providers.length === 0 ? (
          <EmptyCard
            title="No LLM connections found"
            description="Use Add Model to create a connection and first model preset together."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/45 dark:shadow-none">
            <div className="hidden grid-cols-[minmax(12rem,1.1fr)_minmax(15rem,1.5fr)_minmax(12rem,1fr)_auto] gap-4 border-b border-neutral-200 bg-neutral-50/80 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 lg:grid dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
              <span>Connection</span>
              <span>Endpoint</span>
              <span>Auth / status</span>
              <span className="text-right">Actions</span>
            </div>
            {providers.map((provider) => (
              <ProviderConnectionCard
                key={provider.id}
                provider={provider}
                linkedProfiles={profiles.filter((profile) => profile.provider === provider.id)}
                onRefresh={refreshAll}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="model-presets-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="model-presets-heading"
              className="text-xl font-semibold text-neutral-950 dark:text-slate-50"
            >
              Model presets
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-slate-400">
              Reusable model defaults that agents and workflows can select.
            </p>
          </div>
          <Badge variant="secondary">
            {profiles.length} preset{profiles.length === 1 ? '' : 's'}
          </Badge>
        </div>
        {profiles.length === 0 ? (
          <EmptyCard
            title="No models found"
            description="Create the first model preset to bind models to agents and workflows."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/45 dark:shadow-none">
            <div className="hidden grid-cols-[minmax(12rem,1.15fr)_minmax(13rem,1.2fr)_minmax(9rem,0.75fr)_minmax(12rem,1fr)_auto] gap-4 border-b border-neutral-200 bg-neutral-50/80 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 lg:grid dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
              <span>Preset</span>
              <span>Model</span>
              <span>Tuning</span>
              <span>Capabilities</span>
              <span className="text-right">Actions</span>
            </div>
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                providers={providers}
                modelOptionsByProvider={modelOptionsByProvider}
                onRefresh={refreshAll}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
