import type {
  ButtonHTMLAttributes,
  ComponentProps,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PersonaFactoryWorkspace from '@/components/persona-factory/PersonaFactoryWorkspace';

const { behaviorProfilesApi, conversationsApi, memoriesApi, personasApi, routerPush, toast } =
  vi.hoisted(() => ({
    behaviorProfilesApi: {
      listProfiles: vi.fn(),
    },
    conversationsApi: {
      createConversation: vi.fn(),
      postMessage: vi.fn(),
    },
    memoriesApi: {
      listMemories: vi.fn(),
    },
    personasApi: {
      listPersonas: vi.fn(),
      listVersions: vi.fn(),
      listSources: vi.fn(),
      listRuns: vi.fn(),
      getGraphContext: vi.fn(),
      getGovernanceLabels: vi.fn(),
      getItemTypes: vi.fn(),
      distill: vi.fn(),
      getRun: vi.fn(),
      getRunSourceMap: vi.fn(),
      getRunSource: vi.fn(),
      updateRunSourceClassification: vi.fn(),
      redistillRunSource: vi.fn(),
      listRunItems: vi.fn(),
      updateItem: vi.fn(),
      approveItem: vi.fn(),
      rejectItem: vi.fn(),
      bulkReviewItems: vi.fn(),
      bulkReviewRunItems: vi.fn(),
      previewBulkReviewRunItems: vi.fn(),
      normalizeRun: vi.fn(),
      synthesizeRun: vi.fn(),
      updateRunPackage: vi.fn(),
      approveRun: vi.fn(),
      publishRun: vi.fn(),
      updatePersona: vi.fn(),
      archivePersona: vi.fn(),
    },
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    routerPush: vi.fn(),
  }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock('@/lib/api/backend/behaviorProfiles', () => ({
  behaviorProfilesApi,
}));

vi.mock('@/lib/api/backend/conversations', () => ({
  conversationsApi,
}));

vi.mock('@/lib/api/backend/memory', () => ({
  memoriesApi,
}));

vi.mock('@/lib/api/backend/personas', () => ({
  personasApi,
}));

vi.mock('sonner', () => ({
  toast,
}));

vi.mock('@/components/app-shell/PageHeader', () => ({
  default: ({
    actions,
    description,
    title,
  }: {
    actions?: ReactNode;
    description?: ReactNode;
    title: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
}));

vi.mock('@/components/memory-app/DocumentIngestionControl', () => ({
  default: ({ title }: { title: string }) => <section>{title}</section>,
}));

vi.mock('@/components/memory-app/UploadedDocumentsList', () => ({
  default: ({ description, title }: { description?: string; title: string }) => (
    <section>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </section>
  ),
}));

vi.mock('@/components/agent-app/StatePanels', () => ({
  EmptyCard: ({ description, title }: { description: string; title: string }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
  ErrorAlert: ({ message, title }: { message: string; title: string }) => (
    <div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  ),
  LoadingCard: ({ description, title }: { description: string; title: string }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/components/library/shadcn/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/library/shadcn/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/library/shadcn/textarea', () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/library/shadcn/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/library/shadcn/badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/library/shadcn/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/library/shadcn/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/library/shadcn/tabs', () => ({
  Tabs: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => (
    <div
      onClick={(event) => {
        const target = event.target as HTMLElement;
        const trigger = target.closest('[data-tab-value]');
        const value = trigger?.getAttribute('data-tab-value');
        if (value) {
          onValueChange?.(value);
        }
      }}
    >
      {children}
    </div>
  ),
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: ReactNode; value?: string }) => (
    <button data-tab-value={value} type="button">
      {children}
    </button>
  ),
}));

function renderWorkspace(props: Partial<ComponentProps<typeof PersonaFactoryWorkspace>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PersonaFactoryWorkspace {...props} />
    </QueryClientProvider>
  );
}

describe('PersonaFactoryWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    personasApi.listPersonas.mockResolvedValue({
      items: [
        {
          id: 'persona-1',
          name: 'Audit Manager',
          slug: 'audit-manager',
          status: 'published',
          description: 'Reviews audit evidence.',
          metadata: {},
          current_version_id: 'version-1',
          published_agent_id: 'agent-persona-1',
        },
      ],
    });
    personasApi.listVersions.mockResolvedValue({
      items: [
        {
          id: 'version-1',
          persona_id: 'persona-1',
          version: 'v1',
          status: 'published',
          package: {
            schema_version: 1,
            persona: {},
            knowledge: [],
            decision_patterns: [],
            workflows: [],
            tools: [],
            guardrails: [],
            examples: [],
            memory_layers: {},
            runtime: {},
            provenance: {},
          },
        },
      ],
    });
    personasApi.listSources.mockResolvedValue({ items: [] });
    personasApi.listRuns.mockResolvedValue({ items: [] });
    personasApi.getGraphContext.mockResolvedValue({
      persona: {
        id: 'persona-1',
        name: 'Audit Manager',
        slug: 'audit-manager',
        status: 'published',
        metadata: {},
      },
      status: 'ok',
      policy: {
        preset: 'persona_lineage',
        fallback: 'surface_graph_read_error_to_caller',
        source_priority: ['persona_package', 'approved_persona_memory', 'persona_graph_context'],
      },
      prompt: '# Persona Graph Context\n- [Workflow] Release Workflow',
      graph: {
        nodes: [
          {
            id: 'persona-1',
            type: 'Persona',
            labels: ['Persona'],
            properties: { name: 'Audit Manager' },
          },
          {
            id: 'workflow-release',
            type: 'Workflow',
            labels: ['Workflow'],
            properties: { name: 'Release Workflow' },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'persona-1',
            target: 'workflow-release',
            type: 'PERSONA_FOLLOWS_WORKFLOW',
          },
        ],
      },
    });
    personasApi.getGovernanceLabels.mockResolvedValue({
      defaults: {
        persona_type: 'professional',
        capability_mode: 'assistive',
        consent_status: 'provided',
        source_basis: 'uploaded',
        sensitivity_level: 'internal',
        visibility: 'private',
      },
      allowed_values: {
        persona_type: ['professional', 'personal'],
        capability_mode: ['assistive'],
        consent_status: ['provided'],
        source_basis: ['uploaded'],
        sensitivity_level: ['internal'],
        visibility: ['private', 'organization', 'marketplace'],
      },
      validation_rules: [],
    });
    personasApi.getItemTypes.mockResolvedValue({
      item_types: ['domain_knowledge', 'guardrail'],
      memory_layers: ['semantic', 'procedural'],
      review_statuses: ['needs_review', 'approved'],
      source_classifications: ['policy_sop', 'workflow', 'domain_knowledge'],
      document_kinds: ['policy_sop', 'ticket', 'unknown'],
      distillation_modes: ['llm', 'deterministic', 'hybrid'],
      llm_model_sources: ['main_agent', 'model_profile'],
      model_profiles: [],
      operational_settings: {
        default_distillation_mode: 'llm',
        default_llm_model_source: 'main_agent',
        llm_distillation_enabled: true,
        hybrid_distillation_enabled: true,
      },
    });
    personasApi.distill.mockResolvedValue({
      persona: {
        id: 'persona-2',
        name: 'New Persona',
        slug: 'new-persona',
        status: 'draft',
        metadata: {},
      },
      run: {
        id: 'run-1',
        persona_id: 'persona-2',
        status: 'needs_review',
        input_source_ids: ['memory-1'],
        output_package: {
          schema_version: 1,
          persona: {},
          knowledge: [],
          decision_patterns: [],
          workflows: [],
          tools: [],
          guardrails: [],
          examples: [],
          memory_layers: {},
          runtime: {},
          provenance: {},
        },
        warnings: [],
        errors: [],
      },
      sources: [],
      items: [],
    });
    personasApi.getRun.mockResolvedValue({
      persona: {
        id: 'persona-2',
        name: 'New Persona',
        slug: 'new-persona',
        status: 'draft',
        metadata: {},
      },
      run: {
        id: 'run-1',
        persona_id: 'persona-2',
        status: 'needs_review',
        input_source_ids: ['memory-1'],
        output_package: {
          schema_version: 1,
          persona: {},
          knowledge: [],
          decision_patterns: [],
          workflows: [],
          tools: [],
          guardrails: [],
          examples: [],
          memory_layers: {},
          runtime: {},
          provenance: {},
        },
        warnings: [],
        errors: [],
      },
      sources: [],
      items: [],
    });
    personasApi.getRunSourceMap.mockResolvedValue({
      run_id: 'run-1',
      persona_id: 'persona-2',
      source_count: 0,
      item_count: 0,
      needs_review_count: 0,
      items: [],
    });
    personasApi.getRunSource.mockResolvedValue({
      run_id: 'run-1',
      persona_id: 'persona-2',
      source: {
        key: 'doc-intel',
        label: 'release-sop.md',
        memory_id: 'memory-1',
        document_id: 'doc-intel',
        document_kind: 'policy_sop',
        classification: 'policy_sop',
        source_ref: {},
        item_count: 1,
        needs_review_count: 0,
        approved_count: 0,
        rejected_count: 0,
        review_statuses: {},
        item_types: {},
        memory_layers: {},
        distillers: ['guardrail_distiller'],
        vector_tags: ['release'],
        extraction_targets: [],
        content_roles: [],
        review_flags: [],
        item_ids: ['item-1'],
      },
      items: [],
      total: 1,
      filtered_count: 1,
      limit: 10,
      offset: 0,
      filters: {},
      counts: {},
    });
    personasApi.listRunItems.mockResolvedValue({
      items: [],
      total: 0,
      filtered_count: 0,
      limit: 50,
      offset: 0,
      filters: {},
      counts: {},
    });
    personasApi.bulkReviewRunItems.mockResolvedValue({
      run_id: 'run-1',
      action: 'approve',
      count: 0,
      matched_count: 0,
      reviewable_count: 0,
      limit: 250,
      has_more: false,
      filters: {},
      items: [],
    });
    personasApi.previewBulkReviewRunItems.mockResolvedValue({
      run_id: 'run-1',
      action: 'approve',
      count: 0,
      matched_count: 0,
      reviewable_count: 0,
      limit: 250,
      has_more: false,
      filters: {},
      items: [],
    });
    personasApi.updateRunSourceClassification.mockResolvedValue({
      run_id: 'run-1',
      persona_id: 'persona-2',
      source_key: 'doc-intel',
      classification: {
        label: 'workflow',
        document_kind: 'ticket',
        vector_tags: ['release', 'manual-flow'],
      },
      updated_memory_ids: ['memory-1'],
      updated_item_count: 1,
      source_detail: {
        run_id: 'run-1',
        persona_id: 'persona-2',
        source: {
          key: 'doc-intel',
          label: 'release-sop.md',
          memory_id: 'memory-1',
          document_id: 'doc-intel',
          document_kind: 'ticket',
          classification: 'workflow',
          source_ref: {},
          item_count: 1,
          needs_review_count: 0,
          approved_count: 0,
          rejected_count: 0,
          review_statuses: {},
          item_types: {},
          memory_layers: {},
          distillers: ['workflow_distiller'],
          vector_tags: ['release', 'manual-flow'],
          extraction_targets: ['workflow'],
          content_roles: ['workflow'],
          review_flags: [],
          item_ids: ['item-1'],
        },
        items: [],
        total: 1,
        filtered_count: 1,
        limit: 10,
        offset: 0,
        filters: {},
        counts: {},
      },
    });
    personasApi.redistillRunSource.mockResolvedValue({
      run_id: 'run-1',
      persona_id: 'persona-2',
      source_key: 'doc-intel',
      superseded_count: 0,
      created_count: 0,
      superseded_items: [],
      items: [],
      source_detail: {
        run_id: 'run-1',
        persona_id: 'persona-2',
        source: {
          key: 'doc-intel',
          label: 'release-sop.md',
          memory_id: 'memory-1',
          document_id: 'doc-intel',
          document_kind: 'policy_sop',
          classification: 'policy_sop',
          source_ref: {},
          item_count: 1,
          needs_review_count: 0,
          approved_count: 0,
          rejected_count: 0,
          review_statuses: {},
          item_types: {},
          memory_layers: {},
          distillers: ['guardrail_distiller'],
          vector_tags: ['release'],
          extraction_targets: [],
          content_roles: [],
          review_flags: [],
          item_ids: ['item-1'],
        },
        items: [],
        total: 1,
        filtered_count: 1,
        limit: 10,
        offset: 0,
        filters: {},
        counts: {},
      },
    });
    memoriesApi.listMemories.mockResolvedValue({
      items: [
        {
          id: 'memory-1',
          memory_type: 'archive',
          source: 'upload',
          summary: 'Audit SOP',
          content: 'Review workpapers.',
          metadata: { filename: 'audit.md' },
        },
      ],
    });
    behaviorProfilesApi.listProfiles.mockResolvedValue([
      {
        id: 'profile-1',
        name: 'Codex',
        provider: 'openai-codex',
        model: 'gpt-5.4',
      },
    ]);
    personasApi.archivePersona.mockResolvedValue({ deleted: true });
  });

  it('loads model profiles and requires name plus source before distillation', async () => {
    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'New Persona' }));
    expect(await screen.findByText('1. Identity')).toBeInTheDocument();
    expect(screen.getByText('2. Distillation')).toBeInTheDocument();
    expect(screen.getByText('3. Select sources')).toBeInTheDocument();
    expect(screen.getByText('Uploaded source files')).toBeInTheDocument();
    expect(await screen.findByText('Codex · openai-codex/gpt-5.4')).toBeInTheDocument();
    expect(screen.getByLabelText('Distillation mode')).toHaveValue('llm');
    expect(screen.getByLabelText('LLM source')).toHaveValue('main_agent');

    const generateButton = screen.getByRole('button', { name: /Generate draft/i });
    expect(generateButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Audit Persona' } });
    expect(generateButton).toBeDisabled();

    fireEvent.click(screen.getByText('audit.md'));
    expect(screen.getByText('Selected source summary')).toBeInTheDocument();
    expect(screen.getAllByText(/archive/).length).toBeGreaterThan(0);
    expect(generateButton).toBeEnabled();
    fireEvent.click(screen.getByLabelText('Remove audit.md from selected sources'));
    expect(generateButton).toBeDisabled();
    fireEvent.click(screen.getByText('audit.md'));
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(personasApi.distill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Audit Persona',
          source_memory_ids: ['memory-1'],
          distillation_mode: 'llm',
          llm_model_source: 'main_agent',
          model_profile_id: null,
        })
      );
    });
  });

  it('lets users choose deterministic distillation from the create dialog', async () => {
    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'New Persona' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Audit Persona' } });
    fireEvent.click(screen.getByText('audit.md'));
    fireEvent.change(screen.getByLabelText('Distillation mode'), {
      target: { value: 'deterministic' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate draft/i }));

    await waitFor(() => {
      expect(personasApi.distill).toHaveBeenCalledWith(
        expect.objectContaining({
          distillation_mode: 'deterministic',
          llm_model_source: null,
          model_profile_id: null,
        })
      );
    });
  });

  it('hides marketplace governance visibility', async () => {
    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'New Persona' }));
    fireEvent.click(screen.getByText('4. Optional governance labels'));

    const visibilitySelect = screen.getByLabelText('visibility') as HTMLSelectElement;
    const optionLabels = Array.from(visibilitySelect.options).map((option) => option.value);

    expect(optionLabels).toContain('private');
    expect(optionLabels).toContain('organization');
    expect(optionLabels).not.toContain('marketplace');
  });

  it('shows distillation provenance for extracted persona items', async () => {
    const extractedItem = {
      id: 'item-1',
      run_id: 'run-1',
      persona_id: 'persona-2',
      source_memory_id: 'memory-1',
      item_type: 'guardrail',
      memory_layer: 'semantic',
      title: 'Guardrail: release approval',
      content: 'Teams must not bypass change approval.',
      confidence: 0.84,
      needs_review: false,
      review_status: 'draft',
      metadata: {
        distiller: 'guardrail_distiller',
        source_classification: 'policy_sop',
      },
      structured_payload: {
        extractor: 'deterministic-multi-distiller-v1',
        distiller: 'guardrail_distiller',
        distiller_version: 'specialized-distillers-v1',
        routing: {
          label: 'policy_sop',
          document_kind: 'policy_sop',
          extraction_targets: ['domain_knowledge', 'workflow', 'guardrail'],
          memory_layers: ['procedural', 'semantic'],
          vector_tags: ['release', 'approval'],
        },
        source_classification: {
          label: 'policy_sop',
          confidence: 0.91,
          document_kind: 'policy_sop',
        },
        source_ref: {
          memory_id: 'memory-1',
          document_id: 'doc-intel',
          filename: 'release-sop.md',
          content_sha256: 'sha-test',
          storage_uri: 'memory://doc-intel',
          upload_mode: 'vector',
          chunk_index: 0,
          chunk_count: 1,
          document_kind: 'policy_sop',
          upload_intelligence_source: 'main_agent_llm',
          source_intelligence_review_status: 'approved',
        },
        review_flags: ['source_backed'],
      },
    } as const;
    personasApi.bulkReviewItems.mockResolvedValueOnce({
      action: 'approve',
      count: 1,
      items: [
        {
          ...extractedItem,
          review_status: 'approved',
        },
      ],
    });
    personasApi.listRunItems.mockResolvedValue({
      items: [extractedItem],
      total: 1,
      filtered_count: 1,
      limit: 50,
      offset: 0,
      filters: {},
      counts: {
        item_types: { guardrail: 1 },
        memory_layers: { procedural: 1 },
        review_statuses: { draft: 1 },
      },
    });
    personasApi.bulkReviewRunItems.mockResolvedValueOnce({
      run_id: 'run-1',
      action: 'approve',
      count: 1,
      matched_count: 1,
      reviewable_count: 1,
      limit: 250,
      has_more: false,
      filters: {
        source_key: 'doc-intel',
      },
      items: [
        {
          ...extractedItem,
          review_status: 'approved',
        },
      ],
    });
    personasApi.previewBulkReviewRunItems.mockResolvedValueOnce({
      run_id: 'run-1',
      action: 'approve',
      count: 1,
      matched_count: 1,
      reviewable_count: 1,
      limit: 250,
      has_more: false,
      filters: {
        source_key: 'doc-intel',
      },
      items: [extractedItem],
    });
    personasApi.distill.mockResolvedValueOnce({
      persona: {
        id: 'persona-2',
        name: 'New Persona',
        slug: 'new-persona',
        status: 'draft',
        metadata: {},
      },
      run: {
        id: 'run-1',
        persona_id: 'persona-2',
        status: 'needs_review',
        input_source_ids: ['memory-1'],
        output_package: {
          schema_version: 1,
          persona: {},
          knowledge: [],
          decision_patterns: [],
          workflows: [],
          tools: [],
          guardrails: [],
          examples: [],
          memory_layers: {},
          runtime: {},
          provenance: {},
        },
        warnings: [],
        errors: [],
      },
      sources: [],
      items: [extractedItem],
    });

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'New Persona' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Audit Persona' } });
    fireEvent.click(screen.getByText('audit.md'));
    fireEvent.click(screen.getByRole('button', { name: /Generate draft/i }));

    fireEvent.click(await screen.findByText('Review by source'));
    expect(await screen.findByText('Review items by source')).toBeInTheDocument();
    fireEvent.click(await screen.findByText('release approval'));
    expect(await screen.findByText('Why this was suggested')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Why this was suggested/i }));
    expect(screen.getAllByText('1 items').length).toBeGreaterThan(0);
    expect(screen.getAllByText('guardrail_distiller').length).toBeGreaterThan(0);
    expect(screen.getAllByText('policy_sop').length).toBeGreaterThan(0);
    expect(screen.getByText('specialized-distillers-v1')).toBeInTheDocument();
    expect(screen.getByText('main_agent_llm')).toBeInTheDocument();
    expect(screen.getByText('release')).toBeInTheDocument();
    expect(screen.getByText('source_backed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Fix or re-check source release-sop.md' }));
    expect((await screen.findAllByText('Fix source type')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Source type'), { target: { value: 'workflow' } });
    fireEvent.change(screen.getByLabelText('Document kind'), { target: { value: 'ticket' } });
    fireEvent.change(screen.getByLabelText('Search tags'), {
      target: { value: 'release, manual-flow' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save classification/i }));
    await waitFor(() => {
      expect(personasApi.updateRunSourceClassification).toHaveBeenCalledWith(
        'run-1',
        'doc-intel',
        expect.objectContaining({
          classification: 'workflow',
          document_kind: 'ticket',
          vector_tags: ['release', 'manual-flow'],
        })
      );
    });
    personasApi.redistillRunSource.mockResolvedValueOnce({
      run_id: 'run-1',
      persona_id: 'persona-2',
      source_key: 'doc-intel',
      superseded_count: 1,
      created_count: 1,
      superseded_items: [{ ...extractedItem, review_status: 'superseded' }],
      items: [
        {
          ...extractedItem,
          id: 'item-redistilled',
          title: 'Workflow: release approval',
          item_type: 'workflow',
          review_status: 'draft',
        },
      ],
      source_detail: {
        run_id: 'run-1',
        persona_id: 'persona-2',
        source: {
          key: 'doc-intel',
          label: 'release-sop.md',
          memory_id: 'memory-1',
          document_id: 'doc-intel',
          document_kind: 'ticket',
          classification: 'workflow',
          source_ref: {},
          item_count: 2,
          needs_review_count: 0,
          approved_count: 0,
          rejected_count: 0,
          review_statuses: { superseded: 1, draft: 1 },
          item_types: { workflow: 1 },
          memory_layers: { procedural: 1 },
          distillers: ['workflow_distiller'],
          vector_tags: ['release', 'manual-flow'],
          extraction_targets: ['workflow'],
          content_roles: ['workflow'],
          review_flags: [],
          item_ids: ['item-redistilled'],
        },
        items: [],
        total: 2,
        filtered_count: 2,
        limit: 10,
        offset: 0,
        filters: {},
        counts: {},
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Re-distill source/i }));
    await waitFor(() => {
      expect(personasApi.redistillRunSource).toHaveBeenCalledWith('run-1', 'doc-intel', {
        limit: 250,
      });
    });
    expect(await screen.findByText('Re-distill Before / After')).toBeInTheDocument();
    expect(screen.getAllByText('release approval').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Approve visible/i }));
    await waitFor(() => {
      expect(personasApi.bulkReviewItems).toHaveBeenCalledWith({
        action: 'approve',
        item_ids: ['item-1'],
        reason: null,
      });
    });
    await waitFor(() => {
      expect(screen.getAllByText('approved').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Approve filtered/i }));
    await waitFor(() => {
      expect(personasApi.previewBulkReviewRunItems).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          action: 'approve',
          limit: 250,
        })
      );
    });
    expect(await screen.findByText('Approve filtered items?')).toBeInTheDocument();
    const approveFilteredButtons = screen.getAllByRole('button', { name: /Approve filtered/i });
    fireEvent.click(approveFilteredButtons[approveFilteredButtons.length - 1]);
    await waitFor(() => {
      expect(personasApi.bulkReviewRunItems).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          action: 'approve',
          limit: 250,
        })
      );
    });
  });

  it('shows persona details inline on the dedicated detail page', async () => {
    renderWorkspace({ initialPersonaId: 'persona-1', viewMode: 'detail' });

    expect(await screen.findByText('Show more persona details')).toBeInTheDocument();
    expect(await screen.findByText('Runtime details')).toBeInTheDocument();
    expect(await screen.findByText('Package details')).toBeInTheDocument();
    expect(screen.getByText('Source lineage')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Audit Manager');
    expect(screen.getByLabelText('Connected knowledge view')).toHaveValue('persona_lineage');
    expect((await screen.findAllByText('v1')).length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText('Connected knowledge')).toBeInTheDocument();
    expect(await screen.findByText('Release Workflow')).toBeInTheDocument();
    expect(personasApi.listVersions).toHaveBeenCalledWith('persona-1');
    expect(personasApi.listSources).toHaveBeenCalledWith('persona-1');
    expect(personasApi.listRuns).toHaveBeenCalledWith({ persona_id: 'persona-1' });
    expect(personasApi.getGraphContext).toHaveBeenCalledWith('persona-1', {
      limit: 24,
      preset: 'persona_lineage',
      query: undefined,
    });
  });

  it('refetches connected knowledge when switching graph context presets', async () => {
    renderWorkspace({ initialPersonaId: 'persona-1', viewMode: 'detail' });

    const presetSelect = await screen.findByLabelText('Connected knowledge view');
    fireEvent.change(presetSelect, { target: { value: 'persona_capability_map' } });

    await waitFor(() => {
      expect(personasApi.getGraphContext).toHaveBeenCalledWith('persona-1', {
        limit: 24,
        preset: 'persona_capability_map',
        query: undefined,
      });
    });
  });

  it('shows connected-knowledge provenance after runtime invocation', async () => {
    personasApi.listRuns.mockImplementation((query?: { persona_id?: string }) => {
      if (query?.persona_id === 'persona-1') {
        return Promise.resolve({
          items: [
            {
              id: 'run-selected',
              persona_id: 'persona-1',
              status: 'completed',
              input_source_ids: ['memory-1'],
              output_package: {
                schema_version: 1,
                persona: {},
                knowledge: [],
                decision_patterns: [],
                workflows: [],
                tools: [],
                guardrails: [],
                examples: [],
                memory_layers: {},
                runtime: {},
                provenance: {},
              },
              warnings: [],
              errors: [],
              created_at: '2026-05-30T00:00:00.000Z',
            },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    personasApi.getRun.mockResolvedValueOnce({
      persona: {
        id: 'persona-1',
        name: 'Audit Manager',
        slug: 'audit-manager',
        status: 'published',
        metadata: {},
      },
      run: {
        id: 'run-selected',
        persona_id: 'persona-1',
        status: 'completed',
        input_source_ids: ['memory-1'],
        output_package: {
          schema_version: 1,
          persona: {},
          knowledge: [],
          decision_patterns: [],
          workflows: [],
          tools: [],
          guardrails: [],
          examples: [],
          memory_layers: {},
          runtime: {},
          provenance: {},
        },
        warnings: [],
        errors: [],
      },
      sources: [],
      items: [],
    });
    conversationsApi.createConversation.mockResolvedValue({
      id: 'conversation-1',
      channel_type: 'api',
      status: 'open',
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    });
    conversationsApi.postMessage.mockResolvedValue({
      message: {
        id: 'message-user',
        conversation_id: 'conversation-1',
        role: 'user',
        message_type: 'user_text',
        plain_text: '@audit-manager Summarize what you can help with.',
        created_at: '2026-06-01T00:00:00.000Z',
      },
      assistant_message: {
        id: 'message-assistant',
        conversation_id: 'conversation-1',
        role: 'assistant',
        message_type: 'assistant_text',
        plain_text: 'I can review release evidence.',
        created_at: '2026-06-01T00:00:01.000Z',
        metadata: {
          persona_provenance: {
            runtime_context: {
              graph_context: {
                status: 'used',
                node_count: 2,
                edge_count: 1,
                policy: {
                  preset: 'persona_lineage',
                  fallback: 'skip_graph_context_without_failing_invocation',
                  source_priority: [
                    'persona_package',
                    'approved_persona_memory',
                    'persona_graph_context',
                    'conversation_context',
                  ],
                },
              },
            },
          },
        },
      },
    });

    renderWorkspace({ initialPersonaId: 'persona-1', viewMode: 'detail' });

    const invokeButton = await screen.findByRole('button', { name: /Invoke @audit-manager/i });
    await waitFor(() => {
      expect(invokeButton).not.toBeDisabled();
    });
    fireEvent.click(invokeButton);

    expect(await screen.findByText('I can review release evidence.')).toBeInTheDocument();
    expect(await screen.findByText('Connected knowledge used')).toBeInTheDocument();
    expect(screen.getByText('used')).toBeInTheDocument();
    expect(screen.getByText(/View: persona_lineage/)).toBeInTheDocument();
    expect(conversationsApi.postMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^persona-runtime-/),
      expect.objectContaining({
        response_mode: 'sync',
      })
    );
  });

  it('routes persona cards to the dedicated detail page', async () => {
    renderWorkspace();

    const personaCard = await screen.findByRole('button', { name: 'Select Audit Manager' });

    expect(screen.queryByLabelText('View Audit Manager details')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete Audit Manager')).not.toBeInTheDocument();

    fireEvent.click(personaCard);

    expect(routerPush).toHaveBeenCalledWith('/persona/persona-1');
  });

  it('deletes a persona from the detail page after confirmation', async () => {
    renderWorkspace({ initialPersonaId: 'persona-1', viewMode: 'detail' });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete persona' }));
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(personasApi.archivePersona).toHaveBeenCalledWith('persona-1');
    });
    expect(routerPush).toHaveBeenCalledWith('/persona');
    expect(toast.success).toHaveBeenCalledWith('Persona deleted.', { position: 'top-right' });
  });

  it('loads the selected persona latest run into the active result panel', async () => {
    personasApi.listRuns.mockImplementation((query?: { persona_id?: string }) => {
      if (query?.persona_id === 'persona-1') {
        return Promise.resolve({
          items: [
            {
              id: 'run-selected',
              persona_id: 'persona-1',
              status: 'needs_review',
              input_source_ids: ['memory-1'],
              output_package: {
                schema_version: 1,
                persona: {},
                knowledge: [],
                decision_patterns: [],
                workflows: [],
                tools: [],
                guardrails: [],
                examples: [],
                memory_layers: {},
                runtime: {},
                provenance: {},
              },
              warnings: [],
              errors: [],
              created_at: '2026-05-30T00:00:00.000Z',
            },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    personasApi.getRun.mockResolvedValueOnce({
      persona: {
        id: 'persona-1',
        name: 'Audit Manager',
        slug: 'audit-manager',
        status: 'published',
        metadata: {},
      },
      run: {
        id: 'run-selected',
        persona_id: 'persona-1',
        status: 'needs_review',
        input_source_ids: ['memory-1'],
        output_package: {
          schema_version: 1,
          persona: {},
          knowledge: [],
          decision_patterns: [],
          workflows: [],
          tools: [],
          guardrails: [],
          examples: [],
          memory_layers: {},
          runtime: {},
          provenance: {},
        },
        warnings: [],
        errors: [],
      },
      sources: [],
      items: [],
    });

    renderWorkspace({ initialPersonaId: 'persona-1', viewMode: 'detail' });

    await waitFor(() => {
      expect(personasApi.getRun).toHaveBeenCalledWith('run-selected');
    });
    expect(await screen.findByText('Review workspace')).toBeInTheDocument();
  });

  it('activates publish step and runs approve before publish', async () => {
    const outputPackage = {
      schema_version: 1,
      persona: {},
      knowledge: [],
      decision_patterns: [],
      workflows: [],
      tools: [],
      guardrails: [],
      examples: [],
      memory_layers: {},
      runtime: {},
      provenance: {},
    };
    const run = {
      id: 'run-selected',
      persona_id: 'persona-1',
      status: 'needs_review' as const,
      input_source_ids: ['memory-1'],
      output_package: outputPackage,
      warnings: [],
      errors: [],
      created_at: '2026-05-30T00:00:00.000Z',
    };
    const persona = {
      id: 'persona-1',
      name: 'Audit Manager',
      slug: 'audit-manager',
      status: 'in_review' as const,
      metadata: {},
    };
    const approvedPersona = { ...persona, status: 'approved' as const };
    const publishedPersona = {
      ...persona,
      status: 'published' as const,
      published_agent_id: 'agent-1',
    };

    personasApi.listRuns.mockImplementation((query?: { persona_id?: string }) => {
      if (query?.persona_id === 'persona-1') {
        return Promise.resolve({ items: [run] });
      }
      return Promise.resolve({ items: [] });
    });
    personasApi.getRun.mockResolvedValueOnce({
      persona,
      run,
      sources: [],
      items: [],
    });
    personasApi.approveRun.mockResolvedValueOnce({
      persona: approvedPersona,
      run: { ...run, status: 'completed' },
      persona_version: {
        id: 'version-approved',
        persona_id: 'persona-1',
        version: 'v2',
        status: 'approved',
        package: outputPackage,
      },
    });
    personasApi.publishRun.mockResolvedValueOnce({
      persona: publishedPersona,
      persona_version: {
        id: 'version-published',
        persona_id: 'persona-1',
        version: 'v2',
        status: 'published',
        package: outputPackage,
        published_at: '2026-06-01T00:00:00.000Z',
      },
      agent: {
        id: 'agent-1',
        name: 'Audit Manager',
      },
      memory_ids: ['memory-1'],
    });

    renderWorkspace({ initialPersonaId: 'persona-1', viewMode: 'detail' });

    expect(await screen.findByText('Review workspace')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '4. Publish' }));

    const lifecycleApproveButton = screen.getByRole('button', { name: 'Approve' });
    expect(lifecycleApproveButton).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Publish Persona' })).toBeDisabled();

    fireEvent.click(lifecycleApproveButton);

    await waitFor(() => {
      expect(personasApi.approveRun).toHaveBeenCalledWith('run-selected');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Publish Persona' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish Persona' }));

    await waitFor(() => {
      expect(personasApi.publishRun).toHaveBeenCalledWith('run-selected');
    });
    expect(toast.success).toHaveBeenCalledWith('Persona published.', { position: 'top-right' });
  });

  it('keeps the lifecycle grid on review while the review tab is selected', async () => {
    const outputPackage = {
      schema_version: 1,
      persona: {},
      knowledge: [],
      decision_patterns: [],
      workflows: [],
      tools: [],
      guardrails: [],
      examples: [],
      memory_layers: {},
      runtime: {},
      provenance: {},
    };
    personasApi.listRuns.mockImplementation((query?: { persona_id?: string }) => {
      if (query?.persona_id === 'persona-1') {
        return Promise.resolve({
          items: [
            {
              id: 'run-selected',
              persona_id: 'persona-1',
              status: 'needs_review',
              input_source_ids: ['memory-1'],
              output_package: outputPackage,
              warnings: [],
              errors: [],
              created_at: '2026-05-30T00:00:00.000Z',
            },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    personasApi.getRun.mockResolvedValueOnce({
      persona: {
        id: 'persona-1',
        name: 'Audit Manager',
        slug: 'audit-manager',
        status: 'in_review',
        metadata: {},
      },
      run: {
        id: 'run-selected',
        persona_id: 'persona-1',
        status: 'needs_review',
        input_source_ids: ['memory-1'],
        output_package: outputPackage,
        warnings: [],
        errors: [],
      },
      sources: [],
      items: [],
    });

    const { container } = renderWorkspace({ initialPersonaId: 'persona-1', viewMode: 'detail' });

    expect(await screen.findByText('Review workspace')).toBeInTheDocument();
    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('Review');
  });

  it('keeps the lifecycle grid on package after synthesizing a published persona draft', async () => {
    const outputPackage = {
      schema_version: 1,
      persona: {},
      knowledge: [],
      decision_patterns: [],
      workflows: [],
      tools: [],
      guardrails: [],
      examples: [],
      memory_layers: {},
      runtime: {},
      provenance: {},
    };
    const run = {
      id: 'run-selected',
      persona_id: 'persona-1',
      status: 'needs_review' as const,
      input_source_ids: ['memory-1'],
      output_package: outputPackage,
      warnings: [],
      errors: [],
      created_at: '2026-05-30T00:00:00.000Z',
    };
    const persona = {
      id: 'persona-1',
      name: 'Audit Manager',
      slug: 'audit-manager',
      status: 'published' as const,
      metadata: {},
    };

    personasApi.listRuns.mockImplementation((query?: { persona_id?: string }) => {
      if (query?.persona_id === 'persona-1') {
        return Promise.resolve({ items: [run] });
      }
      return Promise.resolve({ items: [] });
    });
    personasApi.getRun.mockResolvedValueOnce({
      persona,
      run,
      sources: [],
      items: [],
    });
    personasApi.synthesizeRun.mockResolvedValueOnce({
      persona,
      run: {
        ...run,
        output_package: {
          ...outputPackage,
          knowledge: [{ title: 'Release approvals', content: 'Use change records.' }],
        },
      },
      sources: [],
      items: [],
    });

    const { container } = renderWorkspace({ initialPersonaId: 'persona-1', viewMode: 'detail' });

    expect(await screen.findByText('Review workspace')).toBeInTheDocument();
    const synthesizeButton = screen
      .getAllByRole('button', { name: 'Synthesize' })
      .find((button) => !(button as HTMLButtonElement).disabled);
    expect(synthesizeButton).toBeDefined();

    fireEvent.click(synthesizeButton as HTMLButtonElement);

    await waitFor(() => {
      expect(personasApi.synthesizeRun).toHaveBeenCalledWith('run-selected');
    });
    await waitFor(() => {
      expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('Package');
    });
  });

  it('moves to publish after saving the package', async () => {
    const outputPackage = {
      schema_version: 1,
      persona: {},
      knowledge: [],
      decision_patterns: [],
      workflows: [],
      tools: [],
      guardrails: [],
      examples: [],
      memory_layers: {},
      runtime: {},
      provenance: {},
    };
    const run = {
      id: 'run-selected',
      persona_id: 'persona-1',
      status: 'needs_review' as const,
      input_source_ids: ['memory-1'],
      output_package: outputPackage,
      warnings: [],
      errors: [],
      created_at: '2026-05-30T00:00:00.000Z',
    };
    const persona = {
      id: 'persona-1',
      name: 'Audit Manager',
      slug: 'audit-manager',
      status: 'in_review' as const,
      metadata: {},
    };

    personasApi.listRuns.mockImplementation((query?: { persona_id?: string }) => {
      if (query?.persona_id === 'persona-1') {
        return Promise.resolve({ items: [run] });
      }
      return Promise.resolve({ items: [] });
    });
    personasApi.getRun.mockResolvedValueOnce({
      persona,
      run,
      sources: [],
      items: [],
    });
    personasApi.updateRunPackage.mockResolvedValueOnce(run);

    const { container } = renderWorkspace({ initialPersonaId: 'persona-1', viewMode: 'detail' });

    expect(await screen.findByText('Review workspace')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '3. Package' }));
    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('Package');

    fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));

    await waitFor(() => {
      expect(personasApi.updateRunPackage).toHaveBeenCalledWith('run-selected', outputPackage);
    });
    await waitFor(() => {
      expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('Publish');
    });
  });
});
