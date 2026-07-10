import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UploadedDocumentsList from '@/components/memory-app/UploadedDocumentsList';

const { documentsApi, memoriesApi, toast } = vi.hoisted(() => ({
  documentsApi: {
    listDocuments: vi.fn(),
    deleteDocument: vi.fn(),
  },
  memoriesApi: {
    listMemories: vi.fn(),
    deleteDocumentMemories: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api/backend/documents', () => ({
  documentsApi,
}));

vi.mock('@/lib/api/backend/memory', () => ({
  memoriesApi,
}));

vi.mock('sonner', () => ({
  toast,
}));

vi.mock('@/components/library/shadcn/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/library/shadcn/badge', () => ({
  Badge: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
}));

function renderList(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('UploadedDocumentsList', () => {
  const documentMemories = [
    {
      id: 'memory-1',
      scope: 'workflow',
      content: 'First chunk',
      summary: 'Policy chunk',
      tags: ['workflow-rag', 'workflow:workflow-1', 'task:task-1'],
      sensitive: false,
      workflow_id: 'workflow-1',
      source: 'document_upload',
      memory_type: 'archive',
      status: 'active',
      metadata: {
        document_id: 'document-1',
        filename: 'policy.md',
        chunk_count: 2,
        storage_uri: 'memory://document-1',
      },
      created_at: '2026-05-19T01:00:00.000Z',
      updated_at: '2026-05-19T01:01:00.000Z',
    },
    {
      id: 'memory-2',
      scope: 'workflow',
      content: 'Second chunk',
      summary: 'Policy chunk',
      tags: ['workflow-rag', 'workflow:workflow-1', 'task:task-1'],
      sensitive: false,
      workflow_id: 'workflow-1',
      source: 'document_upload',
      memory_type: 'archive',
      status: 'active',
      metadata: {
        document_id: 'document-1',
        filename: 'policy.md',
        chunk_count: 2,
      },
      created_at: '2026-05-19T01:00:00.000Z',
      updated_at: '2026-05-19T01:02:00.000Z',
    },
    {
      id: 'memory-3',
      scope: 'workflow',
      content: 'Other chunk',
      summary: 'Other chunk',
      tags: ['workflow-rag', 'workflow:workflow-1', 'task:task-2'],
      sensitive: false,
      workflow_id: 'workflow-1',
      source: 'document_upload',
      memory_type: 'archive',
      status: 'active',
      metadata: {
        document_id: 'document-2',
        filename: 'other.md',
        chunk_count: 1,
      },
      created_at: '2026-05-19T01:03:00.000Z',
      updated_at: '2026-05-19T01:03:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    documentsApi.listDocuments.mockImplementation(
      async (query: { conversationId?: string; workflowId?: string; scope?: string } = {}) => {
        const documents = [
          {
            id: 'document-1',
            filename: 'policy.md',
            content_type: 'text/markdown',
            storage_uri: 'memory://document-1',
            text_characters: 120,
            estimated_tokens: 30,
            upload_mode: 'vector',
            scope: 'workflow',
            workflow_id: query.workflowId ?? 'workflow-1',
            status: 'active',
            metadata: {
              tags: ['workflow-rag', 'workflow:workflow-1', 'task:task-1'],
              upload_observability: {
                chunks_created: 2,
                projection_event_created: true,
              },
              upload_intelligence: {
                source: 'main_agent_llm',
              },
            },
            created_at: '2026-05-19T01:00:00.000Z',
            updated_at: '2026-05-19T01:02:00.000Z',
          },
          {
            id: 'document-context',
            filename: 'brief.txt',
            content_type: 'text/plain',
            storage_uri: 'memory://document-context',
            text_characters: 80,
            estimated_tokens: 20,
            upload_mode: 'context',
            scope: 'conversation',
            conversation_id: 'conversation-1',
            status: 'active',
            metadata: {
              tags: ['chat-upload'],
              upload_observability: {
                chunks_created: 0,
                projection_event_created: false,
              },
            },
            created_at: '2026-05-19T01:04:00.000Z',
            updated_at: '2026-05-19T01:04:00.000Z',
          },
        ];
        return {
          items: documents.filter((document) => {
            if (query.scope && document.scope !== query.scope) {
              return false;
            }
            if (query.workflowId && document.workflow_id !== query.workflowId) {
              return false;
            }
            if (query.conversationId && document.conversation_id !== query.conversationId) {
              return false;
            }
            return true;
          }),
        };
      }
    );
    memoriesApi.listMemories.mockImplementation(async (query: { tags?: string[] } = {}) => {
      const items = query.tags?.length
        ? documentMemories.filter((memory) => query.tags?.every((tag) => memory.tags.includes(tag)))
        : documentMemories;
      return { items };
    });
    memoriesApi.deleteDocumentMemories.mockResolvedValue({
      deleted: true,
      document_id: 'document-1',
      memory_ids: ['memory-1', 'memory-2'],
      deleted_count: 2,
    });
    documentsApi.deleteDocument.mockResolvedValue({
      deleted: true,
      document_id: 'document-1',
      upload_mode: 'vector',
      document_status: 'deleted',
      memory_ids: ['memory-1', 'memory-2'],
      deleted_memory_count: 2,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queries uploaded document memories for the selected context', async () => {
    renderList(<UploadedDocumentsList scope="conversation" conversationId="conversation-1" />);

    await waitFor(() => {
      expect(documentsApi.listDocuments).toHaveBeenCalledWith({
        scope: 'conversation',
        workspaceId: undefined,
        conversationId: 'conversation-1',
        workflowId: undefined,
        agentId: undefined,
        limit: 100,
      });
      expect(memoriesApi.listMemories).toHaveBeenCalledWith({
        scope: 'conversation',
        workspace_id: undefined,
        conversation_id: 'conversation-1',
        workflow_id: undefined,
        agent_id: undefined,
        source: 'document_upload',
        memory_type: ['archive'],
        tags: undefined,
        status: ['active'],
        limit: 100,
      });
    });
  });

  it('groups chunks into one document row and applies task tag filtering', async () => {
    renderList(
      <UploadedDocumentsList scope="workflow" workflowId="workflow-1" tagFilter="task:task-1" />
    );

    expect(await screen.findByText('policy.md')).toBeInTheDocument();
    expect(screen.getByText(/2 memory chunks/)).toBeInTheDocument();
    expect(screen.getByText('Retrieval')).toBeInTheDocument();
    expect(screen.getByText(/Tracked source file/)).toBeInTheDocument();
    expect(screen.getByText(/Graph projection queued/)).toBeInTheDocument();
    expect(screen.getByText(/Classified by main agent llm/)).toBeInTheDocument();
    expect(screen.queryByText('other.md')).not.toBeInTheDocument();
    expect(screen.queryByText('brief.txt')).not.toBeInTheDocument();
    expect(memoriesApi.listMemories).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['task:task-1'] })
    );
  });

  it('shows context-only uploads and deletes through document lifecycle', async () => {
    memoriesApi.listMemories.mockResolvedValue({ items: [] });
    documentsApi.deleteDocument.mockResolvedValue({
      deleted: true,
      document_id: 'document-context',
      upload_mode: 'context',
      document_status: 'deleted',
      memory_ids: [],
      deleted_memory_count: 0,
    });

    renderList(<UploadedDocumentsList scope="conversation" conversationId="conversation-1" />);

    expect(await screen.findByText('brief.txt')).toBeInTheDocument();
    expect(screen.getByText('Context only')).toBeInTheDocument();
    expect(screen.getByText(/No retrieval chunks/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => {
      expect(documentsApi.deleteDocument).toHaveBeenCalledWith('document-context');
    });
    expect(memoriesApi.deleteDocumentMemories).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      'Removed uploaded document.',
      expect.objectContaining({ position: 'top-right' })
    );
  });

  it('removes uploaded document and chunks through document lifecycle', async () => {
    renderList(
      <UploadedDocumentsList scope="workflow" workflowId="workflow-1" tagFilter="task:task-1" />
    );

    expect(await screen.findByText('policy.md')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => {
      expect(documentsApi.deleteDocument).toHaveBeenCalledWith('document-1');
    });
    expect(memoriesApi.deleteDocumentMemories).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      'Removed document and 2 retrieval chunks.',
      expect.objectContaining({ position: 'top-right' })
    );
  });

  it('falls back to legacy memory chunk deletion when no uploaded document record exists', async () => {
    documentsApi.listDocuments.mockResolvedValue({ items: [] });

    renderList(
      <UploadedDocumentsList scope="workflow" workflowId="workflow-1" tagFilter="task:task-1" />
    );

    expect(await screen.findByText('policy.md')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => {
      expect(memoriesApi.deleteDocumentMemories).toHaveBeenCalledWith('document-1', {
        scope: 'workflow',
        workspace_id: undefined,
        conversation_id: undefined,
        workflow_id: 'workflow-1',
        agent_id: undefined,
        tags: ['task:task-1'],
      });
    });
  });
});
