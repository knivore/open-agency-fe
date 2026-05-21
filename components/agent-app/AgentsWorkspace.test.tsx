import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentsWorkspace from '@/components/agent-app/AgentsWorkspace';

const { agentsApi, behaviorProfilesApi, conversationsApi, toolsApi } = vi.hoisted(
  () => ({
    agentsApi: {
      listAgentCatalog: vi.fn(),
      createAgent: vi.fn(),
      updateAgent: vi.fn(),
      deleteAgent: vi.fn(),
    },
    behaviorProfilesApi: {
      listProfiles: vi.fn(),
    },
    conversationsApi: {
      getMainAgent: vi.fn(),
      updateMainAgent: vi.fn(),
    },
    toolsApi: {
      listTools: vi.fn(),
    },
  })
);

vi.mock('@/lib/api/backend', () => ({
  agentsApi,
  behaviorProfilesApi,
  conversationsApi,
  toolsApi,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
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

vi.mock('@/components/library/shadcn/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectTrigger: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({
    children,
    value,
    ...props
  }: { children: ReactNode; value: string } & HTMLAttributes<HTMLOptionElement>) => (
    <option value={value} {...props}>
      {children}
    </option>
  ),
}));

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AgentsWorkspace />
    </QueryClientProvider>
  );
}

describe('AgentsWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    agentsApi.listAgentCatalog.mockResolvedValue([
      {
        id: 'agent-main-1',
        name: 'Agency Assistant',
        description: 'Default assistant',
        config: {
          instructions: 'Be helpful.',
          modelProfileId: 'profile-1',
          toolIds: [],
          handoffAgentIds: [],
        },
      },
      {
        id: 'agent-other-1',
        name: 'Research Agent',
        description: 'Secondary agent',
        config: {
          instructions: 'Research things.',
          modelProfileId: 'profile-2',
          toolIds: ['tool-search'],
          handoffAgentIds: [],
        },
      },
    ]);
    conversationsApi.getMainAgent.mockResolvedValue({
      id: 'main-profile-1',
      name: 'Main',
      description: 'Main Agent',
      agent_id: 'agent-main-1',
      default_workflow_id: 'workflow-main-1',
      default_model_profile_id: 'profile-1',
    });
    conversationsApi.updateMainAgent.mockResolvedValue({
      id: 'main-profile-1',
      name: 'Main',
      description: 'Main Agent',
      agent_id: 'agent-main-1',
      default_workflow_id: 'workflow-main-1',
      default_model_profile_id: 'profile-3',
    });
    behaviorProfilesApi.listProfiles.mockResolvedValue([
      {
        id: 'profile-1',
        name: 'Primary Profile',
        provider: 'provider-openai',
        model: 'gpt-4.1',
      },
      {
        id: 'profile-2',
        name: 'Research Profile',
        provider: 'provider-openai',
        model: 'gpt-4.1-mini',
      },
      {
        id: 'profile-3',
        name: 'Operations Profile',
        provider: 'provider-openai',
        model: 'gpt-4.1-nano',
      },
    ]);
    toolsApi.listTools.mockResolvedValue({
      items: [
        {
          id: 'tool-search',
          name: 'Search Tool',
          description: 'Search external knowledge.',
        },
        {
          id: 'tool-email',
          name: 'Email Tool',
          description: 'Send outbound messages.',
        },
      ],
    });
    agentsApi.updateAgent.mockResolvedValue({
      id: 'agent-main-1',
      name: 'Agency Assistant Updated',
    });
    agentsApi.createAgent.mockResolvedValue({
      id: 'agent-new-1',
      name: 'Ops Agent',
    });
    agentsApi.deleteAgent.mockResolvedValue({
      deleted: true,
      id: 'agent-other-1',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('marks the active main agent and saves edits through backend agents api', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Main')).toBeInTheDocument();
    });
    expect(screen.getByText('Main agent')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit agent' })[0]);

    const nameInput = screen.getByLabelText('Name');
    const roleInput = screen.getByLabelText('Role');
    const instructionsInput = screen.getByLabelText('Instructions');
    const profileSelect = screen.getByLabelText('Model profile');
    const searchToolCheckbox = screen.getByRole('checkbox', { name: /Search Tool/i });

    fireEvent.change(nameInput, { target: { value: 'Jarvis' } });
    fireEvent.change(roleInput, { target: { value: 'Main Agent' } });
    fireEvent.change(instructionsInput, { target: { value: 'Be extra helpful.' } });
    fireEvent.change(profileSelect, { target: { value: 'profile-3' } });
    fireEvent.click(searchToolCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(conversationsApi.updateMainAgent).toHaveBeenCalledWith({
        name: 'Jarvis',
        default_model_profile_id: 'profile-3',
      });
    });

    await waitFor(() => {
      expect(agentsApi.updateAgent).toHaveBeenCalledWith('agent-main-1', {
        name: 'Jarvis',
        description: 'Default assistant',
        instructions: 'Be extra helpful.',
        role: 'Main Agent',
        model_profile_id: 'profile-3',
        tool_ids: ['tool-search'],
      });
    });
  });

  it('shows assigned tools on agent cards before editing', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Research Agent')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Assigned tools')).toHaveLength(2);
    expect(screen.getByText('Search Tool')).toBeInTheDocument();
    expect(screen.queryByText('Select document')).not.toBeInTheDocument();
  });

  it('renders agents that are missing normalized config', async () => {
    agentsApi.listAgentCatalog.mockResolvedValue([
      {
        id: 'agent-legacy-1',
        name: 'Legacy Agent',
        description: 'Legacy backend shape',
        instructions: 'Use the legacy fields.',
        model_profile_id: 'profile-2',
        tool_ids: ['tool-search'],
        handoff_agent_ids: [],
      },
    ]);
    conversationsApi.getMainAgent.mockResolvedValue({
      id: 'main-profile-1',
      name: 'Main',
      description: 'Main Agent',
      agent_id: 'agent-missing',
      default_workflow_id: 'workflow-main-1',
      default_model_profile_id: 'profile-1',
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Legacy Agent')).toBeInTheDocument();
    });

    expect(screen.getByText('Research Profile')).toBeInTheDocument();
    expect(screen.getByText('Search Tool')).toBeInTheDocument();
  });

  it('shows a warning when the active main-agent lookup fails', async () => {
    conversationsApi.getMainAgent.mockRejectedValue(new Error('lookup failed'));

    renderWorkspace();

    await waitFor(() => {
      expect(
        screen.getByText('The active main-agent lookup is currently unavailable.')
      ).toBeInTheDocument();
    });
  });

  it('creates a new agent through the backend agents api', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Main')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'New agent' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ops Agent' } });
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Handle operational requests.' },
    });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Operations' } });
    fireEvent.change(screen.getByLabelText('Model profile'), { target: { value: 'profile-3' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Email Tool/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));

    await waitFor(() => {
      expect(agentsApi.createAgent).toHaveBeenCalledWith({
        name: 'Ops Agent',
        description: null,
        instructions: 'Handle operational requests.',
        role: 'Operations',
        model_profile_id: 'profile-3',
        tool_ids: ['tool-email'],
        handoff_agent_ids: [],
      });
    });
  });

  it('supports all and no tool assignment shortcuts when creating agents', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Main')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'New agent' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'All Tool Agent' } });
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Use every assigned tool when useful.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'All tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'No tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'All tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));

    await waitFor(() => {
      expect(agentsApi.createAgent).toHaveBeenCalledWith({
        name: 'All Tool Agent',
        description: null,
        instructions: 'Use every assigned tool when useful.',
        role: null,
        model_profile_id: null,
        tool_ids: ['tool-search', 'tool-email'],
        handoff_agent_ids: [],
      });
    });
  });

  it('groups tool assignment options and supports group selection', async () => {
    toolsApi.listTools.mockResolvedValue({
      items: [
        {
          id: 'tool-browser',
          name: 'Capture Browser Screenshot',
          description: 'Capture the current browser page screenshot.',
        },
        {
          id: 'tool-file',
          name: 'Convert Markdown to Word',
          description: 'Convert markdown text into a Word document.',
        },
        {
          id: 'tool-command',
          name: 'Run Command',
          description: 'Run CLI commands in the selected workspace.',
        },
      ],
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Main')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit agent' })[0]);

    expect(screen.getByText('Browser and Screenshots')).toBeInTheDocument();
    expect(screen.getByText('Files and Documents')).toBeInTheDocument();
    expect(screen.getByText('System and Command')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Select group' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(agentsApi.updateAgent).toHaveBeenCalledWith(
        'agent-main-1',
        expect.objectContaining({
          tool_ids: ['tool-browser'],
        })
      );
    });
  });

  it('deletes a non-main agent through the backend agents api', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Research Agent')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit agent' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete agent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(agentsApi.deleteAgent).toHaveBeenCalledWith('agent-other-1');
    });
  });
});
