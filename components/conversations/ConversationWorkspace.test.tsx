import React, { ButtonHTMLAttributes, ComponentProps } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatAssistantMarkdownText } from '@/components/conversations/AssistantMarkdown';
import ConversationWorkspace from '@/components/conversations/ConversationWorkspace';

const {
  conversationsApi,
  agentsApi,
  documentsApi,
  logsApi,
  memoriesApi,
  personasApi,
  goalsApi,
  runsApi,
  runtimeAdaptersApi,
  workflowsApi,
  pushMock,
} = vi.hoisted(() => ({
  conversationsApi: {
    listConversations: vi.fn(),
    getMainAgent: vi.fn(),
    createConversation: vi.fn(),
    getConversation: vi.fn(),
    updateConversation: vi.fn(),
    listMessages: vi.fn(),
    compactConversation: vi.fn(),
    listCompactPacks: vi.fn(),
    listApprovalRequests: vi.fn(),
    postMessage: vi.fn(),
    approveApprovalRequest: vi.fn(),
    rejectApprovalRequest: vi.fn(),
    getStreamUrl: vi.fn(),
    parseStreamEvent: vi.fn((data: string) => JSON.parse(data)),
  },
  agentsApi: {
    getAgentCatalogItem: vi.fn(),
  },
  documentsApi: {
    ingestDocument: vi.fn(),
  },
  logsApi: {
    getRunTimeline: vi.fn(),
  },
  memoriesApi: {
    listMemories: vi.fn(),
    deleteDocumentMemories: vi.fn(),
  },
  personasApi: {
    listPersonas: vi.fn(),
  },
  goalsApi: {
    getOperatorView: vi.fn(),
    updateGoal: vi.fn(),
    pauseGoal: vi.fn(),
    resumeGoal: vi.fn(),
    cancelGoal: vi.fn(),
  },
  runsApi: {
    executeWorkflow: vi.fn(),
  },
  runtimeAdaptersApi: {
    listRuntimeAdapters: vi.fn(),
  },
  workflowsApi: {
    createWorkflow: vi.fn(),
    getWorkflow: vi.fn(),
    listWorkflows: vi.fn(),
  },
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'dev-user',
        email: 'dev@example.com',
        name: 'Dev User',
      },
    },
  }),
}));

vi.mock('@/lib/api/backend/conversations', () => ({
  conversationsApi,
}));

vi.mock('@/lib/api/backend/agents', () => ({
  agentsApi,
}));

vi.mock('@/lib/api/backend/documents', () => ({
  documentsApi,
}));

vi.mock('@/lib/api/backend/logs', () => ({
  logsApi,
}));

vi.mock('@/lib/api/backend/memory', () => ({
  memoriesApi,
}));

vi.mock('@/lib/api/backend/personas', () => ({
  personasApi,
}));

vi.mock('@/lib/api/backend/goals', () => ({
  goalsApi,
}));

vi.mock('@/lib/api/backend/runs', () => ({
  runsApi,
}));

vi.mock('@/lib/api/backend/runtimeAdapters', () => ({
  runtimeAdaptersApi,
}));

vi.mock('@/lib/api/backend/workflows', () => ({
  workflowsApi,
}));

vi.mock('@/components/conversations/TextMessage', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('@/components/library/shadcn/button', async () => {
  const ReactModule = await import('react');
  const Button = ReactModule.forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement> & {
      asChild?: boolean;
      variant?: string;
      size?: string;
    }
  >(({ children, asChild, variant, size, ...props }, ref) => {
    void asChild;
    void variant;
    void size;
    return (
      <button ref={ref} type="button" {...props}>
        {children}
      </button>
    );
  });
  Button.displayName = 'MockButton';

  return { Button, buttonVariants: () => '' };
});

vi.mock('@/components/library/shadcn/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

type MockMessageEvent = { data: string };
type MockEventHandler = (event: MockMessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MockMessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private listeners = new Map<string, MockEventHandler[]>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: MockEventHandler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown) {
    const event = { data: JSON.stringify(payload) };
    if (type === 'message') {
      this.onmessage?.(event);
    }
    for (const handler of this.listeners.get(type) || []) {
      handler(event);
    }
  }

  open() {
    this.onopen?.(new Event('open'));
  }

  fail() {
    this.onerror?.(new Event('error'));
  }
}

function renderConversationWorkspace(props: ComponentProps<typeof ConversationWorkspace> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ConversationWorkspace {...props} />
    </QueryClientProvider>
  );
}

describe('ConversationWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    window.localStorage.clear();
    window.localStorage.setItem('agency.active_conversation_id', 'conversation-1');
    vi.stubGlobal('EventSource', MockEventSource);

    conversationsApi.getMainAgent.mockResolvedValue({
      id: 'main-profile-1',
      name: 'Main',
      description: 'Main Agent',
      agent_id: 'agent-main-1',
      default_workflow_id: 'workflow-main-1',
    });
    agentsApi.getAgentCatalogItem.mockResolvedValue({
      id: 'agent-main-1',
      name: 'Open Agency Assistant',
      description: 'Default assistant',
      config: {
        toolIds: [],
        handoffAgentIds: [],
      },
    });
    conversationsApi.getConversation.mockResolvedValue({
      id: 'conversation-1',
      title: 'Reconnect Test',
      status: 'open',
      channel_type: 'web',
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:00:00.000Z',
    });
    conversationsApi.updateConversation.mockResolvedValue({
      id: 'conversation-1',
      title: 'Reconnect Test',
      status: 'open',
      channel_type: 'discord',
      channel_thread_id: 'discord-channel-1',
      channel_user_id: 'discord-user-1',
      channel_display_name: 'Discord Operator',
      metadata: { guild_id: 'guild-1' },
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:01:00.000Z',
    });
    conversationsApi.listConversations.mockResolvedValue({
      items: [
        {
          id: 'conversation-2',
          title: 'Earlier Conversation',
          status: 'open',
          channel_type: 'web',
          created_at: '2026-05-05T00:00:00.000Z',
          updated_at: '2026-05-05T00:30:00.000Z',
        },
        {
          id: 'conversation-1',
          title: 'Reconnect Test',
          status: 'open',
          channel_type: 'web',
          created_at: '2026-05-06T00:00:00.000Z',
          updated_at: '2026-05-06T00:00:00.000Z',
        },
      ],
    });
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-1',
          conversation_id: 'conversation-1',
          role: 'user',
          message_type: 'user_text',
          plain_text: 'Initial user message',
          content: { text: 'Initial user message' },
          created_at: '2026-05-06T00:00:00.000Z',
        },
        {
          id: 'message-2',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'assistant_text',
          plain_text: 'Initial assistant reply',
          content: { text: 'Initial assistant reply' },
          created_at: '2026-05-06T00:00:01.000Z',
        },
      ],
    });
    conversationsApi.listCompactPacks.mockResolvedValue({ items: [] });
    personasApi.listPersonas.mockResolvedValue({ items: [] });
    goalsApi.getOperatorView.mockResolvedValue({ items: [] });
    conversationsApi.compactConversation.mockResolvedValue({
      status: 'preview',
      memory_id: null,
      mode: 'handoff',
      format: 'markdown',
      scope: 'conversation',
      source_range: 'full',
      content: 'Compact preview content',
      summary: 'Compact preview',
      structured: {},
      source_message_count: 2,
      estimated_source_tokens: 120,
      estimated_compact_tokens: 80,
      sensitive: false,
      warnings: [],
      progress: {
        completed_steps: 6,
        failed_steps: 0,
        events: [],
      },
    });
    conversationsApi.listApprovalRequests.mockResolvedValue({ items: [] });
    documentsApi.ingestDocument.mockResolvedValue({
      filename: 'brief.pdf',
      chunks_created: 2,
      document_id: 'document-1',
      upload_mode: 'vector',
      context_attachment_id: null,
    });
    memoriesApi.listMemories.mockResolvedValue({ items: [] });
    conversationsApi.approveApprovalRequest.mockResolvedValue({
      approval_request: {
        id: 'approval-1',
        approval_type: 'workflow_create',
        status: 'approved',
        target_type: 'workflow',
        target_id: 'workflow-1',
        requested_by_agent_id: 'agent-main-1',
        conversation_id: 'conversation-1',
        origin_message_id: 'message-approval',
        summary: 'Approved',
        proposed_payload: {},
        created_at: '2026-05-06T00:00:00.000Z',
        updated_at: '2026-05-06T00:00:02.000Z',
      },
    });
    conversationsApi.rejectApprovalRequest.mockResolvedValue({
      approval_request: {
        id: 'approval-1',
        approval_type: 'workflow_create',
        status: 'rejected',
        target_type: 'workflow',
        target_id: 'workflow-1',
        requested_by_agent_id: 'agent-main-1',
        conversation_id: 'conversation-1',
        origin_message_id: 'message-approval',
        summary: 'Rejected',
        proposed_payload: {},
        created_at: '2026-05-06T00:00:00.000Z',
        updated_at: '2026-05-06T00:00:02.000Z',
      },
    });
    conversationsApi.getStreamUrl.mockImplementation((conversationId: string, after?: string) =>
      after
        ? `/conversations/${conversationId}/stream?after=${after}`
        : `/conversations/${conversationId}/stream`
    );
    runtimeAdaptersApi.listRuntimeAdapters.mockResolvedValue({
      items: [
        {
          id: 'native',
          name: 'Native Runtime',
          adapter_type: 'native',
        },
        {
          id: 'crewai',
          name: 'CrewAI',
          adapter_type: 'framework',
        },
      ],
    });
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      default_runtime_adapter_id: 'crewai',
      allowed_runtime_adapter_ids: ['native', 'crewai'],
    });
    workflowsApi.listWorkflows.mockResolvedValue({ items: [] });
    workflowsApi.createWorkflow.mockResolvedValue({
      id: 'workflow-from-pack',
      name: 'Workflow from compact pack',
    });
    logsApi.getRunTimeline.mockResolvedValue({
      execution: {
        id: 'run-1',
        status: 'completed',
      },
      execution_duration_ms: 1200,
      events: [],
    });
    runsApi.executeWorkflow.mockResolvedValue({
      id: 'run-1',
      status: 'created',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reconnects the stream and backfills missed messages after an error', async () => {
    renderConversationWorkspace();

    await waitFor(() => {
      expect(conversationsApi.getConversation).toHaveBeenCalledWith('conversation-1');
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Main Chat' })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Chat with Main.')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Main Agent')).toBeInTheDocument();
    });
    expect(screen.queryByText('Runs as Open Agency Assistant')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Initial assistant reply')).toBeInTheDocument();
    });
    expect(screen.getByText('Conversation files')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Files' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start speech input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attach document' })).toBeInTheDocument();
    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    vi.useFakeTimers({ shouldAdvanceTime: true });

    act(() => {
      MockEventSource.instances[0].fail();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(MockEventSource.instances).toHaveLength(2);
    expect(conversationsApi.getStreamUrl).toHaveBeenLastCalledWith('conversation-1', 'message-2');

    await act(async () => {
      MockEventSource.instances[1].open();
      await Promise.resolve();
    });
    expect(conversationsApi.listApprovalRequests).toHaveBeenCalledTimes(2);

    act(() => {
      MockEventSource.instances[1].emit('message.created', {
        id: 'event-1',
        conversation_id: 'conversation-1',
        event_type: 'message.created',
        occurred_at: '2026-05-06T00:00:02.000Z',
        message: {
          id: 'message-3',
          conversation_id: 'conversation-1',
          role: 'user',
          message_type: 'user_text',
          plain_text: 'Post-restart reconnect smoke test.',
          content: { text: 'Post-restart reconnect smoke test.' },
          created_at: '2026-05-06T00:00:02.000Z',
        },
      });
      MockEventSource.instances[1].emit('message.created', {
        id: 'event-2',
        conversation_id: 'conversation-1',
        event_type: 'message.created',
        occurred_at: '2026-05-06T00:00:03.000Z',
        message: {
          id: 'message-4',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'assistant_text',
          plain_text: 'I received your message: Post-restart reconnect smoke test.',
          content: { text: 'I received your message: Post-restart reconnect smoke test.' },
          created_at: '2026-05-06T00:00:03.000Z',
        },
      });
    });

    expect(screen.getByText('Post-restart reconnect smoke test.')).toBeInTheDocument();
    expect(
      screen.getByText('I received your message: Post-restart reconnect smoke test.')
    ).toBeInTheDocument();
  }, 10000);

  it('saves a conversation channel delivery target', async () => {
    conversationsApi.listMessages.mockResolvedValueOnce({
      items: [
        {
          id: 'message-1',
          conversation_id: 'conversation-1',
          role: 'user',
          message_type: 'user_text',
          plain_text: 'Send this workflow result to Discord.',
          content: { text: 'Send this workflow result to Discord.' },
          created_at: '2026-05-06T00:00:00.000Z',
        },
        {
          id: 'message-channel-target-prompt',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'assistant_text',
          plain_text: 'I need the Discord channel target before I update the integration.',
          content: { text: 'I need the Discord channel target before I update the integration.' },
          metadata: { channel_target_prompt: true },
          created_at: '2026-05-06T00:00:01.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    const dialog = await screen.findByRole('dialog', { name: 'Channel Target' });
    const scoped = within(dialog);

    expect(scoped.getByRole('button', { name: 'Discord' })).toBeInTheDocument();
    expect(scoped.queryByRole('button', { name: 'Telegram' })).not.toBeInTheDocument();
    expect(scoped.queryByRole('button', { name: 'WhatsApp' })).not.toBeInTheDocument();
    fireEvent.change(scoped.getByLabelText('Discord channel ID'), {
      target: { value: 'discord-channel-1' },
    });
    fireEvent.change(scoped.getByLabelText('Discord user ID'), {
      target: { value: 'discord-user-1' },
    });
    fireEvent.change(scoped.getByLabelText('Guild ID'), { target: { value: 'guild-1' } });
    fireEvent.change(scoped.getByLabelText('Display name'), {
      target: { value: 'Discord Operator' },
    });
    fireEvent.click(scoped.getByRole('button', { name: 'Save target' }));

    await waitFor(() => {
      expect(conversationsApi.updateConversation).toHaveBeenCalledWith(
        'conversation-1',
        expect.objectContaining({
          channel_type: 'discord',
          channel_thread_id: 'discord-channel-1',
          channel_user_id: 'discord-user-1',
          channel_display_name: 'Discord Operator',
          metadata: expect.objectContaining({ guild_id: 'guild-1' }),
        })
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('Channel Target')).not.toBeInTheDocument();
    });
  });

  it('does not prompt for a channel target when the requested provider is already configured', async () => {
    conversationsApi.getConversation.mockResolvedValueOnce({
      id: 'conversation-1',
      title: 'Reconnect Test',
      status: 'open',
      channel_type: 'discord',
      channel_thread_id: 'discord-channel-1',
      channel_user_id: null,
      channel_display_name: 'Discord Support',
      metadata: {},
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:00:00.000Z',
    });
    conversationsApi.listMessages.mockResolvedValueOnce({
      items: [
        {
          id: 'message-1',
          conversation_id: 'conversation-1',
          role: 'user',
          message_type: 'user_text',
          plain_text: 'Send this workflow result to Discord.',
          content: { text: 'Send this workflow result to Discord.' },
          created_at: '2026-05-06T00:00:00.000Z',
        },
        {
          id: 'message-channel-target-prompt',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'assistant_text',
          plain_text: 'I need the Discord channel target before I update the integration.',
          content: { text: 'I need the Discord channel target before I update the integration.' },
          metadata: { channel_target_prompt: true },
          created_at: '2026-05-06T00:00:01.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    expect(
      await screen.findByText('I need the Discord channel target before I update the integration.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Channel Target' })).not.toBeInTheDocument();
  });

  it('keeps the channel target editor hidden until the agent asks for delivery setup', async () => {
    renderConversationWorkspace();

    expect(await screen.findByText('Initial assistant reply')).toBeInTheDocument();
    expect(screen.queryByText('Channel Target')).not.toBeInTheDocument();
  });

  it('opens the channel target modal immediately from streamed activity', async () => {
    renderConversationWorkspace();

    expect(await screen.findByText('Initial assistant reply')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Channel Target' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    act(() => {
      MockEventSource.instances[0].emit('assistant.summary', {
        id: 'activity-channel-target',
        conversation_id: 'conversation-1',
        turn_id: 'turn-channel-target',
        event_type: 'assistant.summary',
        occurred_at: '2026-05-06T00:00:03.000Z',
        title: 'Discord channel target required',
        detail: 'I need the Discord channel target before I update the integration.',
        metadata: {
          channel_target: { provider: 'discord', required: true },
        },
      });
    });

    const dialog = await screen.findByRole('dialog', { name: 'Channel Target' });
    const scoped = within(dialog);
    expect(scoped.getByRole('button', { name: 'Discord' })).toBeInTheDocument();
    expect(scoped.queryByRole('button', { name: 'Telegram' })).not.toBeInTheDocument();
    expect(scoped.queryByRole('button', { name: 'WhatsApp' })).not.toBeInTheDocument();
  });

  it('caps long chat replies and makes the message body scrollable', async () => {
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-1',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'assistant_text',
          plain_text:
            'This is a very long assistant reply. '.repeat(40) +
            'It should stay inside a fixed-height bubble and scroll internally.',
          content: {
            text:
              'This is a very long assistant reply. '.repeat(40) +
              'It should stay inside a fixed-height bubble and scroll internally.',
          },
          created_at: '2026-05-06T00:00:01.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    const body = await waitFor(() =>
      screen
        .getAllByTestId('message-body')
        .find(
          (element) =>
            element.textContent?.includes('This is a very long assistant reply.') &&
            element.textContent?.includes('fixed-height bubble and scroll internally.')
        )
    );
    expect(body).not.toBeNull();
    expect(body).toHaveClass('max-h-80', 'overflow-y-auto', 'overscroll-contain');
  });

  it('preserves assistant whitespace formatting in the transcript', async () => {
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-1',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'assistant_text',
          plain_text: 'First line\n\n  Second line\n\tThird line',
          content: {
            text: 'First line\n\n  Second line\n\tThird line',
          },
          created_at: '2026-05-06T00:00:01.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    const body = await screen.findByTestId('message-body');
    expect(body).toHaveClass('whitespace-pre-wrap');
    expect(body).toHaveStyle({ tabSize: '8' });
    expect(formatAssistantMarkdownText('First\tline\n\n\nSecond')).toBe(
      'First\u00A0\u00A0\u00A0\u00A0line\n\nSecond'
    );
    expect(formatAssistantMarkdownText('First\\tline\n\n\nSecond')).toBe(
      'First\u00A0\u00A0\u00A0\u00A0line\n\nSecond'
    );
    expect(body.textContent).toContain('\u00A0');
    expect(body.textContent).toContain('First line');
    expect(body.textContent).toContain('Second line');
    expect(body.textContent).toContain('Third line');
  });

  it('shows the channel target modal in a workflow-scoped popup chat', async () => {
    conversationsApi.listConversations.mockResolvedValue({
      items: [
        {
          id: 'conversation-1',
          title: 'Workflow One chat',
          status: 'open',
          channel_type: 'web',
          created_at: '2026-05-06T00:00:00.000Z',
          updated_at: '2026-05-06T00:00:00.000Z',
          metadata: {
            workflow_id: 'workflow-1',
            page_context: {
              surface: 'workflow.detail',
              title: 'Workflow One',
              entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
              selection: { workflowId: 'workflow-1' },
            },
          },
        },
      ],
    });
    conversationsApi.getConversation.mockResolvedValue({
      id: 'conversation-1',
      title: 'Workflow One chat',
      status: 'open',
      channel_type: 'web',
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:00:00.000Z',
      metadata: {
        workflow_id: 'workflow-1',
        page_context: {
          surface: 'workflow.detail',
          title: 'Workflow One',
          entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
          selection: { workflowId: 'workflow-1' },
        },
      },
    });
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-1',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'assistant_text',
          plain_text: 'I need the Discord channel target before I update the integration.',
          content: { text: 'I need the Discord channel target before I update the integration.' },
          metadata: { channel_target_prompt: true },
          created_at: '2026-05-06T00:00:01.000Z',
        },
      ],
    });

    renderConversationWorkspace({
      mode: 'popup',
      contextMetadata: () => ({
        page_context: {
          surface: 'workflow.detail',
          route: '/workflows/workflow-1',
          pathname: '/workflows/workflow-1',
          title: 'Workflow One',
          entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
          selection: { workflowId: 'workflow-1' },
          summary: { workflowId: 'workflow-1' },
          updatedAt: '2026-05-27T00:00:00.000Z',
        },
      }),
    });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/channel target/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Discord' })).toBeInTheDocument();
  });

  it('renders live turn activity and collapses it under the final assistant message', async () => {
    conversationsApi.postMessage.mockResolvedValue({
      message: {
        id: 'message-activity-user',
        conversation_id: 'conversation-1',
        role: 'user',
        message_type: 'user_text',
        plain_text: 'Plan my next workflow.',
        content: { text: 'Plan my next workflow.' },
        created_at: '2026-05-06T00:00:02.000Z',
      },
      stream_url: '/conversations/conversation-1/stream',
    });

    renderConversationWorkspace();

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    fireEvent.change(screen.getByLabelText('Message Main'), {
      target: { value: 'Plan my next workflow.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(screen.getByText('Main is working')).toBeInTheDocument();
    });

    act(() => {
      MockEventSource.instances[0].emit('turn.started', {
        id: 'activity-1',
        conversation_id: 'conversation-1',
        turn_id: 'turn-activity-1',
        event_type: 'turn.started',
        occurred_at: '2026-05-06T00:00:03.000Z',
        title: 'Started assistant turn',
      });
      MockEventSource.instances[0].emit('memory.searching', {
        id: 'activity-2',
        conversation_id: 'conversation-1',
        turn_id: 'turn-activity-1',
        event_type: 'memory.searching',
        occurred_at: '2026-05-06T00:00:04.000Z',
        title: 'Searching memory',
        detail: 'Looking for related workflow context.',
      });
      MockEventSource.instances[0].emit('tool_call.started', {
        id: 'activity-tool-1',
        conversation_id: 'conversation-1',
        turn_id: 'turn-activity-1',
        event_type: 'tool_call.started',
        occurred_at: '2026-05-06T00:00:04.500Z',
        metadata: { tool_name: 'agency.connector.credentials' },
      });
      MockEventSource.instances[0].emit('assistant.draft_delta', {
        id: 'activity-3',
        conversation_id: 'conversation-1',
        turn_id: 'turn-activity-1',
        event_type: 'assistant.draft_delta',
        occurred_at: '2026-05-06T00:00:05.000Z',
        text_delta: 'I am drafting a workflow plan.',
      });
    });

    expect(screen.getByText('Main activity')).toBeInTheDocument();
    expect(screen.getByText('Searching memory')).toBeInTheDocument();
    expect(screen.getByText('Reading connector credentials')).toBeInTheDocument();
    expect(screen.getByText('Looking for related workflow context.')).toBeInTheDocument();
    expect(screen.getByText('I am drafting a workflow plan.')).toBeInTheDocument();

    act(() => {
      MockEventSource.instances[0].emit('turn.completed', {
        id: 'activity-4',
        conversation_id: 'conversation-1',
        turn_id: 'turn-activity-1',
        event_type: 'turn.completed',
        occurred_at: '2026-05-06T00:00:06.000Z',
        title: 'Finished assistant turn',
      });
      MockEventSource.instances[0].emit('message.created', {
        id: 'event-activity-final',
        conversation_id: 'conversation-1',
        event_type: 'message.created',
        occurred_at: '2026-05-06T00:00:07.000Z',
        message: {
          id: 'message-activity-assistant',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'assistant_text',
          plain_text: 'Here is the workflow plan.',
          content: { text: 'Here is the workflow plan.' },
          created_at: '2026-05-06T00:00:07.000Z',
        },
      });
    });

    expect(screen.getByText('Here is the workflow plan.')).toBeInTheDocument();
    expect(screen.queryByText('Main activity')).not.toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Finished assistant turn')).toBeInTheDocument();
    expect(
      screen
        .getByText('Activity')
        .compareDocumentPosition(screen.getByText('Here is the workflow plan.')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  }, 10000);

  it('ends a pending async turn when a streamed approval request is the handoff', async () => {
    conversationsApi.postMessage.mockResolvedValue({
      message: {
        id: 'message-approval-user',
        conversation_id: 'conversation-1',
        role: 'user',
        message_type: 'user_text',
        plain_text: 'Propose a workflow update.',
        content: { text: 'Propose a workflow update.' },
        created_at: '2026-05-06T00:00:02.000Z',
      },
      stream_url: '/conversations/conversation-1/stream?after=message-approval-user',
    });

    renderConversationWorkspace();

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    fireEvent.change(screen.getByLabelText('Message Main'), {
      target: { value: 'Propose a workflow update.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(screen.getByText('Main is working')).toBeInTheDocument();
    });

    act(() => {
      MockEventSource.instances[0].emit('approval.requested', {
        id: 'event-approval-requested',
        conversation_id: 'conversation-1',
        event_type: 'approval.requested',
        occurred_at: '2026-05-06T00:00:10.000Z',
        approval: {
          id: 'approval-streamed',
          approval_type: 'workflow_update',
          status: 'pending',
          target_type: 'workflow',
          target_id: 'workflow-1',
          requested_by_agent_id: 'agent-main-1',
          conversation_id: 'conversation-1',
          origin_message_id: 'message-tool-call',
          summary: 'Review proposed workflow update',
          diff_summary: 'Updates the workflow steps.',
          proposed_payload: {
            workflow: {
              id: 'workflow-1',
              name: 'Workflow One',
              default_runtime_adapter_id: 'native',
            },
          },
          created_at: '2026-05-06T00:00:10.000Z',
          updated_at: '2026-05-06T00:00:10.000Z',
        },
      });
    });

    expect(screen.queryByText('Main is working')).not.toBeInTheDocument();
    const panel = await screen.findByRole('region', { name: 'Pending approvals' });
    expect(within(panel).getByText('Review proposed workflow update')).toBeInTheDocument();
  });

  it('keeps provider context visible while an async turn is pending', async () => {
    conversationsApi.postMessage.mockResolvedValue({
      message: {
        id: 'message-stale-user',
        conversation_id: 'conversation-1',
        role: 'user',
        message_type: 'user_text',
        plain_text: 'Update this workflow.',
        content: { text: 'Update this workflow.' },
        created_at: '2026-05-06T00:00:02.000Z',
      },
      stream_url: '/conversations/conversation-1/stream?after=message-stale-user',
    });

    renderConversationWorkspace({
      contextMetadata: () => ({
        assistant_providers: {
          version: '2026-05-27',
          providers: [
            {
              id: 'workflow.provider',
              label: 'Workflow provider',
            },
          ],
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('Initial assistant reply')).toBeInTheDocument();
    });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-06T00:00:10.000Z'));

    fireEvent.change(screen.getByLabelText('Message Main'), {
      target: { value: 'Update this workflow.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(screen.getByText('Main is working')).toBeInTheDocument();
    });
    expect(screen.getByText(/Using Workflow provider/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(120000);
      await Promise.resolve();
    });
  }, 10000);

  it('keeps a restored tool-only turn pending when no assistant response was saved', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-06T00:03:00.000Z'));
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-user-tool-only',
          conversation_id: 'conversation-1',
          role: 'user',
          message_type: 'user_text',
          plain_text: 'Propose a workflow update.',
          content: { text: 'Propose a workflow update.' },
          metadata: {
            assistant_providers: {
              providers: [{ id: 'workflow.provider', label: 'Workflow provider' }],
            },
          },
          created_at: '2026-05-06T00:00:00.000Z',
        },
        {
          id: 'message-tool-call-only',
          conversation_id: 'conversation-1',
          role: 'tool',
          message_type: 'tool_call',
          plain_text: 'Tool call: Propose Workflow Update',
          content: {
            tool_id: 'agency.workflow.propose-update',
            tool_name: 'propose_workflow_update',
            arguments: { workflow_id: 'workflow-1' },
          },
          created_at: '2026-05-06T00:00:10.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    expect(await screen.findByText('Main is working')).toBeInTheDocument();
    expect(screen.getByText('No result')).toBeInTheDocument();
    expect(screen.getByText(/Using Workflow provider/)).toBeInTheDocument();
    expect(screen.getByText(/taking longer than expected/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'End turn' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /Check now/i }).at(-1)!);

    expect(await screen.findByText(/No completed response was found/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Check again/i }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'End turn' }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByText(/No completed response was found/)).not.toBeInTheDocument();
    });

    conversationsApi.postMessage.mockResolvedValue({
      message: {
        id: 'message-steer-user',
        conversation_id: 'conversation-1',
        role: 'user',
        message_type: 'user_text',
        plain_text: 'Please continue by creating the approval request again.',
        content: { text: 'Please continue by creating the approval request again.' },
        created_at: '2026-05-06T00:03:05.000Z',
      },
    });

    fireEvent.change(screen.getByLabelText('Message Main'), {
      target: { value: 'Please continue by creating the approval request again.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(conversationsApi.postMessage).toHaveBeenCalledWith(
        'conversation-1',
        expect.objectContaining({
          message: expect.objectContaining({
            plain_text: 'Please continue by creating the approval request again.',
          }),
        })
      );
    });
  });

  it('does not mark a restored workflow approval as a still-running turn', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-06T00:03:00.000Z'));
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-user-tool-approval',
          conversation_id: 'conversation-1',
          role: 'user',
          message_type: 'user_text',
          plain_text: 'Propose a workflow update.',
          content: { text: 'Propose a workflow update.' },
          metadata: {
            assistant_providers: {
              providers: [{ id: 'workflow.provider', label: 'Workflow provider' }],
            },
          },
          created_at: '2026-05-06T00:00:00.000Z',
        },
        {
          id: 'message-tool-call-approval',
          conversation_id: 'conversation-1',
          role: 'tool',
          message_type: 'tool_call',
          plain_text: 'Tool call: Propose Workflow Update',
          content: {
            tool_id: 'agency.workflow.propose-update',
            tool_name: 'propose_workflow_update',
            arguments: { workflow_id: 'workflow-1' },
          },
          created_at: '2026-05-06T00:00:10.000Z',
        },
      ],
    });
    conversationsApi.listApprovalRequests.mockResolvedValue({
      items: [
        {
          id: 'approval-restored',
          approval_type: 'workflow_update',
          status: 'pending',
          target_type: 'workflow',
          target_id: 'workflow-1',
          requested_by_agent_id: 'agent-main-1',
          conversation_id: 'conversation-1',
          origin_message_id: 'message-tool-call-approval',
          summary: 'Review restored workflow update',
          diff_summary: 'Updates the workflow steps.',
          proposed_payload: {
            workflow: {
              id: 'workflow-1',
              name: 'Workflow One',
              default_runtime_adapter_id: 'native',
            },
          },
          created_at: '2026-05-06T00:00:20.000Z',
          updated_at: '2026-05-06T00:00:20.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    const panel = await screen.findByRole('region', { name: 'Pending approvals' });
    expect(within(panel).getByText('Review restored workflow update')).toBeInTheDocument();
    expect(screen.getByText('Approval requested')).toBeInTheDocument();
    expect(screen.queryByText('Main is working')).not.toBeInTheDocument();
    expect(screen.queryByText('Executing')).not.toBeInTheDocument();
    expect(screen.queryByText(/taking longer than expected/)).not.toBeInTheDocument();
  });

  it('sends popup page context and provider metadata with user messages', async () => {
    conversationsApi.listConversations.mockResolvedValue({
      items: [
        {
          id: 'conversation-1',
          title: 'Agent chat',
          status: 'open',
          channel_type: 'web',
          created_at: '2026-05-06T00:00:00.000Z',
          updated_at: '2026-05-06T00:00:00.000Z',
          metadata: {
            agent_id: 'agent-main-1',
            page_context: {
              surface: 'agent.list',
              title: 'Agents',
              entities: [{ type: 'agent', id: 'agent-main-1', name: 'Research Agent' }],
              selection: { agentId: 'agent-main-1' },
            },
          },
        },
      ],
    });
    conversationsApi.getConversation.mockResolvedValue({
      id: 'conversation-1',
      title: 'Agent chat',
      status: 'open',
      channel_type: 'web',
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:00:00.000Z',
      metadata: {
        agent_id: 'agent-main-1',
        page_context: {
          surface: 'agent.list',
          title: 'Agents',
          entities: [{ type: 'agent', id: 'agent-main-1', name: 'Research Agent' }],
          selection: { agentId: 'agent-main-1' },
        },
      },
    });
    conversationsApi.postMessage.mockResolvedValue({
      message: {
        id: 'message-popup-user',
        conversation_id: 'conversation-1',
        role: 'user',
        message_type: 'user_text',
        plain_text: 'Update the selected agent.',
        content: { text: 'Update the selected agent.' },
        created_at: '2026-05-06T00:00:02.000Z',
      },
      stream_url: '/conversations/conversation-1/stream?after=message-popup-user',
    });

    renderConversationWorkspace({
      mode: 'popup',
      contextMetadata: () => ({
        page_context: {
          surface: 'agent.list',
          route: '/agents',
          pathname: '/agents',
          title: 'Agents',
          entities: [{ type: 'agent', id: 'agent-main-1', name: 'Research Agent' }],
          selection: { agentId: 'agent-main-1' },
          updatedAt: '2026-05-27T00:00:00.000Z',
        },
        assistant_providers: {
          version: '2026-05-27',
          providers: [
            {
              id: 'agent.provider',
              label: 'Agent provider',
              systemToolIds: ['agency.agent.get', 'agency.agent.propose-update'],
            },
          ],
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('Initial assistant reply')).toBeInTheDocument();
    });
    expect(screen.getByText('Context: Agent: Research Agent')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message Main'), {
      target: { value: 'Update the selected agent.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(conversationsApi.postMessage).toHaveBeenCalledWith(
        'conversation-1',
        expect.objectContaining({
          message: expect.objectContaining({
            metadata: expect.objectContaining({
              page_context: expect.objectContaining({
                surface: 'agent.list',
                selection: expect.objectContaining({ agentId: 'agent-main-1' }),
              }),
              assistant_providers: expect.objectContaining({
                providers: expect.arrayContaining([
                  expect.objectContaining({
                    id: 'agent.provider',
                    systemToolIds: expect.arrayContaining(['agency.agent.propose-update']),
                  }),
                ]),
              }),
            }),
          }),
          response_mode: 'async',
        })
      );
    });
  });

  it('offers safe page-specific prompts that only prefill the popup composer', async () => {
    renderConversationWorkspace({
      mode: 'popup',
      contextMetadata: () => ({
        page_context: {
          surface: 'runs.detail',
          route: '/runs/run-failed',
          pathname: '/runs/run-failed',
          title: 'Failed run',
          entities: [{ type: 'run', id: 'run-failed', name: 'Failed run' }],
          selection: { runId: 'run-failed' },
          suggestedPrompts: [
            {
              id: 'explain-failure',
              label: 'Explain the failure',
              prompt: 'Explain why this run failed using the first actionable error.',
              intent: 'diagnose',
              mutates: false,
            },
          ],
          updatedAt: '2026-05-27T00:00:00.000Z',
        },
      }),
    });

    await screen.findByText('Initial assistant reply');
    fireEvent.click(screen.getByRole('button', { name: 'Use suggestion: Explain the failure' }));

    expect(screen.getByLabelText('Message Main')).toHaveValue(
      'Explain why this run failed using the first actionable error.'
    );
    expect(conversationsApi.postMessage).not.toHaveBeenCalled();
  });

  it('lets assistant chat invoke a published persona by slug', async () => {
    personasApi.listPersonas.mockResolvedValue({
      items: [
        {
          id: 'persona-1',
          slug: 'audit-manager',
          name: 'Audit Manager',
          description: 'Reviews audit workflows.',
          status: 'published',
          current_version_id: 'persona-version-1',
          published_agent_id: 'agent-audit-manager',
          metadata: {},
          created_at: '2026-05-06T00:00:00.000Z',
          updated_at: '2026-05-06T00:00:00.000Z',
        },
      ],
    });
    conversationsApi.postMessage.mockResolvedValue({
      message: {
        id: 'message-persona-user',
        conversation_id: 'conversation-1',
        role: 'user',
        message_type: 'user_text',
        plain_text: '@audit-manager Review this workflow.',
        content: { text: '@audit-manager Review this workflow.' },
        created_at: '2026-05-06T00:00:02.000Z',
      },
    });

    renderConversationWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Mention goal or persona' }));
    const personasTab = await screen.findByRole('tab', { name: /Personas/i });
    fireEvent.keyDown(personasTab, { key: 'Enter', code: 'Enter' });
    fireEvent.click(personasTab);
    const personaButton = (await screen.findByText('Audit Manager')).closest('button');
    if (!personaButton) {
      throw new Error('Persona menu item was not rendered as a button.');
    }
    fireEvent.click(personaButton);

    const input = screen.getByLabelText('Message Main') as HTMLInputElement;
    expect(input.value).toBe('@audit-manager ');
    fireEvent.change(input, {
      target: { value: `${input.value}Review this workflow.` },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(conversationsApi.postMessage).toHaveBeenCalledWith(
        'conversation-1',
        expect.objectContaining({
          message: expect.objectContaining({
            plain_text: '@audit-manager Review this workflow.',
            metadata: expect.objectContaining({
              invoked_persona_slug: 'audit-manager',
              persona_mentions: [
                expect.objectContaining({
                  persona_id: 'persona-1',
                  persona_slug: 'audit-manager',
                  published_agent_id: 'agent-audit-manager',
                }),
              ],
            }),
          }),
        })
      );
    });
  });

  it('keeps empty persona state inside the composer context menu', async () => {
    personasApi.listPersonas.mockResolvedValue({
      items: [
        {
          id: 'persona-draft',
          slug: 'draft-helper',
          name: 'Draft Helper',
          status: 'draft',
          current_version_id: null,
          published_agent_id: null,
          metadata: {},
          created_at: '2026-05-06T00:00:00.000Z',
          updated_at: '2026-05-06T00:00:00.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    expect(
      await screen.findByRole('button', { name: 'Mention goal or persona' })
    ).toBeInTheDocument();
    expect(screen.queryByText('No published personas available.')).not.toBeInTheDocument();
  });

  it('autocompletes persona mentions when typing at-sign', async () => {
    personasApi.listPersonas.mockResolvedValue({
      items: [
        {
          id: 'persona-1',
          slug: 'audit-manager',
          name: 'Audit Manager',
          status: 'published',
          current_version_id: 'persona-version-1',
          published_agent_id: 'agent-audit-manager',
          metadata: {},
          created_at: '2026-05-06T00:00:00.000Z',
          updated_at: '2026-05-06T00:00:00.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    const input = await screen.findByLabelText('Message Main');
    fireEvent.change(input, { target: { value: '@au' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use @audit-manager' }));

    expect((input as HTMLInputElement).value).toBe('@audit-manager ');
  });

  it('shows persona attribution on persona-routed assistant replies', async () => {
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-persona-response',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'assistant_text',
          plain_text: 'I reviewed this as the audit manager.',
          content: { text: 'I reviewed this as the audit manager.' },
          metadata: {
            delivery: 'persona',
            persona_slug: 'audit-manager',
          },
          created_at: '2026-05-06T00:00:02.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    expect(await screen.findByText('Answered as @audit-manager')).toBeInTheDocument();
  });

  it('opens a workflow-related popup conversation instead of the global active chat', async () => {
    conversationsApi.listConversations.mockResolvedValue({
      items: [
        {
          id: 'conversation-1',
          title: 'Global active chat',
          status: 'open',
          channel_type: 'web',
          created_at: '2026-05-06T00:00:00.000Z',
          updated_at: '2026-05-06T00:30:00.000Z',
          metadata: { surface: 'assistant' },
        },
        {
          id: 'workflow-chat-1',
          title: 'Workflow One chat',
          status: 'open',
          channel_type: 'web',
          created_at: '2026-05-06T00:10:00.000Z',
          updated_at: '2026-05-06T00:20:00.000Z',
          metadata: {
            workflow_id: 'workflow-1',
            page_context: {
              surface: 'workflow.detail',
              title: 'Workflow One',
              entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
              selection: { workflowId: 'workflow-1' },
            },
          },
        },
      ],
    });
    conversationsApi.getConversation.mockImplementation(async (conversationId: string) => ({
      id: conversationId,
      title: conversationId === 'workflow-chat-1' ? 'Workflow One chat' : 'Global active chat',
      status: 'open',
      channel_type: 'web',
      metadata:
        conversationId === 'workflow-chat-1'
          ? {
              workflow_id: 'workflow-1',
              page_context: {
                surface: 'workflow.detail',
                title: 'Workflow One',
                entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
                selection: { workflowId: 'workflow-1' },
              },
            }
          : { surface: 'assistant' },
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:20:00.000Z',
    }));
    conversationsApi.listMessages.mockImplementation(async (conversationId: string) => ({
      items:
        conversationId === 'workflow-chat-1'
          ? [
              {
                id: 'workflow-message-1',
                conversation_id: 'workflow-chat-1',
                role: 'assistant',
                message_type: 'assistant_text',
                plain_text: 'Workflow related reply',
                content: { text: 'Workflow related reply' },
                created_at: '2026-05-06T00:10:00.000Z',
              },
            ]
          : [
              {
                id: 'global-message-1',
                conversation_id: 'conversation-1',
                role: 'assistant',
                message_type: 'assistant_text',
                plain_text: 'Global active reply',
                content: { text: 'Global active reply' },
                created_at: '2026-05-06T00:00:00.000Z',
              },
            ],
    }));

    renderConversationWorkspace({
      mode: 'popup',
      contextMetadata: () => ({
        page_context: {
          surface: 'workflow.detail',
          route: '/workflows/workflow-1',
          pathname: '/workflows/workflow-1',
          title: 'Workflow One',
          entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
          selection: { workflowId: 'workflow-1' },
          summary: { workflowId: 'workflow-1' },
          updatedAt: '2026-05-27T00:00:00.000Z',
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('Workflow related reply')).toBeInTheDocument();
    });
    expect(screen.queryByText('Global active reply')).not.toBeInTheDocument();
    expect(conversationsApi.getConversation).toHaveBeenCalledWith('workflow-chat-1');
  });

  it('opens a workflow popup conversation when only a pending approval links it to the workflow', async () => {
    window.localStorage.setItem('agency.active_conversation_id', 'conversation-1');
    conversationsApi.listConversations.mockResolvedValue({
      items: [
        {
          id: 'conversation-1',
          title: 'Assistant approval chat',
          status: 'open',
          channel_type: 'web',
          created_at: '2026-05-06T00:00:00.000Z',
          updated_at: '2026-05-06T00:30:00.000Z',
          metadata: { surface: 'assistant' },
        },
      ],
    });
    conversationsApi.getConversation.mockResolvedValue({
      id: 'conversation-1',
      title: 'Assistant approval chat',
      status: 'open',
      channel_type: 'web',
      metadata: { surface: 'assistant' },
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:30:00.000Z',
    });
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-approval',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'approval_request',
          approval_request_id: 'approval-workflow-1',
          plain_text: 'Approval requested for Workflow One.',
          content: { text: 'Approval requested for Workflow One.' },
          created_at: '2026-05-06T00:20:00.000Z',
        },
      ],
    });
    conversationsApi.listApprovalRequests.mockImplementation(async (conversationId: string) => ({
      items:
        conversationId === 'conversation-1'
          ? [
              {
                id: 'approval-workflow-1',
                approval_type: 'workflow_update',
                status: 'pending',
                target_type: 'workflow',
                target_id: 'workflow-1',
                requested_by_agent_id: 'agent-main-1',
                conversation_id: 'conversation-1',
                origin_message_id: 'message-approval',
                summary: 'Update Workflow One',
                proposed_payload: {
                  workflow: {
                    id: 'workflow-1',
                    name: 'Workflow One',
                  },
                },
                created_at: '2026-05-06T00:20:00.000Z',
                updated_at: '2026-05-06T00:20:00.000Z',
              },
            ]
          : [],
    }));

    renderConversationWorkspace({
      mode: 'popup',
      contextMetadata: () => ({
        page_context: {
          surface: 'workflow.detail',
          route: '/workflows/workflow-1',
          pathname: '/workflows/workflow-1',
          title: 'Workflow One',
          entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
          selection: { workflowId: 'workflow-1' },
          summary: { workflowId: 'workflow-1' },
          updatedAt: '2026-05-27T00:00:00.000Z',
        },
      }),
    });

    const panel = await screen.findByRole('region', { name: 'Pending approvals' });
    expect(within(panel).getByText('Update Workflow One')).toBeInTheDocument();
    expect(screen.getByText('Approval requested for Workflow One.')).toBeInTheDocument();
    expect(conversationsApi.getConversation).toHaveBeenCalledWith('conversation-1');
  });

  it('keeps a workflow popup empty after New Chat so the next message creates a fresh session', async () => {
    conversationsApi.listConversations.mockResolvedValue({
      items: [
        {
          id: 'workflow-chat-1',
          title: 'Workflow One chat',
          status: 'open',
          channel_type: 'web',
          created_at: '2026-05-06T00:10:00.000Z',
          updated_at: '2026-05-06T00:20:00.000Z',
          metadata: {
            workflow_id: 'workflow-1',
            page_context: {
              surface: 'workflow.detail',
              title: 'Workflow One',
              entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
              selection: { workflowId: 'workflow-1' },
            },
          },
        },
      ],
    });
    conversationsApi.getConversation.mockResolvedValue({
      id: 'workflow-chat-1',
      title: 'Workflow One chat',
      status: 'open',
      channel_type: 'web',
      metadata: {
        workflow_id: 'workflow-1',
        page_context: {
          surface: 'workflow.detail',
          title: 'Workflow One',
          entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
          selection: { workflowId: 'workflow-1' },
        },
      },
      created_at: '2026-05-06T00:10:00.000Z',
      updated_at: '2026-05-06T00:20:00.000Z',
    });
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'workflow-message-1',
          conversation_id: 'workflow-chat-1',
          role: 'assistant',
          message_type: 'assistant_text',
          plain_text: 'Workflow related reply',
          content: { text: 'Workflow related reply' },
          created_at: '2026-05-06T00:10:00.000Z',
        },
      ],
    });
    conversationsApi.createConversation.mockResolvedValue({
      id: 'workflow-chat-new',
      title: null,
      status: 'open',
      channel_type: 'web',
      metadata: { workflow_id: 'workflow-1' },
      created_at: '2026-05-06T00:15:00.000Z',
      updated_at: '2026-05-06T00:15:00.000Z',
    });
    conversationsApi.postMessage.mockResolvedValue({
      message: {
        id: 'message-workflow-user',
        conversation_id: 'workflow-chat-new',
        role: 'user',
        message_type: 'user_text',
        plain_text: 'Start a fresh workflow discussion.',
        content: { text: 'Start a fresh workflow discussion.' },
        created_at: '2026-05-06T00:15:01.000Z',
      },
    });

    renderConversationWorkspace({
      mode: 'popup',
      contextMetadata: () => ({
        page_context: {
          surface: 'workflow.detail',
          route: '/workflows/workflow-1',
          pathname: '/workflows/workflow-1',
          title: 'Workflow One',
          entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
          selection: { workflowId: 'workflow-1' },
          summary: { workflowId: 'workflow-1' },
          updatedAt: '2026-05-27T00:00:00.000Z',
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('Workflow related reply')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));

    await waitFor(() => {
      expect(screen.queryByText('Workflow related reply')).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Message Main'), {
      target: { value: 'Start a fresh workflow discussion.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(conversationsApi.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            workflow_id: 'workflow-1',
          }),
        })
      );
    });
    expect(conversationsApi.postMessage).toHaveBeenCalledWith(
      'workflow-chat-new',
      expect.any(Object)
    );
  });

  it('allows a new workflow-scoped popup chat when no related conversation exists', async () => {
    conversationsApi.createConversation.mockResolvedValue({
      id: 'workflow-chat-new',
      title: null,
      status: 'open',
      channel_type: 'web',
      metadata: {
        workflow_id: 'workflow-1',
      },
      created_at: '2026-05-06T00:15:00.000Z',
      updated_at: '2026-05-06T00:15:00.000Z',
    });
    conversationsApi.postMessage.mockResolvedValue({
      message: {
        id: 'message-workflow-user',
        conversation_id: 'workflow-chat-new',
        role: 'user',
        message_type: 'user_text',
        plain_text: 'Help with this workflow.',
        content: { text: 'Help with this workflow.' },
        created_at: '2026-05-06T00:15:01.000Z',
      },
    });

    renderConversationWorkspace({
      mode: 'popup',
      contextMetadata: () => ({
        page_context: {
          surface: 'workflow.detail',
          route: '/workflows/workflow-1',
          pathname: '/workflows/workflow-1',
          title: 'Workflow One',
          entities: [{ type: 'workflow', id: 'workflow-1', name: 'Workflow One' }],
          selection: { workflowId: 'workflow-1' },
          summary: { workflowId: 'workflow-1' },
          updatedAt: '2026-05-27T00:00:00.000Z',
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New conversation' })).toBeInTheDocument();
    });
    expect(conversationsApi.getConversation).not.toHaveBeenCalledWith('conversation-1');

    fireEvent.change(screen.getByLabelText('Message Main'), {
      target: { value: 'Help with this workflow.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(conversationsApi.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            workflow_id: 'workflow-1',
            page_context: expect.objectContaining({
              surface: 'workflow.detail',
              selection: expect.objectContaining({ workflowId: 'workflow-1' }),
            }),
          }),
        })
      );
    });
    expect(conversationsApi.postMessage).toHaveBeenCalledWith(
      'workflow-chat-new',
      expect.objectContaining({
        message: expect.objectContaining({
          metadata: expect.objectContaining({
            page_context: expect.objectContaining({
              summary: expect.objectContaining({ workflowId: 'workflow-1' }),
            }),
          }),
        }),
      })
    );
  });

  it('attaches chat uploads to the conversation files drawer scope', async () => {
    conversationsApi.postMessage.mockResolvedValue({
      message: {
        id: 'message-upload',
        conversation_id: 'conversation-1',
        role: 'user',
        message_type: 'user_text',
        plain_text: 'Uploaded document "brief.pdf" into memory as 2 chunks (document-1).',
        content: { text: 'Uploaded document "brief.pdf" into memory as 2 chunks (document-1).' },
        created_at: '2026-05-06T00:00:03.000Z',
      },
    });

    const view = renderConversationWorkspace();

    await waitFor(() => {
      expect(conversationsApi.getConversation).toHaveBeenCalledWith('conversation-1');
    });

    const fileInput = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hello'], 'brief.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save for retrieval' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(documentsApi.ingestDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
          scope: 'conversation',
          conversationId: 'conversation-1',
          agentId: 'agent-main-1',
          tags: ['chat-upload', 'assistant', 'conversation:conversation-1'],
          autoIntelligence: true,
          allowScopeSuggestion: false,
          allowAgentSuggestion: false,
          purpose: 'conversation',
          uploadMode: 'vector',
        })
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText('Conversation files').length).toBeGreaterThan(0);
    });
  });

  it('renders history controls and reopens a previous conversation from history', async () => {
    conversationsApi.getConversation.mockImplementation(async (conversationId: string) => {
      if (conversationId === 'conversation-2') {
        return {
          id: 'conversation-2',
          title: 'Earlier Conversation',
          status: 'open',
          channel_type: 'web',
          created_at: '2026-05-05T00:00:00.000Z',
          updated_at: '2026-05-05T00:30:00.000Z',
        };
      }

      return {
        id: 'conversation-1',
        title: 'Reconnect Test',
        status: 'open',
        channel_type: 'web',
        created_at: '2026-05-06T00:00:00.000Z',
        updated_at: '2026-05-06T00:00:00.000Z',
      };
    });
    conversationsApi.listMessages.mockImplementation(async (conversationId: string) => {
      if (conversationId === 'conversation-2') {
        return {
          items: [
            {
              id: 'message-old-1',
              conversation_id: 'conversation-2',
              role: 'assistant',
              message_type: 'assistant_text',
              plain_text: 'Previous conversation restored',
              content: { text: 'Previous conversation restored' },
              created_at: '2026-05-05T00:10:00.000Z',
            },
          ],
        };
      }

      return {
        items: [
          {
            id: 'message-1',
            conversation_id: 'conversation-1',
            role: 'user',
            message_type: 'user_text',
            plain_text: 'Initial user message',
            content: { text: 'Initial user message' },
            created_at: '2026-05-06T00:00:00.000Z',
          },
          {
            id: 'message-2',
            conversation_id: 'conversation-1',
            role: 'assistant',
            message_type: 'assistant_text',
            plain_text: 'Initial assistant reply',
            content: { text: 'Initial assistant reply' },
            created_at: '2026-05-06T00:00:01.000Z',
          },
        ],
      };
    });

    renderConversationWorkspace();

    expect(await screen.findByText('Conversation history')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New conversation' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Earlier Conversation' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Earlier Conversation' }));

    await waitFor(() => {
      expect(conversationsApi.getConversation).toHaveBeenCalledWith('conversation-2');
    });
    expect(await screen.findByText('Previous conversation restored')).toBeInTheDocument();
  });

  it('starts a fresh draft when creating a new conversation from the assistant page', async () => {
    renderConversationWorkspace();

    expect(await screen.findByText('Initial assistant reply')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));

    await waitFor(() => {
      expect(screen.getByText('Conversation will be created on first message')).toBeInTheDocument();
    });
    expect(screen.queryByText('Initial assistant reply')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('agency.active_conversation_id')).toBeNull();
  });

  it('previews and saves compact packs from the conversation header', async () => {
    conversationsApi.listCompactPacks.mockResolvedValue({
      items: [
        {
          id: 'memory-pack-1',
          scope: 'conversation',
          content: 'Saved compact pack content',
          summary: 'Saved handoff pack',
          tags: ['context_pack', 'conversation', 'handoff'],
          sensitive: false,
          conversation_id: 'conversation-1',
          memory_type: 'context_pack',
          status: 'active',
          metadata: { mode: 'handoff' },
        },
      ],
    });
    conversationsApi.compactConversation
      .mockResolvedValueOnce({
        status: 'preview',
        memory_id: null,
        mode: 'handoff',
        format: 'markdown',
        scope: 'conversation',
        source_range: 'full',
        content: 'Preview context pack',
        summary: 'Preview pack',
        structured: {},
        source_message_count: 2,
        estimated_source_tokens: 120,
        estimated_compact_tokens: 80,
        sensitive: false,
        warnings: [],
        progress: { completed_steps: 6, failed_steps: 0, events: [] },
      })
      .mockResolvedValueOnce({
        status: 'created',
        memory_id: 'memory-pack-2',
        mode: 'handoff',
        format: 'markdown',
        scope: 'conversation',
        source_range: 'full',
        content: 'Saved context pack',
        summary: 'Saved pack',
        structured: {},
        source_message_count: 2,
        estimated_source_tokens: 120,
        estimated_compact_tokens: 80,
        sensitive: false,
        warnings: [],
        progress: { completed_steps: 7, failed_steps: 0, events: [] },
      });

    renderConversationWorkspace();

    expect(await screen.findByText('Initial assistant reply')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }));

    expect(await screen.findByText('Compact conversation')).toBeInTheDocument();
    expect(await screen.findByText('Saved handoff pack')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create workflow' }));

    await waitFor(() => {
      expect(workflowsApi.createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            created_from: 'context_pack',
            context_pack_id: 'memory-pack-1',
          }),
          task_definitions: [
            expect.objectContaining({
              instructions: expect.stringContaining('Saved compact pack content'),
            }),
          ],
        })
      );
    });
    expect(pushMock).toHaveBeenCalledWith('/workflows/workflow-from-pack');

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(conversationsApi.compactConversation).toHaveBeenCalledWith(
        'conversation-1',
        expect.objectContaining({
          mode: 'handoff',
          token_budget: 1200,
          source_range: 'full',
          persist: false,
        })
      );
    });
    expect(await screen.findByText('Preview context pack')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Save to memory'));
    fireEvent.click(screen.getByRole('button', { name: 'Save pack' }));

    await waitFor(() => {
      expect(conversationsApi.compactConversation).toHaveBeenLastCalledWith(
        'conversation-1',
        expect.objectContaining({
          persist: true,
          supersede_previous: true,
        })
      );
    });
    expect(await screen.findByText('Saved context pack')).toBeInTheDocument();
  });

  it('runs linked workflows with the native-first adapter selection', async () => {
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-1',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'tool_result',
          plain_text: 'Workflow ready',
          content: {
            tool_name: 'create_workflow',
            result: {
              workflow_id: 'workflow-1',
            },
          },
          created_at: '2026-05-06T00:00:00.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    const runButtons = await screen.findAllByRole('button', { name: 'Run workflow (native)' });
    fireEvent.click(runButtons[0]);

    await waitFor(() => {
      expect(workflowsApi.getWorkflow).toHaveBeenCalledWith('workflow-1');
    });
    await waitFor(() => {
      expect(runsApi.executeWorkflow).toHaveBeenCalledWith('workflow-1', 'native', 'local');
    });
    expect(pushMock).toHaveBeenCalledWith('/runs/run-1');
  });

  it('renders approval payload inspection and generated workflow diffs', async () => {
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-proposal',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'workflow_update_proposal',
          approval_request_id: 'approval-1',
          plain_text: 'Review this workflow update.',
          content: {
            workflow: {
              id: 'workflow-1',
              name: 'Workflow One',
              version: '0.2.0',
              revision: 2,
            },
          },
          created_at: '2026-05-06T00:00:00.000Z',
        },
      ],
    });
    conversationsApi.listApprovalRequests.mockResolvedValue({
      items: [
        {
          id: 'approval-1',
          approval_type: 'workflow_update',
          status: 'pending',
          target_type: 'workflow',
          target_id: 'workflow-1',
          requested_by_agent_id: 'agent-main-1',
          conversation_id: 'conversation-1',
          origin_message_id: 'message-proposal',
          summary: 'Update Workflow One',
          diff_summary: 'Changes workflow description and task list.',
          proposed_payload: {
            workflow: {
              id: 'workflow-1',
              name: 'Workflow One',
              description: 'New description',
              entrypoint: 'task-1',
              default_runtime_adapter_id: 'native',
              agent_definitions: [],
              task_definitions: [{ id: 'task-1', name: 'Task One' }],
              tool_definitions: [],
            },
          },
          metadata: {
            action: 'workflow_update',
            generated_by: 'main-agent',
          },
          created_at: '2026-05-06T00:00:00.000Z',
          updated_at: '2026-05-06T00:00:00.000Z',
        },
      ],
    });
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Old description',
      entrypoint: 'task-1',
      default_runtime_adapter_id: 'crewai',
      agent_definitions: [],
      task_definitions: [],
      tool_definitions: [],
    });

    renderConversationWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Workflow update proposal')).toBeInTheDocument();
    });
    const proposalSection = screen.getByText('Workflow update proposal').closest('div.space-y-2');
    expect(proposalSection).not.toBeNull();
    fireEvent.click(
      within(proposalSection as HTMLElement).getByRole('button', { name: 'Show details' })
    );
    expect(await screen.findByText('Detailed Generated Diff')).toBeInTheDocument();
    expect(screen.getAllByText('Full Proposed Payload').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Approval Metadata').length).toBeGreaterThan(0);
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getAllByText(/Old description -> New description/).length).toBeGreaterThan(0);
    expect(screen.getByText('default_runtime_adapter_id')).toBeInTheDocument();
    expect(screen.getAllByText(/crewai -> native/).length).toBeGreaterThan(0);
    expect(screen.getByText('task_definitions[task-1]')).toBeInTheDocument();
    expect(screen.getAllByText(/generated_by/).length).toBeGreaterThan(0);
  });

  it('does not render the visible workflows panel in the simplified chat shell', async () => {
    renderConversationWorkspace();

    expect(await screen.findByText('Conversation history')).toBeInTheDocument();
    expect(workflowsApi.listWorkflows).not.toHaveBeenCalled();
    expect(screen.queryByText('Accessible workflows')).not.toBeInTheDocument();
    expect(screen.queryByText('Visible Workflow')).not.toBeInTheDocument();
    expect(screen.queryByText('Approval required')).not.toBeInTheDocument();
    expect(screen.queryByText('Mutable')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden Workflow')).not.toBeInTheDocument();
  });

  it('shows a pending approval queue with payload summaries and decision actions', async () => {
    conversationsApi.listApprovalRequests.mockResolvedValue({
      items: [
        {
          id: 'approval-pending',
          approval_type: 'workflow_create',
          status: 'pending',
          target_type: 'workflow',
          target_id: 'workflow-new',
          requested_by_agent_id: 'agent-main-1',
          conversation_id: 'conversation-1',
          origin_message_id: 'message-approval',
          summary: 'Create Research Brief Workflow',
          diff_summary: 'Creates a workflow that drafts a research brief from a topic.',
          proposed_payload: {
            workflow: {
              id: 'workflow-new',
              name: 'Research Brief Workflow',
              default_runtime_adapter_id: 'native',
            },
            input_payload: {
              topic: 'local model routing',
            },
          },
          metadata: {
            action: 'workflow_create',
          },
          created_at: '2026-05-06T00:00:02.000Z',
          updated_at: '2026-05-06T00:00:02.000Z',
        },
        {
          id: 'approval-approved',
          approval_type: 'workflow_update',
          status: 'approved',
          target_type: 'workflow',
          target_id: 'workflow-old',
          requested_by_agent_id: 'agent-main-1',
          conversation_id: 'conversation-1',
          origin_message_id: 'message-approved',
          summary: 'Approved old action',
          proposed_payload: {},
          created_at: '2026-05-06T00:00:01.000Z',
          updated_at: '2026-05-06T00:00:01.000Z',
        },
      ],
    });
    conversationsApi.approveApprovalRequest.mockResolvedValue({
      approval_request: {
        id: 'approval-pending',
        approval_type: 'workflow_create',
        status: 'approved',
        target_type: 'workflow',
        target_id: 'workflow-new',
        requested_by_agent_id: 'agent-main-1',
        conversation_id: 'conversation-1',
        origin_message_id: 'message-approval',
        summary: 'Create Research Brief Workflow',
        proposed_payload: {},
        created_at: '2026-05-06T00:00:02.000Z',
        updated_at: '2026-05-06T00:00:03.000Z',
      },
    });

    renderConversationWorkspace();

    const panel = await screen.findByRole('region', { name: 'Pending approvals' });
    expect(within(panel).getByText('Create Research Brief Workflow')).toBeInTheDocument();
    expect(
      within(panel).getByText('Creates a workflow that drafts a research brief from a topic.')
    ).toBeInTheDocument();
    expect(within(panel).getByText('Research Brief Workflow')).toBeInTheDocument();
    expect(within(panel).getByText('topic')).toBeInTheDocument();
    expect(within(panel).queryByText('Approved old action')).not.toBeInTheDocument();
    expect(within(panel).getByTestId('pending-approvals-list')).toHaveClass('overflow-y-auto');

    fireEvent.click(within(panel).getByRole('button', { name: 'Collapse approvals' }));

    expect(
      within(panel).getByText('1 pending approval hidden. Expand to review and act on them.')
    ).toBeInTheDocument();
    expect(within(panel).queryByText('Create Research Brief Workflow')).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Expand approvals' })).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Expand approvals' }));

    expect(within(panel).getByText('Create Research Brief Workflow')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(conversationsApi.approveApprovalRequest).toHaveBeenCalledWith('approval-pending', {
        user_id: 'dev-user',
      });
    });
  });

  it('rejects pending approvals without applying the proposed payload', async () => {
    conversationsApi.listApprovalRequests.mockResolvedValue({
      items: [
        {
          id: 'approval-pending',
          approval_type: 'agent_update',
          status: 'pending',
          target_type: 'agent',
          target_id: 'agent-main-1',
          requested_by_agent_id: 'agent-main-1',
          conversation_id: 'conversation-1',
          origin_message_id: 'message-approval',
          summary: 'Update Research Agent',
          diff_summary: 'Changes the agent instructions.',
          proposed_payload: {
            diff: [
              {
                path: 'instructions',
                current: 'Keep existing instructions.',
                proposed: 'Use the new instructions.',
              },
            ],
            agent: {
              id: 'agent-main-1',
              name: 'Research Agent',
              instructions: 'Use the new instructions.',
            },
          },
          metadata: {
            action: 'agent_update',
            source: 'popup_assistant',
            source_page_context: {
              surface: 'agent.list',
              route: '/agents',
              title: 'Agents',
              selection: { agentId: 'agent-main-1' },
              entities: [{ type: 'agent', id: 'agent-main-1', label: 'Research Agent' }],
            },
            source_provider_ids: ['agent.provider'],
          },
          created_at: '2026-05-06T00:00:02.000Z',
          updated_at: '2026-05-06T00:00:02.000Z',
        },
      ],
    });
    conversationsApi.rejectApprovalRequest.mockResolvedValue({
      approval_request: {
        id: 'approval-pending',
        approval_type: 'agent_update',
        status: 'rejected',
        target_type: 'agent',
        target_id: 'agent-main-1',
        requested_by_agent_id: 'agent-main-1',
        conversation_id: 'conversation-1',
        origin_message_id: 'message-approval',
        summary: 'Update Research Agent',
        proposed_payload: {},
        decision_reason: 'Rejected by user.',
        created_at: '2026-05-06T00:00:02.000Z',
        updated_at: '2026-05-06T00:00:03.000Z',
      },
    });

    renderConversationWorkspace();

    const panel = await screen.findByRole('region', { name: 'Pending approvals' });
    expect(within(panel).getByText('Update Research Agent')).toBeInTheDocument();
    expect(within(panel).getByText('Source: Agent: Research Agent')).toBeInTheDocument();
    expect(within(panel).getByText('agent.provider')).toBeInTheDocument();
    fireEvent.click(within(panel).getByText('Full Proposed Payload'));
    expect(within(panel).getByText('instructions')).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Reject' }));

    await waitFor(() => {
      expect(conversationsApi.rejectApprovalRequest).toHaveBeenCalledWith('approval-pending', {
        user_id: 'dev-user',
      });
    });
    expect(conversationsApi.approveApprovalRequest).not.toHaveBeenCalled();
  });

  it('renders execution timeline events inside execution chat cards', async () => {
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-execution',
          conversation_id: 'conversation-1',
          role: 'system',
          message_type: 'execution_started',
          execution_id: 'run-timeline-1',
          plain_text: 'Execution started.',
          content: {
            execution_id: 'run-timeline-1',
            workflow_id: 'workflow-1',
            workflow_name: 'Research Brief Workflow',
            status: 'running',
          },
          created_at: '2026-05-06T00:00:00.000Z',
        },
      ],
    });
    logsApi.getRunTimeline.mockResolvedValue({
      execution: {
        id: 'run-timeline-1',
        status: 'running',
      },
      execution_duration_ms: 450,
      events: [
        {
          id: 'event-1',
          execution_id: 'run-timeline-1',
          workflow_id: 'workflow-1',
          event_type: 'execution.started',
          sequence: 1,
          timestamp: '2026-05-06T00:00:01.000Z',
          payload: {
            summary: 'Started native execution.',
          },
        },
        {
          id: 'event-2',
          execution_id: 'run-timeline-1',
          workflow_id: 'workflow-1',
          event_type: 'tool.call.completed',
          sequence: 2,
          timestamp: '2026-05-06T00:00:02.000Z',
          payload: {
            tool_name: 'search_docs',
            message: 'Tool completed.',
          },
        },
      ],
    });

    renderConversationWorkspace();

    const executionCard = await screen.findByText('run-timeline-1');
    const executionContainer = executionCard.closest('div.mr-auto');
    expect(executionContainer).not.toBeNull();
    fireEvent.click(
      within(executionContainer as HTMLElement).getByRole('button', { name: 'Show details' })
    );
    expect(await screen.findByText('Execution timeline')).toBeInTheDocument();
    expect(screen.getByText('2 events')).toBeInTheDocument();
    expect(screen.getByText('450 ms')).toBeInTheDocument();
    expect(screen.getByText('execution started')).toBeInTheDocument();
    expect(screen.getByText('tool call completed')).toBeInTheDocument();
    expect(screen.getByText('Started native execution.')).toBeInTheDocument();
    expect(screen.getByText(/Tool completed/)).toBeInTheDocument();
    expect(logsApi.getRunTimeline).toHaveBeenCalledWith('run-timeline-1');
  });

  it('redacts sensitive fields in tool call and result cards', async () => {
    conversationsApi.listMessages.mockResolvedValue({
      items: [
        {
          id: 'message-tool-call',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'tool_call',
          plain_text: 'Calling tool.',
          content: {
            tool_name: 'http_request',
            tool_id: 'tool-http',
            arguments: {
              url: 'https://api.example.test/data',
              headers: {
                Authorization: 'Bearer super-secret-token',
              },
              api_key: 'sk-testsecret123456',
              max_tokens: 2000,
            },
          },
          created_at: '2026-05-06T00:00:00.000Z',
        },
        {
          id: 'message-tool-result',
          conversation_id: 'conversation-1',
          role: 'assistant',
          message_type: 'tool_result',
          plain_text: 'Tool result.',
          content: {
            tool_name: 'http_request',
            tool_id: 'tool-http',
            result: {
              status: 'ok',
              workflow_id: 'workflow-1',
              body: {
                access_token: 'ghp_supersecret123456',
                nested: {
                  password: 'plain-password',
                },
                safe_value: 'public result',
              },
            },
          },
          created_at: '2026-05-06T00:00:01.000Z',
        },
      ],
    });

    renderConversationWorkspace();

    expect(await screen.findByText('Tool call')).toBeInTheDocument();
    const toolCallSection = screen.getByText('Tool call').closest('div.space-y-2');
    const toolResultSection = screen.getByText('Tool result').closest('div.space-y-2');
    expect(toolCallSection).not.toBeNull();
    expect(toolResultSection).not.toBeNull();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByText('Executing')).not.toBeInTheDocument();
    fireEvent.click(
      within(toolCallSection as HTMLElement).getByRole('button', { name: 'Show details' })
    );
    expect(screen.getByText('Arguments (Redacted)')).toBeInTheDocument();
    expect(screen.queryByText('Result (Redacted)')).not.toBeInTheDocument();
    fireEvent.click(
      within(toolResultSection as HTMLElement).getByRole('button', { name: 'Show details' })
    );
    expect(screen.getByText('Result (Redacted)')).toBeInTheDocument();
    expect(screen.getAllByText(/\[REDACTED\]/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/max_tokens/)).toBeInTheDocument();
    expect(screen.getByText(/2000/)).toBeInTheDocument();
    expect(screen.getByText(/public result/)).toBeInTheDocument();
    expect(screen.queryByText(/super-secret-token/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sk-testsecret123456/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ghp_supersecret123456/)).not.toBeInTheDocument();
    expect(screen.queryByText(/plain-password/)).not.toBeInTheDocument();
  });

  it('shows a degraded simplified chat shell when main agent details are unavailable', async () => {
    window.localStorage.clear();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    conversationsApi.getMainAgent.mockRejectedValue(new Error('main agent missing'));

    renderConversationWorkspace();

    expect(await screen.findByRole('heading', { name: 'Main Agent Chat' })).toBeInTheDocument();
    expect(screen.getByText('Chat with Main Agent.')).toBeInTheDocument();
    expect(
      screen.getByText('Active main-agent details are temporarily unavailable.')
    ).toBeInTheDocument();
    expect(screen.getByText('Conversation will be created on first message')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Main agent setup required' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Assistant bootstrap')).not.toBeInTheDocument();
    expect(conversationsApi.getConversation).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to resolve active main agent profile',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });
});
