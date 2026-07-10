import type { HTMLAttributes, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MemoryWorkspace from '@/components/memory-app/MemoryWorkspace';
import type { MemoryCatalogResponse, MemoryRecord } from '@/types/memory';
import type { WorkflowDefinition } from '@/types/workflows';

const {
  agentsApi,
  conversationsApi,
  documentsApi,
  memoriesApi,
  pushMock,
  toast,
  usersApi,
  workflowsApi,
} = vi.hoisted(() => ({
  agentsApi: {
    listAgents: vi.fn(),
  },
  conversationsApi: {
    compactConversation: vi.fn(),
    listCompactPacks: vi.fn(),
    listConversations: vi.fn(),
  },
  documentsApi: {
    deleteDocument: vi.fn(),
  },
  memoriesApi: {
    addMemoryExclusion: vi.fn(),
    backfillCompactPacks: vi.fn(),
    backfillDailySummaries: vi.fn(),
    backfillEmbeddings: vi.fn(),
    createMemory: vi.fn(),
    deleteDocumentMemories: vi.fn(),
    deleteMemory: vi.fn(),
    deleteMemoryExclusion: vi.fn(),
    listMemories: vi.fn(),
    listMemoryCatalog: vi.fn(),
    runDailySummaries: vi.fn(),
    updateMemory: vi.fn(),
  },
  pushMock: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  usersApi: {
    getCurrentUser: vi.fn(),
  },
  workflowsApi: {
    addWorkflowMemoryLink: vi.fn(),
    createWorkflow: vi.fn(),
    listWorkflowMemoryLinks: vi.fn(),
    listWorkflows: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/lib/api/backend/agents', () => ({
  agentsApi,
}));

vi.mock('@/lib/api/backend/conversations', () => ({
  conversationsApi,
}));

vi.mock('@/lib/api/backend/documents', () => ({
  documentsApi,
}));

vi.mock('@/lib/api/backend/memory', () => ({
  memoriesApi,
}));

vi.mock('@/lib/api/backend/users', () => ({
  usersApi,
}));

vi.mock('@/lib/api/backend/workflows', () => ({
  workflowsApi,
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
    description?: string;
    title: string;
  }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions}
    </header>
  ),
}));

vi.mock('@/components/agent-app/StatePanels', () => ({
  EmptyCard: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  ErrorAlert: ({ title, message }: { title: string; message: string }) => (
    <div>
      {title}: {message}
    </div>
  ),
  LoadingCard: ({ title }: { title: string }) => <div>{title} loading</div>,
}));

vi.mock('@/components/memory-app/DocumentIngestionControl', () => ({
  default: ({ onIngested }: { onIngested?: () => void }) => (
    <button type="button" onClick={onIngested}>
      Ingest mock document
    </button>
  ),
}));

vi.mock('@/components/library/shadcn/sheet', () => ({
  Sheet: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/library/shadcn/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock('@/components/library/shadcn/badge', () => ({
  Badge: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
}));

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryWorkspace />
    </QueryClientProvider>
  );
}

const workflow: WorkflowDefinition = {
  id: 'workflow-1',
  name: 'Main Workflow',
  agent_definitions: [{ id: 'agent-1', name: 'Agent One', role: 'Plan' }],
  task_definitions: [
    {
      id: 'task-1',
      name: 'Task One',
      description: 'Task',
      agent_id: 'agent-1',
    },
  ],
};

const memoryItems: MemoryRecord[] = [
  {
    id: 'memory-manual',
    scope: 'workspace',
    content: 'Manual workspace fact',
    summary: 'Manual fact',
    tags: ['manual'],
    sensitive: false,
    source: 'manual',
    memory_type: 'fact',
    status: 'active',
    importance: 60,
    updated_at: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'memory-summary',
    scope: 'conversation',
    content: 'Daily summary body',
    summary: 'Daily summary',
    tags: ['summary'],
    sensitive: false,
    source: 'daily_summary',
    memory_type: 'daily_summary',
    status: 'active',
    source_conversation_id: 'conversation-1',
    summary_date: '2026-05-20',
    updated_at: '2026-05-20T01:00:00.000Z',
  },
  {
    id: 'memory-run-summary',
    scope: 'workflow',
    content: 'Run summary body',
    summary: 'Run summary',
    tags: ['run'],
    sensitive: false,
    source: 'run_summary',
    memory_type: 'run_summary',
    status: 'active',
    source_execution_id: 'execution-1',
    workflow_id: 'workflow-1',
    updated_at: '2026-05-20T02:00:00.000Z',
  },
  {
    id: 'pack-old',
    scope: 'conversation',
    content: 'Old compact pack',
    summary: 'Old compact',
    tags: ['handoff'],
    sensitive: true,
    source: 'compact_tool',
    memory_type: 'context_pack',
    status: 'superseded',
    source_conversation_id: 'conversation-1',
    updated_at: '2026-05-20T03:00:00.000Z',
  },
  {
    id: 'pack-new',
    scope: 'conversation',
    content: 'New compact pack',
    summary: 'New compact',
    tags: ['handoff'],
    sensitive: false,
    source: 'compact_tool',
    memory_type: 'context_pack',
    status: 'active',
    source_conversation_id: 'conversation-1',
    supersedes_memory_id: 'pack-old',
    updated_at: '2026-05-20T04:00:00.000Z',
  },
  {
    id: 'document-memory',
    scope: 'workflow',
    content: 'Document chunk',
    summary: 'Document chunk',
    tags: ['document'],
    sensitive: false,
    source: 'document_upload',
    memory_type: 'archive',
    status: 'active',
    workflow_id: 'workflow-1',
    metadata: {
      document_id: 'document-1',
      filename: 'policy.md',
    },
    embedding_model_profile_id: 'embed-profile',
    embedding_model: 'text-embedding',
    embedding_dimensions: 1536,
    embedded_at: '2026-05-20T05:00:00.000Z',
    updated_at: '2026-05-20T05:00:00.000Z',
  },
];

const catalogResponse: MemoryCatalogResponse = {
  groups: [
    {
      key: 'documents',
      label: 'Documents',
      count: 1,
      items: [
        {
          id: 'document-1',
          refType: 'memory_collection',
          label: 'policy.md',
          summary: 'policy.md',
          preview: 'Document chunk',
          memoryType: 'archive',
          source: 'document_upload',
          scope: 'workflow',
          status: 'active',
          tags: ['document'],
          sensitive: false,
          documentId: 'document-1',
          documentFilename: 'policy.md',
          memoryIds: ['document-memory'],
          chunkCount: 1,
          embedded: true,
          canLink: true,
          excluded: false,
          excludedFor: [],
        },
      ],
    },
  ],
};

describe('MemoryWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    usersApi.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      roles: ['admin'],
    });
    agentsApi.listAgents.mockResolvedValue({
      items: [{ id: 'agent-1', name: 'Agent One', role: 'Plan' }],
    });
    conversationsApi.listConversations.mockResolvedValue({
      items: [
        {
          id: 'conversation-1',
          title: 'Memory planning',
          status: 'open',
          channel_type: 'web',
          created_at: '2026-05-20T00:00:00.000Z',
          updated_at: '2026-05-20T00:00:00.000Z',
        },
      ],
    });
    conversationsApi.listCompactPacks.mockResolvedValue({ items: [memoryItems[4]] });
    documentsApi.deleteDocument.mockResolvedValue({
      deleted: true,
      document_id: 'document-1',
      upload_mode: 'vector',
      document_status: 'deleted',
      memory_ids: ['memory-1'],
      deleted_memory_count: 1,
    });
    memoriesApi.listMemories.mockResolvedValue({ items: memoryItems });
    memoriesApi.listMemoryCatalog.mockResolvedValue(catalogResponse);
    memoriesApi.createMemory.mockResolvedValue(memoryItems[0]);
    memoriesApi.backfillCompactPacks.mockResolvedValue({
      status: 'ok',
      processed: 1,
      created: 1,
      skipped: 0,
      failed: 0,
      results: [],
      progress: { completed_steps: 1, failed_steps: 0, events: [] },
    });
    workflowsApi.createWorkflow.mockResolvedValue({ ...workflow, id: 'workflow-created' });
    workflowsApi.listWorkflowMemoryLinks.mockResolvedValue({ workflowId: 'workflow-1', items: [] });
    workflowsApi.listWorkflows.mockResolvedValue({ items: [workflow] });
  });

  it('renders browse filters and opens the memory drawer with lineage', async () => {
    const { container } = renderWorkspace();

    expect(await screen.findByRole('heading', { name: 'Agent Memory Ops' })).toBeInTheDocument();
    expect(container.querySelector('#filter-source')).toBeInTheDocument();
    expect(container.querySelector('#filter-mode')).toBeInTheDocument();
    expect(container.querySelector('#filter-sensitive')).toBeInTheDocument();
    expect(container.querySelector('#filter-embedding')).toBeInTheDocument();
    expect(container.querySelector('#filter-document')).toBeInTheDocument();

    fireEvent.change(container.querySelector('#filter-document') as HTMLInputElement, {
      target: { value: 'policy.md' },
    });
    expect(screen.getByText('Document chunk')).toBeInTheDocument();
    expect(screen.queryByText('Manual fact')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /open/i })[0]);
    expect(await screen.findByText('Source and lineage')).toBeInTheDocument();
    expect(screen.getByText('Superseded by')).toBeInTheDocument();
  });

  it('creates focused manual memory records from the create tab', async () => {
    renderWorkspace();

    expect(await screen.findByRole('heading', { name: 'Agent Memory Ops' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add decision' }));
    fireEvent.change(screen.getByLabelText('Decision summary'), {
      target: { value: 'Use catalog-backed memory links' },
    });
    fireEvent.change(screen.getByLabelText('Decision details'), {
      target: { value: 'Persist memory links through workflow metadata.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save decision' }));

    await waitFor(() => {
      expect(memoriesApi.createMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          memory: expect.objectContaining({
            memory_type: 'decision',
            summary: 'Use catalog-backed memory links',
          }),
        })
      );
    });
  });

  it('shows document groups in the ingest tab', async () => {
    renderWorkspace();

    expect(await screen.findByText('Uploaded document groups')).toBeInTheDocument();
    expect(await screen.findByText('policy.md')).toBeInTheDocument();
    expect(screen.getAllByText('Embedded').length).toBeGreaterThan(0);
  });

  it('supports compact pack actions and admin backfill controls', async () => {
    const { container } = renderWorkspace();

    expect(await screen.findByText('Compact a conversation')).toBeInTheDocument();
    fireEvent.change(container.querySelector('#compact-conversation') as HTMLSelectElement, {
      target: { value: 'conversation-1' },
    });

    await waitFor(() => {
      expect(conversationsApi.listCompactPacks).toHaveBeenCalledWith(
        'conversation-1',
        expect.objectContaining({ include_superseded: true })
      );
    });
    expect((await screen.findAllByText('New compact')).length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: 'Use in chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workflow' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Workflow' }));
    await waitFor(() => {
      expect(workflowsApi.createWorkflow).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith('/workflows/workflow-created');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run backfill' }));
    await waitFor(() => {
      expect(memoriesApi.backfillCompactPacks).toHaveBeenCalledWith(
        expect.objectContaining({ dry_run: true, skip_existing: true })
      );
    });
  });

  it('renders summaries and maintenance review surfaces', async () => {
    renderWorkspace();

    expect((await screen.findAllByText('Daily summaries')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Run summaries').length).toBeGreaterThan(0);
    expect(screen.getByText('Daily summary admin actions')).toBeInTheDocument();

    expect(await screen.findByText('Vector retrieval')).toBeInTheDocument();
    expect(screen.getByText('Sensitive memories')).toBeInTheDocument();
    expect(screen.getByText('Superseded compact packs')).toBeInTheDocument();
    expect(screen.getByText('Orphaned document chunks')).toBeInTheDocument();
  });
});
