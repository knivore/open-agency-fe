import type { ButtonHTMLAttributes } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationWorkspace from '@/components/conversations/ConversationWorkspace';

const {
  conversationsApi,
  agentsApi,
  logsApi,
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
    listMessages: vi.fn(),
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
  logsApi: {
    getRunTimeline: vi.fn(),
  },
  runsApi: {
    executeWorkflow: vi.fn(),
  },
  runtimeAdaptersApi: {
    listRuntimeAdapters: vi.fn(),
  },
  workflowsApi: {
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

vi.mock('@/lib/api/backend', () => ({
  conversationsApi,
  agentsApi,
  logsApi,
  runsApi,
  runtimeAdaptersApi,
  workflowsApi,
}));

vi.mock('@/components/conversations/TextMessage', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('@/components/library/shadcn/button', () => ({
  Button: ({
    children,
    asChild,
    variant,
    size,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    variant?: string;
    size?: string;
  }) => {
    void asChild;
    void variant;
    void size;
    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  },
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

function renderConversationWorkspace() {
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
      <ConversationWorkspace />
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
      name: 'Agency Assistant',
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
    conversationsApi.listApprovalRequests.mockResolvedValue({ items: [] });
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
    expect(screen.queryByText('Runs as Agency Assistant')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Initial assistant reply')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    vi.useFakeTimers();

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
    const earlierConversationButton = await screen.findByRole('button', {
      name: 'Earlier Conversation',
    });
    expect(earlierConversationButton).toBeInTheDocument();

    fireEvent.click(earlierConversationButton);

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
    expect(await screen.findByText('Detailed Generated Diff')).toBeInTheDocument();
    expect(screen.getAllByText('Full Proposed Payload').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Approval Metadata').length).toBeGreaterThan(0);
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getAllByText('Old description').length).toBeGreaterThan(0);
    expect(screen.getAllByText('New description').length).toBeGreaterThan(0);
    expect(screen.getByText('default_runtime_adapter_id')).toBeInTheDocument();
    expect(screen.getAllByText(/generated_by/).length).toBeGreaterThan(0);
  });

  it('does not render the visible workflows panel in the simplified chat shell', async () => {
    workflowsApi.listWorkflows.mockResolvedValue({
      items: [
        {
          id: 'workflow-visible',
          name: 'Visible Workflow',
          description: 'Can be accessed by the main agent',
          metadata: {
            visible_to_main_agent: true,
            protected_execution: true,
            mutable_by_main_agent: true,
            inputs: ['topic'],
          },
          task_definitions: [{ id: 'task-1', name: 'Task One' }],
          agent_definitions: [{ id: 'agent-1', name: 'Agent One' }],
        },
        {
          id: 'workflow-hidden',
          name: 'Hidden Workflow',
          metadata: {
            visible_to_main_agent: false,
          },
        },
      ],
    });

    renderConversationWorkspace();

    await waitFor(() => {
      expect(workflowsApi.listWorkflows).toHaveBeenCalled();
    });
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

    fireEvent.click(within(panel).getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(conversationsApi.approveApprovalRequest).toHaveBeenCalledWith('approval-pending', {
        user_id: 'local-user',
      });
    });
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
    expect(screen.getByText('Arguments (Redacted)')).toBeInTheDocument();
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
