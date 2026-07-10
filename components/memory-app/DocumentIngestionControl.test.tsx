import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DocumentIngestionControl from '@/components/memory-app/DocumentIngestionControl';

const { documentsApi, toast } = vi.hoisted(() => ({
  documentsApi: {
    analyzeUpload: vi.fn(),
    ingestDocument: vi.fn(),
  },
  toast: {
    success: vi.fn(),
  },
}));

vi.mock('@/lib/api/backend/documents', () => ({
  documentsApi,
}));

vi.mock('sonner', () => ({
  toast,
}));

vi.mock('@/components/library/shadcn/button', () => ({
  Button: ({
    children,
    className,
    variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
  }) => {
    void className;
    void variant;
    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/library/shadcn/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/library/shadcn/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/library/shadcn/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

function renderControl(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DocumentIngestionControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentsApi.ingestDocument.mockResolvedValue({
      document_id: 'doc-1',
      filename: 'policy.md',
      content_type: 'text/markdown',
      text_characters: 42,
      upload_mode: 'vector',
      chunks_created: 1,
      memory_ids: ['memory-1'],
    });
    documentsApi.analyzeUpload.mockResolvedValue({
      filename: 'policy.md',
      content_type: 'text/markdown',
      text_characters: 42,
      source: 'main_agent_llm',
      model_profile_id: 'main-profile',
      document_kind: 'policy_sop',
      summary: 'Policy document',
      confidence: 0.9,
      recommended: {
        tags: ['workflow-rag', 'workflow:workflow-1', 'policy'],
      },
    });
  });

  it('does not expose global as a document ingestion scope', () => {
    renderControl(<DocumentIngestionControl />);

    expect(screen.queryByLabelText('Scope')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

    const scopeSelect = screen.getByLabelText('Scope') as HTMLSelectElement;
    const optionLabels = Array.from(scopeSelect.options).map((option) => option.textContent);

    expect(optionLabels).toEqual(['User', 'Workspace', 'Conversation', 'Workflow']);
    expect(optionLabels).not.toContain('Global');
  });

  it('posts locked workflow and agent context through the shared documents api', async () => {
    const onIngested = vi.fn();
    const { container } = renderControl(
      <DocumentIngestionControl
        title="Workflow documents"
        scope="workflow"
        lockedScope
        workflowId="workflow-1"
        workflows={[{ id: 'workflow-1', label: 'Workflow One (workflow-1)' }]}
        agentId="agent-1"
        lockedAgent
        agents={[{ id: 'agent-1', label: 'Agent One (agent-1)' }]}
        defaultTags={['workflow-rag', 'workflow:workflow-1']}
        onIngested={onIngested}
      />
    );

    const file = new File(['# Policy'], 'policy.md', { type: 'text/markdown' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(documentsApi.analyzeUpload).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(documentsApi.ingestDocument).toHaveBeenCalledWith({
        file,
        scope: 'workflow',
        workspaceId: undefined,
        conversationId: undefined,
        workflowId: 'workflow-1',
        agentId: 'agent-1',
        tags: ['workflow-rag', 'workflow:workflow-1', 'policy'],
        chunkSize: undefined,
        chunkOverlap: undefined,
        autoIntelligence: true,
        allowScopeSuggestion: false,
        allowAgentSuggestion: false,
        purpose: 'memory',
        uploadMode: 'vector',
      });
    });
    expect(onIngested).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      'Ingested policy.md into 1 memory chunk.',
      expect.objectContaining({ position: 'top-right' })
    );
  });
});
