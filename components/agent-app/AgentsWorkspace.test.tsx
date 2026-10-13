import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from 'react';
import {forwardRef} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import AgentsWorkspace from '@/components/agent-app/AgentsWorkspace';

const {router} = vi.hoisted(() => ({router: {push: vi.fn()}}));
vi.mock('next/navigation', () => ({useRouter: () => router}));

const {
  agentsApi,
  behaviorProfilesApi,
  conversationsApi,
  documentsApi,
  memoriesApi,
  personasApi,
  toolsApi,
} = vi.hoisted(() => ({
  agentsApi: {
    listAgentCatalog: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    previewAgentImport: vi.fn(),
    previewAgentImportFile: vi.fn(),
    previewAgentImportFiles: vi.fn(),
    commitAgentImport: vi.fn(),
    commitAgentImportBatch: vi.fn(),
  },
  behaviorProfilesApi: {
    listProfiles: vi.fn(),
  },
  conversationsApi: {
    getMainAgent: vi.fn(),
    updateMainAgent: vi.fn(),
  },
  documentsApi: {
    listDocuments: vi.fn(),
    deleteDocument: vi.fn(),
    analyzeUpload: vi.fn(),
    ingestDocument: vi.fn(),
  },
  memoriesApi: {
    listMemories: vi.fn(),
    deleteDocumentMemories: vi.fn(),
  },
  personasApi: {
    listPersonas: vi.fn(),
  },
  toolsApi: {
    listTools: vi.fn(),
  },
}));
const {useRegisterAssistantPageContext} = vi.hoisted(() => ({
  useRegisterAssistantPageContext: vi.fn(),
}));

vi.mock('@/lib/api/backend/agents', () => ({
  agentsApi,
}));

vi.mock('@/lib/api/backend/behaviorProfiles', () => ({
  behaviorProfilesApi,
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

vi.mock('@/lib/api/backend/personas', () => ({
  personasApi,
}));

vi.mock('@/lib/api/backend/tools', () => ({
  toolsApi,
}));

vi.mock('@/components/assistant/AssistantPageContext', () => ({
  useRegisterAssistantPageContext,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock('@/components/library/shadcn/button', () => ({
  buttonVariants: () => '',
  Button: forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
    function ButtonMock({children, ...props}, ref) {
      return (
        <button ref={ref} type="button" {...props}>
          {children}
        </button>
      );
    }
  ),
}));

vi.mock('@/components/library/shadcn/label', () => ({
  Label: ({children, ...props}: LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/library/shadcn/select', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/library/shadcn/select')>()),
  Select: ({children}: { children: ReactNode }) => <>{children}</>,
  SelectTrigger: ({children, ...props}: HTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({children}: { children?: ReactNode }) => <>{children}</>,
  SelectContent: ({children}: { children: ReactNode }) => <>{children}</>,
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
      <AgentsWorkspace/>
    </QueryClientProvider>
  );
}

function openToolGroup(name: RegExp | string) {
  fireEvent.click(screen.getByRole('button', {name}));
}

function openToolAssignment() {
  if (screen.queryByRole('dialog')) fireEvent.click(screen.getByText('Tool access'));
  else fireEvent.mouseDown(screen.getByRole('tab', {name: /^Capabilities/}), {button: 0, ctrlKey: false});
}

describe('AgentsWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    agentsApi.listAgentCatalog.mockResolvedValue([
      {
        id: 'agent-main-1',
        name: 'Open Agency Assistant',
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
    memoriesApi.listMemories.mockResolvedValue({items: []});
    personasApi.listPersonas.mockResolvedValue({
      items: [
        {
          id: 'persona-1',
          name: 'Audit Manager',
          slug: 'audit-manager',
          status: 'published',
          description: 'Reviews audit workpapers.',
          metadata: {},
        },
      ],
    });
    conversationsApi.updateMainAgent.mockResolvedValue({
      id: 'main-profile-1',
      name: 'Main',
      description: 'Main Agent',
      agent_id: 'agent-main-1',
      default_workflow_id: 'workflow-main-1',
      default_model_profile_id: 'profile-3',
    });
    documentsApi.listDocuments.mockResolvedValue({items: []});
    documentsApi.analyzeUpload.mockResolvedValue({filename: 'agent-notes.md', source: 'fallback', document_kind: 'general', summary: 'Reference material.', confidence: 1, rationale: 'Provided context.', recommended: {}});
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
          routing: {group: 'memory.read'},
          description: 'Search external knowledge.',
        },
        {
          id: 'tool-email',
          name: 'Email Tool',
          routing: {group: 'connector.write'},
          description: 'Send outbound messages.',
        },
      ],
    });
    agentsApi.updateAgent.mockResolvedValue({
      id: 'agent-main-1',
      name: 'Open Agency Assistant Updated',
    });
    agentsApi.createAgent.mockResolvedValue({
      id: 'agent-new-1',
      name: 'Ops Agent',
    });
    agentsApi.deleteAgent.mockResolvedValue({
      deleted: true,
      id: 'agent-other-1',
    });
    agentsApi.previewAgentImport.mockResolvedValue({
      source: {
        source_type: 'text',
        filename: 'frontend.md',
        sha256: 'sha',
      },
      detected_format: 'agency_agents_markdown',
      agent: {
        id: 'frontend-developer',
        name: 'Frontend Developer',
        description: 'Builds accessible interfaces.',
        instructions: '# Frontend Developer\nBuild accessible interfaces.',
        role: 'Frontend implementation specialist',
        tool_ids: [],
        handoff_agent_ids: [],
        metadata: {enabled: false},
      },
      suggested_tool_ids: [
        {
          tool_id: 'tool-search',
          exists: true,
          requires_review: true,
          high_risk: false,
          reason: 'Existing Open Agency tool. Explicit approval is required before assignment.',
        },
      ],
      suggested_handoff_agent_ids: [
        {
          agent_id: 'Research Agent',
          exists: true,
          matched_agent_id: 'agent-other-1',
          requires_review: true,
          reason:
            'Matching Open Agency agent exists. Explicit approval is required before handoff assignment.',
        },
      ],
      warnings: [],
      conflicts: [],
      requires_review: true,
    });
    agentsApi.commitAgentImport.mockResolvedValue({
      status: 'created',
      agent: {
        id: 'frontend-developer',
        name: 'Frontend Developer',
      },
      warnings: [],
    });
    agentsApi.previewAgentImportFiles.mockResolvedValue({
      proposals: [
        {
          source: {
            source_type: 'upload',
            filename: 'frontend.md',
            sha256: 'sha-front',
          },
          detected_format: 'agency_agents_markdown',
          agent: {
            id: 'frontend-developer',
            name: 'Frontend Developer',
            description: 'Builds interfaces.',
            instructions: '# Frontend Developer',
            tool_ids: [],
            handoff_agent_ids: [],
            metadata: {enabled: false},
          },
          suggested_tool_ids: [],
          suggested_handoff_agent_ids: [],
          warnings: [],
          conflicts: [],
          requires_review: true,
        },
        {
          source: {
            source_type: 'upload',
            filename: 'backend.md',
            sha256: 'sha-back',
          },
          detected_format: 'generic_markdown',
          agent: {
            id: 'backend-architect',
            name: 'Backend Architect',
            description: 'Designs APIs.',
            instructions: '# Backend Architect',
            tool_ids: [],
            handoff_agent_ids: [],
            metadata: {enabled: false},
          },
          suggested_tool_ids: [],
          suggested_handoff_agent_ids: [],
          warnings: [],
          conflicts: [],
          requires_review: true,
        },
      ],
      errors: [],
    });
    agentsApi.commitAgentImportBatch.mockResolvedValue({
      results: [
        {
          status: 'created',
          agent: {id: 'frontend-developer', name: 'Frontend Developer'},
          warnings: [],
        },
        {
          status: 'created',
          agent: {id: 'backend-architect', name: 'Backend Architect'},
          warnings: [],
        },
      ],
      errors: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('marks the active main agent and saves edits through backend agents api', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Inspect Main'})).toBeInTheDocument();
    });
    expect(screen.getByText('Main orchestrator')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', {name: 'Edit agent'})[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.queryByRole('button', {name: 'Delete agent'})).not.toBeInTheDocument();

    const nameInput = screen.getByLabelText('Name');
    const roleInput = screen.getByLabelText('Role');
    const instructionsInput = screen.getByRole('textbox', {name: 'Instructions'});
    const profileSelect = screen.getByLabelText('Model profile');
    openToolAssignment();
    openToolGroup(/Memory & knowledge/i);
    const searchToolCheckbox = screen.getByRole('checkbox', {name: /Search Tool/i});

    fireEvent.change(nameInput, {target: {value: 'Jarvis'}});
    fireEvent.change(roleInput, {target: {value: 'Main Agent'}});
    fireEvent.change(instructionsInput, {target: {value: 'Be extra helpful.'}});
    fireEvent.change(profileSelect, {target: {value: 'profile-3'}});
    fireEvent.click(searchToolCheckbox);
    fireEvent.click(screen.getByRole('button', {name: 'Save agent'}));

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
        metadata: {},
      });
    });
  });

  it('searches the directory without changing grants and restores the harness when cleared', async () => {
    renderWorkspace();
    await screen.findByRole('button', {name: 'Inspect Main'});
    fireEvent.change(screen.getByRole('searchbox', {name: 'Search agents'}), {
      target: {value: 'research'},
    });
    expect(screen.queryByRole('button', {name: 'Inspect Main'})).not.toBeInTheDocument();
    expect(screen.getByRole('group', {name: 'Research Agent agent'})).toBeInTheDocument();
    expect(agentsApi.updateAgent).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('searchbox', {name: 'Search agents'}), {
      target: {value: ''},
    });
    expect(screen.getByRole('button', {name: 'Inspect Main'})).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByText('All enabled capabilities')).toBeInTheDocument();
    expect(conversationsApi.updateMainAgent).not.toHaveBeenCalled();
  });

  it('pins the active main agent first even when the backend returns it later', async () => {
    agentsApi.listAgentCatalog.mockResolvedValue([
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
      {
        id: 'agent-main-1',
        name: 'Open Agency Assistant',
        description: 'Default assistant',
        config: {
          instructions: 'Be helpful.',
          modelProfileId: 'profile-1',
          toolIds: [],
          handoffAgentIds: [],
        },
      },
    ]);

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Main orchestrator')).toBeInTheDocument();
    });

    const directory = within(screen.getByRole('navigation', {name: 'Agent directory'}));
    const entries = directory.getAllByRole('button');
    expect(entries[0]).toHaveAccessibleName('Inspect Main');
    expect(entries[1]).toHaveAccessibleName('Inspect Research Agent');
    expect(screen.getByRole('group', {name: 'Main agent'})).toBeInTheDocument();
  });

  it('binds a persona to an agent through metadata', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Inspect Research Agent'})).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', {name: 'Inspect Research Agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Edit agent'}));
    fireEvent.change(screen.getByLabelText('Persona'), {target: {value: 'persona-1'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save agent'}));

    await waitFor(() => {
      expect(agentsApi.updateAgent).toHaveBeenCalledWith(
        'agent-other-1',
        expect.objectContaining({
          metadata: {
            persona_id: 'persona-1',
            persona_slug: 'audit-manager',
            persona_name: 'Audit Manager',
            persona_status: 'published',
          },
        })
      );
    });
  });

  it('shows assigned tools on agent cards before editing', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Inspect Research Agent'})).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', {name: 'Inspect Research Agent'}));
    openToolAssignment();
    expect(screen.getByText('Assigned tools')).toBeInTheDocument();
    openToolGroup(/Memory & knowledge/i);
    expect(screen.getByText('Search Tool')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', {name: 'Documents'}), {button: 0, ctrlKey: false});
    expect(screen.getAllByText('Agent documents')).toHaveLength(1);
    await waitFor(() => {
      expect(screen.getAllByText('No documents attached.')).toHaveLength(1);
    });
    expect(screen.queryByText('Select document')).not.toBeInTheDocument();
  });

  it('updates assistant page context when a specific agent card is selected', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Inspect Research Agent'})).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(useRegisterAssistantPageContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selection: {agentId: 'agent-main-1'},
        })
      );
    });

    fireEvent.click(screen.getByRole('button', {name: 'Inspect Research Agent'}));

    await waitFor(() => {
      expect(useRegisterAssistantPageContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          entities: [
            {
              type: 'agent',
              id: 'agent-other-1',
              name: 'Research Agent',
            },
          ],
          selection: {agentId: 'agent-other-1'},
          summary: expect.objectContaining({
            selectedAgentName: 'Research Agent',
            selectedAgentIsMain: false,
          }),
        })
      );
    });
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
      expect(screen.getByRole('button', {name: 'Inspect Legacy Agent'})).toBeInTheDocument();
    });

    expect(within(screen.getByRole('group', {name: 'Legacy Agent agent'})).getByText('Research Profile')).toBeInTheDocument();
    openToolAssignment();
    openToolGroup(/Memory & knowledge/i);
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
      expect(screen.getByRole('button', {name: 'Inspect Main'})).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', {name: 'New agent'}));
    fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'Ops Agent'}});
    fireEvent.change(screen.getByRole('textbox', {name: 'Instructions'}), {
      target: {value: 'Handle operational requests.'},
    });
    fireEvent.change(screen.getByLabelText('Role'), {target: {value: 'Operations'}});
    fireEvent.change(screen.getByLabelText('Model profile'), {target: {value: 'profile-3'}});
    openToolAssignment();
    openToolGroup(/Connections & delivery/i);
    fireEvent.click(screen.getByRole('checkbox', {name: /Email Tool/i}));
    fireEvent.click(screen.getByRole('button', {name: 'Create agent'}));

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

  it('previews and commits a pasted Markdown agent import', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Inspect Main'})).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', {name: 'Import agent'}));
    fireEvent.change(screen.getByLabelText('Markdown'), {
      target: {value: '---\nname: Frontend Developer\n---\n# Frontend Developer'},
    });
    fireEvent.click(screen.getByRole('button', {name: 'Preview import'}));

    await waitFor(() => {
      expect(agentsApi.previewAgentImport).toHaveBeenCalledWith({
        markdownText: '---\nname: Frontend Developer\n---\n# Frontend Developer',
        sourceFilename: undefined,
        sourceUrl: undefined,
      });
    });
    expect(await screen.findByText('agency_agents_markdown')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Import reviewed agent'})).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Model profile'), {target: {value: 'profile-3'}});
    fireEvent.click(screen.getByLabelText(/Enable after import/i));
    fireEvent.click(screen.getByRole('checkbox', {name: /Search Tool/i}));
    fireEvent.click(screen.getByRole('checkbox', {name: /Research Agent/i}));
    fireEvent.click(screen.getByRole('button', {name: 'Commit import'}));

    await waitFor(() => {
      expect(agentsApi.commitAgentImport).toHaveBeenCalledWith({
        proposal: expect.objectContaining({
          detected_format: 'agency_agents_markdown',
          agent: expect.objectContaining({name: 'Frontend Developer'}),
        }),
        conflictStrategy: 'create_only',
        approvedToolIds: ['tool-search'],
        approvedHandoffAgentIds: ['agent-other-1'],
        modelProfileId: 'profile-3',
        enabled: true,
      });
    });
  });

  it('previews multiple Markdown files and commits them as a batch', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Inspect Main'})).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', {name: 'Import agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Upload'}));
    fireEvent.change(screen.getByLabelText('Markdown files'), {
      target: {
        files: [
          new File(['# Frontend Developer'], 'frontend.md', {type: 'text/markdown'}),
          new File(['# Backend Architect'], 'backend.md', {type: 'text/markdown'}),
        ],
      },
    });
    fireEvent.click(screen.getByRole('button', {name: 'Preview import'}));

    await waitFor(() => {
      expect(agentsApi.previewAgentImportFiles).toHaveBeenCalledWith([
        expect.objectContaining({name: 'frontend.md'}),
        expect.objectContaining({name: 'backend.md'}),
      ]);
    });
    expect(await screen.findByText('Batch preview')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Backend Architect'})).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Commit all without tools'}));

    await waitFor(() => {
      expect(agentsApi.commitAgentImportBatch).toHaveBeenCalledWith([
        expect.objectContaining({
          proposal: expect.objectContaining({
            agent: expect.objectContaining({name: 'Frontend Developer'}),
          }),
          conflictStrategy: 'create_only',
          approvedToolIds: [],
          approvedHandoffAgentIds: [],
          modelProfileId: null,
          enabled: false,
        }),
        expect.objectContaining({
          proposal: expect.objectContaining({
            agent: expect.objectContaining({name: 'Backend Architect'}),
          }),
        }),
      ]);
    });
  });

  it('skips risky batch imports until they are reviewed individually', async () => {
    agentsApi.previewAgentImportFiles.mockResolvedValueOnce({
      proposals: [
        {
          source: {
            source_type: 'upload',
            filename: 'frontend.md',
            sha256: 'sha-front',
          },
          detected_format: 'agency_agents_markdown',
          agent: {
            id: 'frontend-developer',
            name: 'Frontend Developer',
            instructions: '# Frontend Developer',
            tool_ids: [],
            handoff_agent_ids: [],
            metadata: {enabled: false},
          },
          suggested_tool_ids: [],
          suggested_handoff_agent_ids: [],
          warnings: [],
          conflicts: [],
          requires_review: true,
        },
        {
          source: {
            source_type: 'upload',
            filename: 'risky.md',
            sha256: 'sha-risky',
          },
          detected_format: 'generic_markdown',
          agent: {
            id: 'risky-import',
            name: 'Risky Import',
            instructions: '# Risky Import',
            tool_ids: [],
            handoff_agent_ids: [],
            metadata: {enabled: false},
          },
          suggested_tool_ids: [],
          suggested_handoff_agent_ids: [],
          warnings: [
            {
              code: 'prompt_injection_detected',
              message: 'Imported Markdown contains suspicious instructions.',
              severity: 'error',
              field: 'instructions',
            },
          ],
          conflicts: [],
          requires_review: true,
        },
      ],
      errors: [],
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Inspect Main'})).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', {name: 'Import agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Upload'}));
    fireEvent.change(screen.getByLabelText('Markdown files'), {
      target: {
        files: [
          new File(['# Frontend Developer'], 'frontend.md', {type: 'text/markdown'}),
          new File(['# Risky Import'], 'risky.md', {type: 'text/markdown'}),
        ],
      },
    });
    fireEvent.click(screen.getByRole('button', {name: 'Preview import'}));

    expect(await screen.findByText('1 import require individual review.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Commit safe imports'}));

    await waitFor(() => {
      expect(agentsApi.commitAgentImportBatch).toHaveBeenCalledWith([
        expect.objectContaining({
          proposal: expect.objectContaining({
            agent: expect.objectContaining({name: 'Frontend Developer'}),
          }),
        }),
      ]);
    });
    expect(
      await screen.findByText('Risky Import requires individual review before commit.')
    ).toBeInTheDocument();
  });

  it('supports all and no tool assignment shortcuts when creating agents', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Inspect Main'})).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', {name: 'New agent'}));
    fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'All Tool Agent'}});
    fireEvent.change(screen.getByRole('textbox', {name: 'Instructions'}), {
      target: {value: 'Use every assigned tool when useful.'},
    });
    openToolAssignment();
    fireEvent.click(screen.getByRole('button', {name: 'Select matching (2)'}));
    fireEvent.click(screen.getByRole('button', {name: 'No tools'}));
    fireEvent.click(screen.getByRole('button', {name: 'Select matching (2)'}));
    fireEvent.click(screen.getByRole('button', {name: 'Create agent'}));

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
          routing: {group: 'browser.read'},
          description: 'Capture the current browser page screenshot.',
        },
        {
          id: 'tool-file',
          name: 'Convert Markdown to Word',
          routing: {group: 'documents.write'},
          description: 'Convert markdown text into a Word document.',
        },
        {
          id: 'tool-command',
          name: 'Run Command',
          routing: {group: 'code.execution'},
          description: 'Run CLI commands in the selected workspace.',
        },
      ],
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Inspect Main'})).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', {name: 'Edit agent'})[0]);

    expect(screen.getByText('Tool assignment')).toBeInTheDocument();
    expect(screen.getByLabelText('Search capabilities')).not.toBeVisible();

    openToolAssignment();
    expect(screen.getByText('Browser & local apps')).toBeInTheDocument();
    expect(screen.getByText('Files & documents')).toBeInTheDocument();
    expect(screen.getByText('System & commands')).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: /Capture Browser Screenshot/i})
    ).not.toBeInTheDocument();

    openToolGroup(/Browser & local apps/i);
    expect(screen.getByRole('checkbox', {name: /Capture Browser Screenshot/i})).toBeVisible();

    fireEvent.click(screen.getAllByRole('button', {name: 'Select group'})[0]);
    fireEvent.click(screen.getByRole('button', {name: 'Save agent'}));

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
      expect(screen.getByRole('button', {name: 'Inspect Research Agent'})).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', {name: 'Inspect Research Agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Edit agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete agent'}));

    await waitFor(() => {
      expect(agentsApi.deleteAgent).toHaveBeenCalledWith('agent-other-1');
    });
  });

  it('keeps agents usable when the optional tool catalog is unavailable', async () => {
    toolsApi.listTools.mockRejectedValueOnce(
      new Error('UndefinedColumnError: column tools.routing_json does not exist')
    );

    renderWorkspace();

    expect(
      await screen.findByRole('button', {name: 'Inspect Research Agent'})
    ).toBeInTheDocument();
    expect(screen.getByText('Tool assignments are temporarily unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/UndefinedColumnError/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry tools'})).toBeInTheDocument();
  });

  it('protects unsaved inline edits before canceling and restores edit focus', async () => {
    renderWorkspace();

    await screen.findByRole('button', {name: 'Inspect Research Agent'});
    fireEvent.click(screen.getByRole('button', {name: 'Inspect Research Agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Edit agent'}));
    fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'Research Lead'}});
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(screen.getByRole('heading', {name: 'Discard unsaved changes?'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Continue editing'}));
    expect(screen.getByLabelText('Name')).toHaveValue('Research Lead');

    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    fireEvent.click(screen.getByRole('button', {name: 'Discard changes'}));
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit agent'})).toHaveFocus();
    expect(agentsApi.updateAgent).not.toHaveBeenCalled();
  });

  it('guards switching agents and keeps the current draft until explicitly discarded', async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', {name: 'Inspect Research Agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Edit agent'}));
    fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'Research Lead'}});
    fireEvent.click(screen.getByRole('button', {name: 'Inspect Main'}));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Continue editing'}));
    expect(screen.getByLabelText('Name')).toHaveValue('Research Lead');
    expect(screen.getByRole('button', {name: 'Inspect Research Agent'})).toHaveAttribute('aria-current', 'true');
    fireEvent.click(screen.getByRole('button', {name: 'Inspect Main'}));
    fireEvent.click(screen.getByRole('button', {name: 'Discard changes'}));
    expect(screen.getByRole('group', {name: 'Main agent'})).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(agentsApi.updateAgent).not.toHaveBeenCalled();
  });

  it('keeps the draft visible when directory search filters out the edited agent', async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', {name: 'Inspect Research Agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Edit agent'}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Instructions'}), {target: {value: 'Draft instructions'}});
    fireEvent.change(screen.getByRole('searchbox', {name: 'Search agents'}), {target: {value: 'Main'}});
    expect(screen.queryByRole('button', {name: 'Inspect Research Agent'})).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Instructions'})).toHaveValue('Draft instructions');
    expect(screen.getByRole('group', {name: 'Research Agent agent'})).toBeInTheDocument();
    expect(agentsApi.updateAgent).not.toHaveBeenCalled();
  });

  it('guards app navigation before an inline draft can be unmounted', async () => {
    renderWorkspace();
    render(<a href="/models">Models route</a>);
    fireEvent.click(await screen.findByRole('button', {name: 'Inspect Research Agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Edit agent'}));
    fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'Research Lead'}});
    fireEvent.click(screen.getByRole('link', {name: 'Models route'}));
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Continue editing'}));
    expect(screen.getByLabelText('Name')).toHaveValue('Research Lead');
    fireEvent.click(screen.getByRole('link', {name: 'Models route'}));
    fireEvent.click(screen.getByRole('button', {name: 'Discard changes'}));
    expect(router.push).toHaveBeenCalledWith('/models');
    expect(agentsApi.updateAgent).not.toHaveBeenCalled();
  });

  it('preserves failed saves in the editor so they can be corrected or retried', async () => {
    agentsApi.updateAgent.mockRejectedValueOnce(new Error('Save unavailable'));
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', {name: 'Inspect Research Agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Edit agent'}));
    fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'Research Lead'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save agent'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save unavailable');
    expect(screen.getByLabelText('Name')).toHaveValue('Research Lead');
    expect(screen.getByRole('button', {name: 'Save agent'})).toBeEnabled();
  });

  it('browses main-agent capabilities without implicitly saving grants', async () => {
    renderWorkspace();
    await screen.findByRole('button', {name: 'Inspect Main'});
    openToolAssignment();
    expect(screen.getByText('2 available')).toBeInTheDocument();
    openToolGroup(/Connections & delivery/i);
    expect(screen.getByText('Email Tool')).toBeVisible();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('All enabled capabilities')).toBeVisible();
    expect(agentsApi.updateAgent).not.toHaveBeenCalled();
    expect(conversationsApi.updateMainAgent).not.toHaveBeenCalled();
  });

  it('filters persona-backed agents, searches models and clears both filters', async () => {
    agentsApi.listAgentCatalog.mockResolvedValue([
      {id: 'agent-main-1', name: 'Assistant', config: {instructions: 'Help.', modelProfileId: 'profile-1', toolIds: [], handoffAgentIds: []}},
      {id: 'agent-persona-1', name: 'Audit Specialist', config: {instructions: 'Review.', modelProfileId: 'profile-3', toolIds: [], handoffAgentIds: [], metadata: {persona_id: 'persona-1', persona_slug: 'audit-manager', generated_from_persona_factory: true}}},
    ]);
    renderWorkspace();
    await screen.findByRole('button', {name: 'Inspect Main'});
    fireEvent.change(screen.getByLabelText('Filter agents by type'), {target: {value: 'personas'}});
    expect(screen.queryByRole('button', {name: 'Inspect Main'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Inspect Audit Specialist'})).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', {name: 'Search agents'}), {target: {value: 'Operations Profile'}});
    expect(screen.getByRole('group', {name: 'Audit Specialist agent'})).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', {name: 'Search agents'}), {target: {value: 'does not exist'}});
    expect(screen.getByRole('heading', {name: 'No matching agents'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Clear search'}));
    expect(screen.getByLabelText('Filter agents by type')).toHaveValue('all');
    expect(screen.getByRole('button', {name: 'Inspect Main'})).toHaveAttribute('aria-current', 'true');
    expect(agentsApi.updateAgent).not.toHaveBeenCalled();
  });

  it('preserves identity, instructions and a chosen document across sections without saving', async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', {name: 'Inspect Research Agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Edit agent'}));
    fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'Research Lead'}});
    fireEvent.change(screen.getByRole('textbox', {name: 'Instructions'}), {target: {value: 'Draft behavior'}});
    fireEvent.mouseDown(screen.getByRole('tab', {name: 'Documents'}), {button: 0, ctrlKey: false});
    const documents = screen.getByRole('tabpanel', {name: 'Documents'});
    fireEvent.change(documents.querySelector('input[type="file"]')!, {target: {files: [new File(['Reference context'], 'agent-notes.md', {type: 'text/markdown'})]}});
    await waitFor(() => expect(documentsApi.analyzeUpload).toHaveBeenCalledTimes(1));
    openToolAssignment();
    fireEvent.mouseDown(screen.getByRole('tab', {name: 'Overview'}), {button: 0, ctrlKey: false});
    expect(screen.getByLabelText('Name')).toHaveValue('Research Lead');
    expect(screen.getByRole('textbox', {name: 'Instructions'})).toHaveValue('Draft behavior');
    fireEvent.mouseDown(screen.getByRole('tab', {name: 'Documents'}), {button: 0, ctrlKey: false});
    expect(screen.getByRole('button', {name: 'Change file'})).toBeVisible();
    expect(within(screen.getByRole('tabpanel', {name: 'Documents'})).getAllByText('agent-notes.md')[0]).toBeVisible();
    expect(documentsApi.analyzeUpload).toHaveBeenCalledTimes(1);
    expect(documentsApi.ingestDocument).not.toHaveBeenCalled();
    expect(agentsApi.updateAgent).not.toHaveBeenCalled();
  });

  it('retains an unavailable model preset in the reusable identity fields', async () => {
    behaviorProfilesApi.listProfiles.mockResolvedValue([]);
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', {name: 'Inspect Research Agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Edit agent'}));
    expect(screen.getByLabelText('Model profile')).toHaveValue('profile-2');
    expect(screen.getByRole('option', {name: 'profile-2 · Unavailable'})).toBeInTheDocument();
    expect(agentsApi.updateAgent).not.toHaveBeenCalled();
  });

  it('blocks competing actions while a save is pending', async () => {
    let finish!: (value: unknown) => void;
    agentsApi.updateAgent.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', {name: 'Inspect Research Agent'}));
    fireEvent.click(screen.getByRole('button', {name: 'Edit agent'}));
    fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'Research Lead'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save agent'}));
    expect(screen.getByRole('button', {name: 'Saving...'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Inspect Main'})).toBeDisabled();
    expect(screen.getByRole('searchbox', {name: 'Search agents'})).toBeDisabled();
    expect(screen.getByLabelText('Filter agents by type')).toBeDisabled();
    expect(screen.getByLabelText('Name')).toBeDisabled();
    finish({id: 'agent-other-1', name: 'Research Lead'});
    await screen.findByRole('button', {name: 'Edit agent'});
    expect(agentsApi.updateAgent).toHaveBeenCalledTimes(1);
  });
});
