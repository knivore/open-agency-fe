import { describe, expect, it } from 'vitest';
import {
  addWorkflowAgentNodeToGraphDocument,
  addWorkflowArtifactNodeToGraphDocument,
  addWorkflowMemoryNodeToGraphDocument,
  addWorkflowTaskNodeToGraphDocument,
  addWorkflowTaskTemplateNodeToGraphDocument,
  addWorkflowToolNodeToGraphDocument,
  applyWorkflowGraphConnection,
  graphDocumentToWorkflowDefinition,
  normalizeWorkflowGraphForPersistence,
  validateWorkflowGraphConversionSafety,
  validateWorkflowGraphDocument,
  validateWorkflowResourceReferences,
  validateWorkflowRuntimeWarnings,
  workflowActivityToGraphRuntimeEvents,
  workflowDefinitionToGraphDocument,
  workflowDraftIssuesToGraphValidationIssues,
  workflowGraphDefinition,
  workflowGraphEdgeTypes,
  workflowGraphNodeTypes,
  workflowMonitoringEventsToGraphRuntimeEvents,
} from '@/lib/workflows/workflowGraphAdapter';
import { layoutGraphDocumentGrid } from '@/modules/react-flow-graph/layout';
import type { JsonObject } from '@/types/api';
import type { WorkflowDefinition } from '@/types/workflows';

const workflow: WorkflowDefinition = {
  id: 'workflow-1',
  name: 'Research Workflow',
  description: 'Find and summarize evidence.',
  agent_definitions: [
    {
      id: 'agent-1',
      name: 'Researcher',
      role: 'Find evidence',
      tool_ids: ['tool-1'],
    },
  ],
  task_definitions: [
    {
      id: 'task-1',
      name: 'Search',
      description: 'Search for evidence.',
      agent_id: 'agent-1',
      depends_on_task_ids: [],
    },
    {
      id: 'task-2',
      name: 'Summarize',
      description: 'Summarize evidence.',
      agent_id: 'agent-1',
      depends_on_task_ids: ['task-1'],
      human_approval_required: true,
    },
  ],
  tool_definitions: [
    {
      id: 'tool-1',
      name: 'Search Tool',
      description: 'Searches documents.',
      tool_type: 'native',
      config: {},
    },
  ],
  nodes: [
    {
      id: 'node-task-1',
      name: 'Search',
      node_type: 'task',
      task_id: 'task-1',
      metadata: {
        position: { x: 120, y: 140 },
      },
    },
  ],
  edges: [
    {
      id: 'edge-node-task-1-node-task-2',
      source_node_id: 'node-task-1',
      target_node_id: 'node-task-2',
      edge_type: 'conditional',
      condition: 'has evidence',
      metadata: { reason: 'only summarize when search succeeds' },
    },
  ],
};

describe('workflow graph adapter', () => {
  it('maps workflow definitions into generic graph documents', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);

    expect(graph.id).toBe('workflow-1');
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: workflowGraphNodeTypes.agent,
          label: 'Researcher',
        }),
        expect.objectContaining({
          type: workflowGraphNodeTypes.task,
          label: 'Search',
          position: { x: 680, y: 140 },
          data: expect.objectContaining({
            downstreamCount: 1,
          }),
        }),
        expect.objectContaining({
          type: workflowGraphNodeTypes.task,
          label: 'Summarize',
          data: expect.objectContaining({
            dependencyCount: 1,
            conditionalDependencyCount: 1,
          }),
        }),
        expect.objectContaining({
          type: workflowGraphNodeTypes.tool,
          label: 'Tools',
          data: expect.objectContaining({
            toolIds: ['tool-1'],
            toolCount: 1,
          }),
        }),
        expect.objectContaining({
          type: workflowGraphNodeTypes.approval,
          label: 'Approval required',
          description: 'Human approval gate for Summarize.',
          data: expect.objectContaining({
            taskId: 'task-2',
            taskName: 'Summarize',
            approvalRequired: true,
          }),
        }),
        expect.objectContaining({
          type: workflowGraphNodeTypes.router,
          label: 'Route: has evidence',
          position: expect.objectContaining({ x: 1020 }),
          data: expect.objectContaining({
            edgeId: 'edge-node-task-1-node-task-2',
            edgeType: 'conditional',
            condition: 'has evidence',
          }),
        }),
      ])
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: workflowGraphEdgeTypes.condition,
          label: 'has evidence',
          source: 'workflow-task-task-1',
          target: 'workflow-router-edge-node-task-1-node-task-2',
        }),
        expect.objectContaining({
          type: workflowGraphEdgeTypes.dependency,
          source: 'workflow-router-edge-node-task-1-node-task-2',
          target: 'workflow-task-task-2',
        }),
        expect.objectContaining({
          type: workflowGraphEdgeTypes.assignment,
        }),
        expect.objectContaining({
          type: workflowGraphEdgeTypes.tool,
        }),
        expect.objectContaining({
          type: workflowGraphEdgeTypes.approval,
          label: 'Requires approval',
          source: 'workflow-task-task-2',
          target: 'workflow-approval-task-2',
          data: expect.objectContaining({
            taskId: 'task-2',
            taskName: 'Summarize',
            edgeType: 'approval',
          }),
          metadata: expect.objectContaining({
            derived: true,
          }),
        }),
      ])
    );
    expect(graph.edges.every((edge) => !edge.style?.className?.includes('edge-flow'))).toBe(true);
    expect(graph.edges.every((edge) => edge.style?.custom?.animated !== true)).toBe(true);
    expect(workflowGraphDefinition.validate(graph)).toEqual([]);
  });

  it('round-trips agent guardrails through graph agent nodes', () => {
    const workflowWithGuardrails: WorkflowDefinition = {
      ...workflow,
      agent_definitions: [
        {
          ...workflow.agent_definitions![0],
          guardrails: [
            {
              id: 'guardrail-1',
              name: 'Require approval',
              description: 'Escalate risky tool use.',
              mode: 'tool',
              config: { severity: 'high' },
            },
          ],
        },
      ],
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithGuardrails);
    const agentNode = graph.nodes.find((node) => node.data?.agentId === 'agent-1');

    expect(agentNode?.data?.guardrails).toEqual([
      {
        id: 'guardrail-1',
        name: 'Require approval',
        description: 'Escalate risky tool use.',
        mode: 'tool',
        config: { severity: 'high' },
      },
    ]);

    const nextWorkflow = graphDocumentToWorkflowDefinition(graph, workflowWithGuardrails);

    expect(nextWorkflow.agent_definitions?.[0]?.guardrails).toEqual([
      {
        id: 'guardrail-1',
        name: 'Require approval',
        description: 'Escalate risky tool use.',
        mode: 'tool',
        config: { severity: 'high' },
      },
    ]);
  });

  it('does not render self-loop task dependencies or router nodes', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      task_definitions: [
        {
          id: 'task-1',
          name: 'Single task',
          description: 'Only one task.',
          agent_id: 'agent-1',
          depends_on_task_ids: ['task-1'],
        },
      ],
      nodes: [
        {
          id: 'node-task-1',
          name: 'Single task',
          node_type: 'task',
          task_id: 'task-1',
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'edge-node-task-1-node-task-1',
          source_node_id: 'node-task-1',
          target_node_id: 'node-task-1',
          edge_type: 'conditional',
          condition: 'self',
          metadata: {},
        },
      ],
    });

    expect(
      graph.edges.filter(
        (edge) => edge.source === 'workflow-task-task-1' && edge.target === 'workflow-task-task-1'
      )
    ).toEqual([]);
    expect(graph.nodes.some((node) => node.type === workflowGraphNodeTypes.router)).toBe(false);
    expect(validateWorkflowGraphDocument(graph)).toEqual([]);
  });

  it('maps connected router nodes back into conditional workflow dependencies', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const nextWorkflow = graphDocumentToWorkflowDefinition(graph, workflow);

    expect(nextWorkflow.task_definitions?.find((task) => task.id === 'task-2')).toEqual(
      expect.objectContaining({
        depends_on_task_ids: ['task-1'],
      })
    );
    expect(nextWorkflow.edges).toEqual([
      expect.objectContaining({
        source_node_id: 'node-task-1',
        target_node_id: 'node-task-2',
        edge_type: 'conditional',
        condition: 'has evidence',
        metadata: { reason: 'only summarize when search succeeds' },
      }),
    ]);
  });

  it('repairs router edges when conditional metadata is missing the matching task dependency', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      task_definitions: workflow.task_definitions?.map((task) =>
        task.id === 'task-2'
          ? {
              ...task,
              depends_on_task_ids: [],
            }
          : task
      ),
    });

    expect(validateWorkflowGraphConversionSafety(graph)).toEqual([]);

    const nextWorkflow = graphDocumentToWorkflowDefinition(graph, {
      ...workflow,
      task_definitions: workflow.task_definitions?.map((task) =>
        task.id === 'task-2'
          ? {
              ...task,
              depends_on_task_ids: [],
            }
          : task
      ),
    });

    expect(nextWorkflow.task_definitions?.find((task) => task.id === 'task-2')).toEqual(
      expect.objectContaining({
        depends_on_task_ids: ['task-1'],
      })
    );
  });

  it('connects router nodes when workflow edges reference persisted workflow node ids', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      nodes: [
        {
          id: 'persisted-context-node',
          name: 'Search',
          node_type: 'task',
          task_id: 'task-1',
        },
        {
          id: 'persisted-summary-node',
          name: 'Summarize',
          node_type: 'task',
          task_id: 'task-2',
        },
      ],
      edges: [
        {
          id: 'persisted-route-edge',
          source_node_id: 'persisted-context-node',
          target_node_id: 'persisted-summary-node',
          edge_type: 'conditional',
          condition: 'ready',
          metadata: { source: 'backend' },
        },
      ],
    });
    const routerNode = graph.nodes.find((node) => node.type === workflowGraphNodeTypes.router);

    expect(validateWorkflowGraphConversionSafety(graph)).toEqual([]);
    expect(routerNode).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceTaskId: 'task-1',
          targetTaskId: 'task-2',
        }),
      })
    );
    expect(
      graph.edges.filter((edge) => edge.target === routerNode?.id).map((edge) => edge.source)
    ).toEqual(['workflow-task-task-1']);
    expect(
      graph.edges.filter((edge) => edge.source === routerNode?.id).map((edge) => edge.target)
    ).toEqual(['workflow-task-task-2']);
  });

  it('normalizes malformed router fan-out back to the router metadata route pair', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      task_definitions: [
        ...(workflow.task_definitions ?? []),
        {
          id: 'task-3',
          name: 'Archive',
          description: 'Archive evidence.',
          agent_id: 'agent-1',
          depends_on_task_ids: [],
        },
      ],
    });
    const routerNode = graph.nodes.find((node) => node.type === workflowGraphNodeTypes.router);
    const archiveNode = graph.nodes.find((node) => node.data?.taskId === 'task-3');

    const malformedGraph =
      routerNode && archiveNode
        ? {
            ...graph,
            edges: [
              ...graph.edges,
              {
                id: 'extra-router-out',
                source: routerNode.id,
                target: archiveNode.id,
                type: workflowGraphEdgeTypes.dependency,
              },
            ],
          }
        : graph;
    const normalizedGraph = normalizeWorkflowGraphForPersistence(malformedGraph);

    expect(validateWorkflowGraphConversionSafety(normalizedGraph)).toEqual([]);
    expect(
      normalizedGraph.edges
        .filter((edge) => edge.source === routerNode?.id)
        .map((edge) => edge.target)
    ).toEqual(['workflow-task-task-2']);
  });

  it('flags graph nodes that would be dropped by graph-to-workflow conversion', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const approvalNode = graph.nodes.find((node) => node.type === workflowGraphNodeTypes.approval);

    const issues = validateWorkflowGraphConversionSafety({
      ...graph,
      nodes: approvalNode ? [approvalNode] : [],
      edges: [],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          code: 'workflow.conversionApprovalMissingTask',
          target: 'node',
          targetId: approvalNode?.id,
        }),
      ])
    );
  });

  it('flags incomplete router nodes that would lose route data on save', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const routerNode = graph.nodes.find((node) => node.type === workflowGraphNodeTypes.router);

    const issues = validateWorkflowGraphConversionSafety({
      ...graph,
      edges: graph.edges.filter((edge) => edge.source !== routerNode?.id),
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          code: 'workflow.conversionRouterIncomplete',
          target: 'node',
          targetId: routerNode?.id,
        }),
      ])
    );
  });

  it('can render assigned catalog tools passed in through adapter options', () => {
    const graph = workflowDefinitionToGraphDocument(
      {
        ...workflow,
        tool_definitions: [],
        agent_definitions: workflow.agent_definitions?.map((agent) => ({
          ...agent,
          tool_ids: ['catalog-tool-1'],
        })),
      },
      {
        toolDefinitions: [
          {
            id: 'catalog-tool-1',
            name: 'catalog.search',
            display_name: 'Catalog Search',
            description: 'Searches the shared catalog.',
          },
        ],
      }
    );

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workflow-tool-tools-agent-1',
          type: workflowGraphNodeTypes.tool,
          label: 'Tools',
          data: expect.objectContaining({
            toolIds: ['catalog-tool-1'],
            toolCount: 1,
          }),
        }),
      ])
    );
    expect(
      graph.edges.some(
        (edge) =>
          edge.source === 'workflow-task-task-1' &&
          edge.target === 'workflow-task-task-2' &&
          edge.type === workflowGraphEdgeTypes.condition
      )
    ).toBe(false);
    expect(validateWorkflowGraphDocument(graph)).toEqual([]);
  });

  it('adds empty tool group nodes and persists their selected tool lists', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      agent_definitions: [],
      task_definitions: [],
      tool_definitions: [],
      nodes: [],
      edges: [],
      metadata: {},
    });
    const graphWithToolNode = addWorkflowToolNodeToGraphDocument(graph);
    const toolNode = graphWithToolNode.nodes.find(
      (node) => node.type === workflowGraphNodeTypes.tool
    );
    const editedGraph = {
      ...graphWithToolNode,
      nodes: graphWithToolNode.nodes.map((node) =>
        node.id === toolNode?.id
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                toolIds: ['catalog-tool-1'],
                toolNames: ['Catalog Search'],
                toolCount: 1,
              },
            }
          : node
      ),
    };

    const nextWorkflow = graphDocumentToWorkflowDefinition(editedGraph, {
      ...workflow,
      agent_definitions: [],
      task_definitions: [],
      tool_definitions: [],
      nodes: [],
      edges: [],
      metadata: {},
    });
    const reloadedGraph = workflowDefinitionToGraphDocument(nextWorkflow, {
      toolDefinitions: [
        {
          id: 'catalog-tool-1',
          name: 'catalog.search',
          display_name: 'Catalog Search',
          description: 'Searches catalog.',
          tool_type: 'mcp',
          tags: ['connector'],
          security: {
            requires_approval: true,
            requires_credentials: true,
            health_status: 'degraded',
            auth_status: 'missing',
            allow_network: true,
            allow_filesystem: true,
            sandbox_required: true,
          },
          implementation: {
            config: {
              provider: 'catalog',
            },
          },
        },
      ],
    });

    expect(toolNode).toEqual(
      expect.objectContaining({
        label: 'Tools',
        data: expect.objectContaining({ toolIds: [], toolCount: 0 }),
      })
    );
    expect(nextWorkflow.metadata?.workflow_graph_tool_nodes).toEqual([
      expect.objectContaining({
        toolIds: ['catalog-tool-1'],
      }),
    ]);
    expect(reloadedGraph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: toolNode?.id,
          description: 'Catalog Search',
          data: expect.objectContaining({
            toolIds: ['catalog-tool-1'],
            toolNames: ['Catalog Search'],
            toolCount: 1,
            toolCues: expect.arrayContaining([
              'MCP tool',
              'Provider: catalog',
              'Health: degraded',
              'Credential needed',
              'Auth: missing',
              'Approval required',
              'Permissions: filesystem, network, sandboxed',
            ]),
          }),
        }),
      ])
    );
  });

  it('persists deletion of the last unlinked tool node through metadata merge saves', () => {
    const workflowWithUnlinkedTool: WorkflowDefinition = {
      ...workflow,
      agent_definitions: [],
      task_definitions: [],
      nodes: [],
      edges: [],
      metadata: {
        workflow_graph_tool_nodes: [{ id: 'tools', toolIds: ['tool-1'], agentId: null }],
      },
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithUnlinkedTool);
    const graphWithoutToolNode = {
      ...graph,
      nodes: graph.nodes.filter((node) => node.type !== workflowGraphNodeTypes.tool),
      edges: graph.edges.filter((edge) => edge.type !== workflowGraphEdgeTypes.tool),
    };

    const nextWorkflow = graphDocumentToWorkflowDefinition(
      graphWithoutToolNode,
      workflowWithUnlinkedTool
    );
    const reloadedGraph = workflowDefinitionToGraphDocument(
      {
        ...nextWorkflow,
        metadata: {
          ...(workflowWithUnlinkedTool.metadata ?? {}),
          ...(nextWorkflow.metadata ?? {}),
        },
      },
      { toolDefinitions: workflowWithUnlinkedTool.tool_definitions }
    );

    expect(nextWorkflow.tool_definitions).toEqual([]);
    expect(nextWorkflow.metadata?.workflow_graph_tool_nodes).toEqual([]);
    expect(reloadedGraph.nodes.some((node) => node.type === workflowGraphNodeTypes.tool)).toBe(
      false
    );
  });

  it('keeps selected tool names when another empty tool group node is added', () => {
    const graph = workflowDefinitionToGraphDocument(
      {
        ...workflow,
        agent_definitions: [
          {
            id: 'agent-1',
            name: 'Researcher',
            role: 'Find evidence',
            tool_ids: ['catalog-tool-1'],
          },
        ],
        task_definitions: [],
        tool_definitions: [],
        nodes: [],
        edges: [],
        metadata: {
          workflow_graph_tool_nodes: [
            { id: 'tools-first', toolIds: ['catalog-tool-1'], agentId: 'agent-1' },
          ],
        },
      },
      {
        toolDefinitions: [
          {
            id: 'catalog-tool-1',
            name: 'catalog.search',
            display_name: 'Catalog Search',
            description: 'Searches catalog.',
          },
        ],
      }
    );
    const graphWithSecondToolNode = addWorkflowToolNodeToGraphDocument(graph);
    const nextWorkflow = graphDocumentToWorkflowDefinition(graphWithSecondToolNode, workflow);
    const reloadedGraph = workflowDefinitionToGraphDocument(nextWorkflow, {
      toolDefinitions: [
        {
          id: 'catalog-tool-1',
          name: 'catalog.search',
          display_name: 'Catalog Search',
          description: 'Searches catalog.',
        },
      ],
    });

    expect(nextWorkflow.metadata?.workflow_graph_tool_nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'tools-first',
          toolIds: ['catalog-tool-1'],
          agentId: 'agent-1',
        }),
        expect.objectContaining({
          toolIds: [],
          agentId: null,
        }),
      ])
    );
    expect(reloadedGraph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workflow-tool-tools-first',
          description: 'Catalog Search',
          data: expect.objectContaining({
            toolIds: ['catalog-tool-1'],
            toolNames: ['Catalog Search'],
            toolCount: 1,
          }),
        }),
      ])
    );
  });

  it('uses catalog tool names over stale workflow tool names on tool group nodes', () => {
    const graph = workflowDefinitionToGraphDocument(
      {
        ...workflow,
        agent_definitions: [
          {
            id: 'agent-1',
            name: 'Researcher',
            role: 'Find evidence',
            tool_ids: ['catalog-tool-1'],
          },
        ],
        task_definitions: [],
        tool_definitions: [
          {
            id: 'catalog-tool-1',
            name: 'Tools',
            display_name: 'Tools',
            description: '',
            tool_type: 'workflow',
          },
        ],
        nodes: [],
        edges: [],
        metadata: {
          workflow_graph_tool_nodes: [
            { id: 'tools-first', toolIds: ['catalog-tool-1'], agentId: 'agent-1' },
          ],
        },
      },
      {
        toolDefinitions: [
          {
            id: 'catalog-tool-1',
            name: 'run.command',
            display_name: 'Run Command',
            description: 'Runs a command.',
          },
        ],
      }
    );

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workflow-tool-tools-first',
          description: 'Run Command',
          data: expect.objectContaining({
            toolIds: ['catalog-tool-1'],
            toolNames: ['Run Command'],
            toolCount: 1,
          }),
        }),
      ])
    );
  });

  it('does not rename workflow-owned tools to the tool group node label', () => {
    const graph = workflowDefinitionToGraphDocument(
      {
        ...workflow,
        agent_definitions: [
          {
            id: 'agent-1',
            name: 'Researcher',
            role: 'Find evidence',
            tool_ids: ['catalog-tool-1'],
          },
        ],
        task_definitions: [],
        tool_definitions: [
          {
            id: 'catalog-tool-1',
            name: 'run.command',
            display_name: 'Run Command',
            description: 'Runs a command.',
            tool_type: 'workflow',
          },
        ],
        nodes: [],
        edges: [],
        metadata: {
          workflow_graph_tool_nodes: [
            { id: 'tools-first', toolIds: ['catalog-tool-1'], agentId: 'agent-1' },
          ],
        },
      },
      {
        toolDefinitions: [
          {
            id: 'catalog-tool-1',
            name: 'run.command',
            display_name: 'Run Command',
            description: 'Runs a command.',
          },
        ],
      }
    );
    const nextWorkflow = graphDocumentToWorkflowDefinition(graph, {
      ...workflow,
      tool_definitions: [
        {
          id: 'catalog-tool-1',
          name: 'run.command',
          display_name: 'Run Command',
          description: 'Runs a command.',
          tool_type: 'workflow',
        },
      ],
    });

    expect(nextWorkflow.tool_definitions).toEqual([
      expect.objectContaining({
        id: 'catalog-tool-1',
        name: 'run.command',
        display_name: 'Run Command',
      }),
    ]);
  });

  it('marks shell command tools as explicitly allowed for backend validation', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      agent_definitions: [
        {
          id: 'agent-1',
          name: 'Researcher',
          role: 'Find evidence',
          tool_ids: ['agency.command.run'],
        },
      ],
      task_definitions: [],
      tool_definitions: [
        {
          id: 'agency.command.run',
          name: 'run_command',
          display_name: 'Run Command',
          description: 'Run one approved shell command.',
          tool_type: 'shell_command',
          security: {},
        },
      ],
      metadata: {
        workflow_graph_tool_nodes: [
          { id: 'tools-shell', toolIds: ['agency.command.run'], agentId: 'agent-1' },
        ],
      },
    });

    const nextWorkflow = graphDocumentToWorkflowDefinition(graph, {
      ...workflow,
      tool_definitions: [
        {
          id: 'agency.command.run',
          name: 'run_command',
          display_name: 'Run Command',
          description: 'Run one approved shell command.',
          tool_type: 'shell_command',
          security: {},
        },
      ],
    });

    expect(nextWorkflow.tool_definitions).toEqual([
      expect.objectContaining({
        id: 'agency.command.run',
        tool_type: 'shell_command',
        security: expect.objectContaining({
          allow_shell: true,
          sandbox_required: true,
          requires_approval: true,
        }),
      }),
    ]);
  });

  it('persists selected tool names with tool group records', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      agent_definitions: [
        {
          id: 'agent-1',
          name: 'Researcher',
          role: 'Find evidence',
          tool_ids: ['catalog-tool-1'],
        },
      ],
      task_definitions: [],
      tool_definitions: [
        {
          id: 'catalog-tool-1',
          name: 'Tools',
          display_name: 'Tools',
          description: '',
          tool_type: 'workflow',
        },
      ],
      nodes: [],
      edges: [],
      metadata: {
        workflow_graph_tool_nodes: [
          { id: 'tools-first', toolIds: ['catalog-tool-1'], agentId: 'agent-1' },
        ],
      },
    });
    const editedGraph = {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === 'workflow-tool-tools-first'
          ? {
              ...node,
              description: 'Run Command',
              data: {
                ...(node.data ?? {}),
                toolIds: ['catalog-tool-1'],
                toolNames: ['Run Command'],
                toolCount: 1,
              },
            }
          : node
      ),
    };
    const nextWorkflow = graphDocumentToWorkflowDefinition(editedGraph, {
      ...workflow,
      agent_definitions: [
        {
          id: 'agent-1',
          name: 'Researcher',
          role: 'Find evidence',
          tool_ids: ['catalog-tool-1'],
        },
      ],
      task_definitions: [],
      tool_definitions: [
        {
          id: 'catalog-tool-1',
          name: 'Tools',
          display_name: 'Tools',
          description: '',
          tool_type: 'workflow',
        },
      ],
      nodes: [],
      edges: [],
    });
    const reloadedGraph = workflowDefinitionToGraphDocument(nextWorkflow);

    expect(nextWorkflow.metadata?.workflow_graph_tool_nodes).toEqual([
      expect.objectContaining({
        id: 'tools-first',
        toolIds: ['catalog-tool-1'],
        toolNames: ['Run Command'],
      }),
    ]);
    expect(reloadedGraph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workflow-tool-tools-first',
          description: 'Run Command',
          data: expect.objectContaining({
            toolNames: ['Run Command'],
          }),
        }),
      ])
    );
  });

  it('repairs generic stored tool names when catalog names are available', () => {
    const graph = workflowDefinitionToGraphDocument(
      {
        ...workflow,
        agent_definitions: [
          {
            id: 'agent-1',
            name: 'Researcher',
            role: 'Find evidence',
            tool_ids: ['catalog-tool-1'],
          },
        ],
        task_definitions: [],
        tool_definitions: [],
        nodes: [],
        edges: [],
        metadata: {
          workflow_graph_tool_nodes: [
            {
              id: 'tools-first',
              toolIds: ['catalog-tool-1'],
              toolNames: ['Tools'],
              agentId: 'agent-1',
            },
          ],
        },
      },
      {
        toolDefinitions: [
          {
            id: 'catalog-tool-1',
            name: 'run.command',
            display_name: 'Run Command',
            description: 'Runs a command.',
          },
        ],
      }
    );

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workflow-tool-tools-first',
          description: 'Run Command',
          data: expect.objectContaining({
            toolNames: ['Run Command'],
          }),
        }),
      ])
    );
  });

  it('allows empty tool group nodes to stay linked to one agent', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      agent_definitions: [
        {
          id: 'agent-1',
          name: 'Researcher',
          role: 'Find evidence',
          tool_ids: [],
        },
      ],
      task_definitions: [],
      tool_definitions: [],
      nodes: [],
      edges: [],
      metadata: {},
    });
    const graphWithToolNode = addWorkflowToolNodeToGraphDocument(graph);
    const toolNode = graphWithToolNode.nodes.find(
      (node) => node.type === workflowGraphNodeTypes.tool
    );
    const agentNode = graphWithToolNode.nodes.find(
      (node) => node.type === workflowGraphNodeTypes.agent
    );
    const connected = applyWorkflowGraphConnection(graphWithToolNode, {
      id: 'empty-tool-access',
      source: toolNode?.id ?? '',
      target: agentNode?.id ?? '',
      type: 'default',
    });
    const nextWorkflow = graphDocumentToWorkflowDefinition(connected.document, {
      ...workflow,
      agent_definitions: [
        {
          id: 'agent-1',
          name: 'Researcher',
          role: 'Find evidence',
          tool_ids: [],
        },
      ],
      task_definitions: [],
      tool_definitions: [],
      nodes: [],
      edges: [],
      metadata: {},
    });
    const reloadedGraph = workflowDefinitionToGraphDocument(nextWorkflow);

    expect(connected.issues).toEqual([]);
    expect(connected.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: toolNode?.id,
          target: agentNode?.id,
          type: workflowGraphEdgeTypes.tool,
          data: expect.objectContaining({ toolIds: [], toolCount: 0, agentId: 'agent-1' }),
        }),
      ])
    );
    expect(nextWorkflow.agent_definitions?.[0]?.tool_ids).toEqual([]);
    expect(nextWorkflow.metadata?.workflow_graph_tool_nodes).toEqual([
      expect.objectContaining({
        toolIds: [],
        agentId: 'agent-1',
      }),
    ]);
    expect(reloadedGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: toolNode?.id,
          target: agentNode?.id,
          type: workflowGraphEdgeTypes.tool,
          data: expect.objectContaining({ toolIds: [], toolCount: 0, agentId: 'agent-1' }),
        }),
      ])
    );
  });

  it('keeps separate tool group node names when more tool nodes are added', () => {
    const graph = workflowDefinitionToGraphDocument(
      {
        ...workflow,
        agent_definitions: [
          {
            id: 'agent-1',
            name: 'Agent One',
            description: 'First agent',
            instructions: 'Do work',
            tool_ids: [],
          },
          {
            id: 'agent-2',
            name: 'Agent Two',
            description: 'Second agent',
            instructions: 'Do other work',
            tool_ids: [],
          },
        ],
        tool_definitions: [],
        metadata: {
          workflow_graph_tool_nodes: [
            { id: 'tools-first', toolIds: ['catalog-tool-1'], agentId: 'agent-1' },
            { id: 'tools-second', toolIds: ['catalog-tool-2'], agentId: 'agent-2' },
          ],
        },
      },
      {
        toolDefinitions: [
          {
            id: 'catalog-tool-1',
            name: 'catalog.search',
            display_name: 'Catalog Search',
            description: 'Searches catalog.',
          },
          {
            id: 'catalog-tool-2',
            name: 'run.command',
            display_name: 'Run Command',
            description: 'Runs a command.',
          },
        ],
      }
    );

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workflow-tool-tools-first',
          description: 'Catalog Search',
          data: expect.objectContaining({
            toolIds: ['catalog-tool-1'],
            toolNames: ['Catalog Search'],
            toolCount: 1,
          }),
        }),
        expect.objectContaining({
          id: 'workflow-tool-tools-second',
          description: 'Run Command',
          data: expect.objectContaining({
            toolIds: ['catalog-tool-2'],
            toolNames: ['Run Command'],
            toolCount: 1,
          }),
        }),
      ])
    );
  });

  it('replaces a tool node agent link when connecting it to another agent', () => {
    const graph = workflowDefinitionToGraphDocument(
      {
        ...workflow,
        agent_definitions: [
          {
            id: 'agent-1',
            name: 'Agent One',
            description: 'First agent',
            instructions: 'Do work',
            tool_ids: [],
          },
          {
            id: 'agent-2',
            name: 'Agent Two',
            description: 'Second agent',
            instructions: 'Do other work',
            tool_ids: [],
          },
        ],
        tool_definitions: [],
        metadata: {
          workflow_graph_tool_nodes: [
            { id: 'tools-first', toolIds: ['catalog-tool-1'], agentId: 'agent-1' },
          ],
        },
      },
      {
        toolDefinitions: [
          {
            id: 'catalog-tool-1',
            name: 'catalog.search',
            display_name: 'Catalog Search',
            description: 'Searches catalog.',
          },
        ],
      }
    );
    const toolNode = graph.nodes.find((node) => node.id === 'workflow-tool-tools-first');
    const agentTwo = graph.nodes.find((node) => node.data?.agentId === 'agent-2');
    const reconnected = applyWorkflowGraphConnection(graph, {
      id: 'reconnect-tool-agent',
      source: toolNode?.id ?? '',
      target: agentTwo?.id ?? '',
      type: 'default',
    });
    const nextWorkflow = graphDocumentToWorkflowDefinition(reconnected.document, workflow);

    expect(reconnected.issues).toEqual([]);
    expect(
      reconnected.document.edges.filter(
        (edge) => edge.type === workflowGraphEdgeTypes.tool && edge.source === toolNode?.id
      )
    ).toEqual([
      expect.objectContaining({
        source: toolNode?.id,
        target: agentTwo?.id,
      }),
    ]);
    expect(
      nextWorkflow.agent_definitions?.find((agent) => agent.id === 'agent-1')?.tool_ids
    ).toEqual([]);
    expect(
      nextWorkflow.agent_definitions?.find((agent) => agent.id === 'agent-2')?.tool_ids
    ).toEqual(['catalog-tool-1']);
    expect(nextWorkflow.metadata?.workflow_graph_tool_nodes).toEqual([
      expect.objectContaining({
        id: 'tools-first',
        toolIds: ['catalog-tool-1'],
        agentId: 'agent-2',
      }),
    ]);
  });

  it('uses updated tool node selections over stale tool edge data', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      agent_definitions: [
        {
          id: 'agent-1',
          name: 'Agent One',
          description: 'First agent',
          instructions: 'Do work',
          tool_ids: [],
        },
      ],
      tool_definitions: [],
      metadata: {
        workflow_graph_tool_nodes: [{ id: 'tools-first', toolIds: [], agentId: 'agent-1' }],
      },
    });
    const editedGraph = {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === 'workflow-tool-tools-first'
          ? {
              ...node,
              description: 'Catalog Search',
              data: {
                ...(node.data ?? {}),
                toolIds: ['catalog-tool-1'],
                toolNames: ['Catalog Search'],
                toolCount: 1,
              },
            }
          : node
      ),
    };
    const nextWorkflow = graphDocumentToWorkflowDefinition(editedGraph, workflow);
    const reloadedGraph = workflowDefinitionToGraphDocument(nextWorkflow, {
      toolDefinitions: [
        {
          id: 'catalog-tool-1',
          name: 'catalog.search',
          display_name: 'Catalog Search',
          description: 'Searches catalog.',
        },
      ],
    });

    expect(
      nextWorkflow.agent_definitions?.find((agent) => agent.id === 'agent-1')?.tool_ids
    ).toEqual(['catalog-tool-1']);
    expect(nextWorkflow.metadata?.workflow_graph_tool_nodes).toEqual([
      expect.objectContaining({
        id: 'tools-first',
        toolIds: ['catalog-tool-1'],
        agentId: 'agent-1',
      }),
    ]);
    expect(reloadedGraph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workflow-tool-tools-first',
          description: 'Catalog Search',
          data: expect.objectContaining({
            toolIds: ['catalog-tool-1'],
            toolNames: ['Catalog Search'],
          }),
        }),
      ])
    );
  });

  it('uses current task tool assignments over stale persisted graph tool metadata', () => {
    const graph = workflowDefinitionToGraphDocument(
      {
        ...workflow,
        agent_definitions: [
          {
            id: 'agent-1',
            name: 'Agent One',
            description: 'First agent',
            instructions: 'Do work',
            tool_ids: [],
          },
        ],
        task_definitions: [
          {
            id: 'task-1',
            name: 'Fetch news',
            description: 'Fetch current news.',
            agent_id: 'agent-1',
            depends_on_task_ids: [],
            tool_ids: ['agency.http.request'],
          },
        ],
        tool_definitions: [],
        metadata: {
          workflow_graph_tool_nodes: [
            {
              id: 'tools-agent-1',
              toolIds: ['agency.file.write-text', 'agency.browser.type-text'],
              agentId: 'agent-1',
              position: { x: -560, y: 80 },
            },
          ],
        },
      },
      {
        toolDefinitions: [
          {
            id: 'agency.http.request',
            name: 'send_http_request',
            display_name: 'Send HTTP Request',
            description: 'Send an HTTP request.',
          },
          {
            id: 'agency.file.write-text',
            name: 'write_text_file',
            description: 'Write a file.',
          },
          {
            id: 'agency.browser.type-text',
            name: 'type_text',
            description: 'Type text.',
          },
        ],
      }
    );

    const toolNode = graph.nodes.find((node) => node.id === 'workflow-tool-tools-agent-1');
    const toolEdge = graph.edges.find((edge) => edge.type === workflowGraphEdgeTypes.tool);

    expect(toolNode).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          toolIds: ['agency.http.request'],
          toolCount: 1,
        }),
      })
    );
    expect(toolEdge).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          toolIds: ['agency.http.request'],
          toolId: 'agency.http.request',
        }),
      })
    );
  });

  it('maps graph task dependencies and assignments back into workflow definitions', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const taskOne = graph.nodes.find((node) => node.data?.taskId === 'task-1');
    const taskTwo = graph.nodes.find((node) => node.data?.taskId === 'task-2');
    const agent = graph.nodes.find((node) => node.data?.agentId === 'agent-1');
    const tool = graph.nodes.find(
      (node) =>
        node.type === workflowGraphNodeTypes.tool &&
        Array.isArray(node.data?.toolIds) &&
        node.data.toolIds.includes('tool-1')
    );

    const editedGraph = {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === taskTwo?.id
          ? {
              ...node,
              label: 'Write summary',
              description: 'Write the final answer.',
              data: {
                ...(node.data ?? {}),
                instructions: 'Use the strongest evidence.',
                expectedOutput: 'A concise summary.',
                toolIds: ['tool-2'],
                humanApprovalRequired: false,
              },
            }
          : node.id === agent?.id
            ? {
                ...node,
                description: 'Owns research synthesis.',
                data: {
                  ...(node.data ?? {}),
                  instructions: 'Use source-grounded synthesis instructions.',
                  role: 'Synthesize research',
                  modelProfileId: 'profile-1',
                  toolIds: ['tool-1', 'tool-2'],
                },
              }
            : node
      ),
      edges: [
        ...(agent && taskTwo
          ? [
              {
                id: 'assignment-agent-1-task-2',
                source: agent.id,
                target: taskTwo.id,
                type: workflowGraphEdgeTypes.assignment,
              },
            ]
          : []),
        ...(taskOne && taskTwo
          ? [
              {
                id: 'dependency-task-1-task-2',
                source: taskOne.id,
                target: taskTwo.id,
                type: workflowGraphEdgeTypes.condition,
                label: 'ready',
                data: { edgeType: 'conditional' },
              },
            ]
          : []),
        ...(tool && agent
          ? [
              {
                id: 'tool-tool-1-agent-1',
                source: tool.id,
                target: agent.id,
                type: workflowGraphEdgeTypes.tool,
              },
            ]
          : []),
      ],
    };

    const nextWorkflow = graphDocumentToWorkflowDefinition(editedGraph, workflow);

    expect(nextWorkflow.task_definitions?.find((task) => task.id === 'task-2')).toMatchObject({
      name: 'Write summary',
      description: 'Write the final answer.',
      instructions: 'Use the strongest evidence.',
      expected_output: 'A concise summary.',
      agent_id: 'agent-1',
      tool_ids: ['tool-2'],
      depends_on_task_ids: ['task-1'],
      human_approval_required: false,
    });
    expect(nextWorkflow.agent_definitions?.find((agent) => agent.id === 'agent-1')).toMatchObject({
      description: 'Owns research synthesis.',
      instructions: 'Use source-grounded synthesis instructions.',
      role: 'Synthesize research',
      model_profile_id: 'profile-1',
      tool_ids: ['tool-1'],
    });
    expect(nextWorkflow.edges).toEqual([
      expect.objectContaining({
        edge_type: 'conditional',
        condition: 'ready',
      }),
    ]);
  });

  it('creates workflow draft definitions from graph-created task and agent nodes', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      agent_definitions: [],
      task_definitions: [],
      nodes: [],
      edges: [],
    });
    const graphWithAgent = addWorkflowAgentNodeToGraphDocument(graph);
    const graphWithTask = addWorkflowTaskNodeToGraphDocument(graphWithAgent);
    const agentNode = graphWithTask.nodes.find(
      (node) => node.type === workflowGraphNodeTypes.agent
    );
    const taskNode = graphWithTask.nodes.find((node) => node.type === workflowGraphNodeTypes.task);

    const nextWorkflow = graphDocumentToWorkflowDefinition(graphWithTask, {
      ...workflow,
      agent_definitions: [],
      task_definitions: [],
      nodes: [],
      edges: [],
    });

    expect(agentNode?.data?.agentId).toEqual(expect.stringMatching(/^agent-/));
    expect(taskNode?.data?.taskId).toEqual(expect.stringMatching(/^task-/));
    expect(nextWorkflow.agent_definitions).toEqual([
      expect.objectContaining({
        id: agentNode?.data?.agentId,
        name: 'Agent 1',
        role: '',
      }),
    ]);
    expect(nextWorkflow.task_definitions).toEqual([
      expect.objectContaining({
        id: taskNode?.data?.taskId,
        name: 'Task 1',
        description: '',
        instructions: '',
        expected_output: '',
        agent_id: null,
        depends_on_task_ids: [],
      }),
    ]);
    expect(nextWorkflow.nodes).toEqual([
      expect.objectContaining({
        task_id: taskNode?.data?.taskId,
        metadata: expect.objectContaining({
          position: expect.objectContaining({ x: 680 }),
        }),
      }),
    ]);
  });

  it('creates graph task nodes from common agentic templates', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      task_definitions: [],
      nodes: [],
      edges: [],
    });
    const graphWithTemplateTask = addWorkflowTaskTemplateNodeToGraphDocument(graph, 'research');
    const taskNode = graphWithTemplateTask.nodes.find(
      (node) => node.type === workflowGraphNodeTypes.task
    );

    const nextWorkflow = graphDocumentToWorkflowDefinition(graphWithTemplateTask, {
      ...workflow,
      task_definitions: [],
      nodes: [],
      edges: [],
    });

    expect(taskNode).toEqual(
      expect.objectContaining({
        label: 'Research task 1',
        description: expect.stringContaining('Gather facts'),
        data: expect.objectContaining({
          taskTemplateId: 'research',
          taskTemplateLabel: 'Research',
        }),
      })
    );
    expect(nextWorkflow.task_definitions?.[0]).toEqual(
      expect.objectContaining({
        name: 'Research task 1',
        expected_output: 'Evidence summary with sources, assumptions, and open questions',
        metadata: {
          task_template_id: 'research',
          task_template_label: 'Research',
        },
      })
    );
  });

  it('round-trips structured task input source declarations through graph task nodes', () => {
    const workflowWithTaskInputs: WorkflowDefinition = {
      ...workflow,
      task_definitions: [
        {
          ...workflow.task_definitions![0],
          metadata: {
            task_input_sources: ['previous_task_output', 'memory', 'human_input'],
          },
        },
      ],
      nodes: [workflow.nodes![0]],
      edges: [],
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithTaskInputs);
    const taskNode = graph.nodes.find((node) => node.data?.taskId === 'task-1');

    expect(taskNode?.data).toMatchObject({
      taskInputSources: ['previous_task_output', 'memory', 'human_input'],
    });

    const nextWorkflow = graphDocumentToWorkflowDefinition(graph, workflowWithTaskInputs);

    expect(nextWorkflow.task_definitions?.[0]?.metadata).toMatchObject({
      task_input_sources: ['previous_task_output', 'memory', 'human_input'],
    });
  });

  it('round-trips task runtime overrides through graph task nodes', () => {
    const workflowWithTaskOverrides: WorkflowDefinition = {
      ...workflow,
      task_definitions: [
        {
          ...workflow.task_definitions![0],
          metadata: {
            task_runtime_overrides: {
              timeout_seconds: 180,
              max_retries: 0,
              model_profile_id: 'profile-1',
              max_tokens: 4096,
              approval_policy: 'required',
            },
          },
        },
      ],
      nodes: [workflow.nodes![0]],
      edges: [],
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithTaskOverrides);
    const taskNode = graph.nodes.find((node) => node.data?.taskId === 'task-1');

    expect(taskNode?.data).toMatchObject({
      taskRuntimeOverrides: {
        timeout_seconds: 180,
        max_retries: 0,
        model_profile_id: 'profile-1',
        max_tokens: 4096,
        approval_policy: 'required',
      },
    });

    const nextWorkflow = graphDocumentToWorkflowDefinition(graph, workflowWithTaskOverrides);

    expect(nextWorkflow.task_definitions?.[0]).toMatchObject({
      timeout_seconds: 180,
      max_retries: 0,
      model_profile_id: 'profile-1',
      max_tokens: 4096,
      approval_policy: 'required',
    });
    const savedMetadata = nextWorkflow.task_definitions?.[0]?.metadata as JsonObject | undefined;
    expect(savedMetadata?.task_runtime_overrides).toBeUndefined();
  });

  it('creates workflow draft memory nodes and persists workflow memory definitions', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      agent_definitions: [],
      task_definitions: [],
      tool_definitions: [],
      memory_definitions: [],
      nodes: [],
      edges: [],
    });
    const graphWithMemory = addWorkflowMemoryNodeToGraphDocument(graph);
    const memoryNode = graphWithMemory.nodes.find(
      (node) => node.type === workflowGraphNodeTypes.memory
    );

    const nextWorkflow = graphDocumentToWorkflowDefinition(graphWithMemory, {
      ...workflow,
      agent_definitions: [],
      task_definitions: [],
      tool_definitions: [],
      memory_definitions: [],
      nodes: [],
      edges: [],
    });

    expect(memoryNode?.data?.memoryId).toEqual(expect.stringMatching(/^memory-/));
    expect(nextWorkflow.memory_definitions).toEqual([
      expect.objectContaining({
        id: memoryNode?.data?.memoryId,
        name: 'Memory 1',
        memory_type: 'workflow',
        scope: 'workflow',
      }),
    ]);
  });

  it('creates workflow artifact nodes and persists them as durable output metadata', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      metadata: {},
      nodes: [],
      edges: [],
    });
    const graphWithArtifact = addWorkflowArtifactNodeToGraphDocument(graph);
    const artifactNode = graphWithArtifact.nodes.find(
      (node) => node.type === workflowGraphNodeTypes.artifact
    );

    const nextWorkflow = graphDocumentToWorkflowDefinition(graphWithArtifact, {
      ...workflow,
      metadata: {},
      nodes: [],
      edges: [],
    });

    expect(artifactNode?.data?.artifactId).toEqual(expect.stringMatching(/^artifact-/));
    expect(nextWorkflow.metadata?.workflow_artifact_definitions).toEqual([
      expect.objectContaining({
        id: artifactNode?.data?.artifactId,
        name: 'Artifact 1',
        artifact_type: 'output',
        producer_task_id: null,
      }),
    ]);
  });

  it('round-trips task-produced artifact nodes through workflow metadata', () => {
    const workflowWithArtifact: WorkflowDefinition = {
      ...workflow,
      metadata: {
        workflow_artifact_definitions: [
          {
            id: 'artifact-1',
            name: 'Final report',
            description: 'Final markdown report.',
            artifact_type: 'report',
            media_type: 'text/markdown',
            producer_task_id: 'task-2',
          },
        ],
      },
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithArtifact);
    const artifactNode = graph.nodes.find((node) => node.data?.artifactId === 'artifact-1');

    expect(artifactNode).toMatchObject({
      type: workflowGraphNodeTypes.artifact,
      label: 'Final report',
      data: expect.objectContaining({
        artifactType: 'report',
        mediaType: 'text/markdown',
        producerTaskId: 'task-2',
      }),
    });
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.stringContaining('workflow-task-task-2'),
          target: artifactNode?.id,
          type: workflowGraphEdgeTypes.dataFlow,
          label: 'produces',
        }),
      ])
    );

    const nextWorkflow = graphDocumentToWorkflowDefinition(graph, workflowWithArtifact);

    expect(nextWorkflow.metadata?.workflow_artifact_definitions).toEqual([
      expect.objectContaining({
        id: 'artifact-1',
        name: 'Final report',
        artifact_type: 'report',
        media_type: 'text/markdown',
        producer_task_id: 'task-2',
      }),
    ]);
  });

  it('round-trips moved approval gates through task metadata', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const approvalNode = graph.nodes.find((node) => node.type === workflowGraphNodeTypes.approval);

    expect(approvalNode?.data?.taskId).toBe('task-2');

    const movedGraph = {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === approvalNode?.id ? { ...node, position: { x: 1440, y: 360 } } : node
      ),
    };
    const nextWorkflow = graphDocumentToWorkflowDefinition(movedGraph, workflow);
    const task = nextWorkflow.task_definitions?.find((candidate) => candidate.id === 'task-2');
    const taskMetadata =
      task?.metadata && typeof task.metadata === 'object' && !Array.isArray(task.metadata)
        ? task.metadata
        : {};

    expect(taskMetadata.workflow_graph_approval_position).toEqual({ x: 1440, y: 360 });

    const nextGraph = workflowDefinitionToGraphDocument(nextWorkflow);
    expect(nextGraph.nodes.find((node) => node.id === approvalNode?.id)?.position).toEqual({
      x: 1440,
      y: 360,
    });
  });

  it('places default approval gates beside manually positioned task nodes', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      task_definitions: [
        {
          id: 'task-approval',
          name: 'Needs review',
          description: 'Requires human signoff.',
          depends_on_task_ids: [],
          human_approval_required: true,
        },
      ],
      nodes: [
        {
          id: 'node-task-approval',
          name: 'Needs review',
          node_type: 'task',
          task_id: 'task-approval',
          metadata: {
            position: { x: 240, y: 360 },
          },
        },
      ],
      edges: [],
    });

    const taskNode = graph.nodes.find(
      (node) => node.type === workflowGraphNodeTypes.task && node.data?.taskId === 'task-approval'
    );
    const approvalNode = graph.nodes.find(
      (node) =>
        node.type === workflowGraphNodeTypes.approval && node.data?.taskId === 'task-approval'
    );

    expect(taskNode?.position).toEqual({ x: 240, y: 360 });
    expect(approvalNode?.position).toEqual({ x: 860, y: 372 });
  });

  it('round-trips catalog-backed workflow memory node metadata', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      memory_definitions: [
        {
          id: 'memory-1',
          name: 'Customer preferences',
          description: 'Pinned catalog memory.',
          memory_type: 'preference',
          scope: 'workflow',
          metadata: {
            catalog_ref_type: 'memory',
            catalog_ref_id: 'memory-record-1',
            catalog_memory_type: 'preference',
            catalog_mode: 'handoff',
            catalog_sensitive: true,
            catalog_embedded: true,
          },
        },
      ],
    });
    const memoryNode = graph.nodes.find((node) => node.data?.memoryId === 'memory-1');

    expect(memoryNode?.data).toMatchObject({
      catalogRefType: 'memory',
      catalogRefId: 'memory-record-1',
      catalogMemoryType: 'preference',
      catalogMode: 'handoff',
      catalogSensitive: true,
      catalogEmbedded: true,
    });

    const nextWorkflow = graphDocumentToWorkflowDefinition(graph, workflow);

    expect(nextWorkflow.memory_definitions?.[0]?.metadata).toMatchObject({
      catalog_ref_type: 'memory',
      catalog_ref_id: 'memory-record-1',
      catalog_memory_type: 'preference',
      catalog_mode: 'handoff',
      catalog_sensitive: true,
      catalog_embedded: true,
    });
  });

  it('removes workflow tasks and agents when their graph nodes are deleted', () => {
    const workflowWithEntrypoint: WorkflowDefinition = {
      ...workflow,
      entrypoint: 'node-task-2',
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithEntrypoint);
    const removedNodeIds = new Set(
      graph.nodes
        .filter(
          (node) =>
            (node.type === workflowGraphNodeTypes.agent && node.data?.agentId === 'agent-1') ||
            node.data?.taskId === 'task-2' ||
            node.metadata?.derivedFrom === 'workflow-task-task-2'
        )
        .map((node) => node.id)
    );
    const editedGraph = {
      ...graph,
      nodes: graph.nodes.filter((node) => !removedNodeIds.has(node.id)),
      edges: graph.edges.filter(
        (edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target)
      ),
    };

    const nextWorkflow = graphDocumentToWorkflowDefinition(editedGraph, workflowWithEntrypoint);

    expect(nextWorkflow.entrypoint).toBeUndefined();
    expect(nextWorkflow.agent_definitions).toEqual([]);
    expect(nextWorkflow.task_definitions).toEqual([
      expect.objectContaining({
        id: 'task-1',
        agent_id: null,
        depends_on_task_ids: [],
      }),
    ]);
    expect(nextWorkflow.nodes).toEqual([
      expect.objectContaining({
        id: 'node-task-1',
        task_id: 'task-1',
        agent_id: null,
      }),
    ]);
    expect(nextWorkflow.edges).toEqual([]);
  });

  it('applies workflow-safe connection rules for graph edges', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const taskOne = graph.nodes.find((node) => node.data?.taskId === 'task-1');
    const taskTwo = graph.nodes.find((node) => node.data?.taskId === 'task-2');
    const agent = graph.nodes.find((node) => node.data?.agentId === 'agent-1');
    const tool = graph.nodes.find(
      (node) =>
        node.type === workflowGraphNodeTypes.tool &&
        Array.isArray(node.data?.toolIds) &&
        node.data.toolIds.includes('tool-1')
    );

    expect(taskOne).toBeDefined();
    expect(taskTwo).toBeDefined();
    expect(agent).toBeDefined();
    expect(tool).toBeDefined();

    const duplicateDependency = applyWorkflowGraphConnection(graph, {
      id: 'duplicate-dependency',
      source: taskOne?.id ?? '',
      target: taskTwo?.id ?? '',
      type: 'default',
    });

    expect(duplicateDependency.document.edges).toBe(graph.edges);
    expect(duplicateDependency.issues).toEqual([
      expect.objectContaining({
        code: 'workflow.duplicateDependency',
        message: 'A dependency already exists between these tasks.',
      }),
    ]);

    const selfDependency = applyWorkflowGraphConnection(graph, {
      id: 'self-dependency',
      source: taskOne?.id ?? '',
      target: taskOne?.id ?? '',
      type: 'default',
    });

    expect(selfDependency.document).toBe(graph);
    expect(selfDependency.issues).toEqual([
      expect.objectContaining({
        code: 'workflow.selfDependency',
        message: 'A task cannot depend on itself.',
      }),
    ]);

    const assignment = applyWorkflowGraphConnection(graph, {
      id: 'assignment-edge',
      source: agent?.id ?? '',
      target: taskOne?.id ?? '',
      type: 'default',
    });

    expect(assignment.issues).toEqual([]);
    expect(assignment.document.nodes.find((node) => node.id === taskOne?.id)?.data).toEqual(
      expect.objectContaining({
        agentId: 'agent-1',
      })
    );
    expect(assignment.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: agent?.id,
          target: taskOne?.id,
          type: workflowGraphEdgeTypes.assignment,
        }),
      ])
    );

    const toolAccess = applyWorkflowGraphConnection(
      {
        ...graph,
        edges: graph.edges.filter((edge) => edge.type !== workflowGraphEdgeTypes.tool),
      },
      {
        id: 'tool-access-edge',
        source: tool?.id ?? '',
        target: agent?.id ?? '',
        type: 'default',
      }
    );

    expect(toolAccess.issues).toEqual([]);
    expect(toolAccess.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: tool?.id,
          target: agent?.id,
          type: workflowGraphEdgeTypes.tool,
        }),
      ])
    );

    const graphWithMemory = addWorkflowMemoryNodeToGraphDocument(graph);
    const memory = graphWithMemory.nodes.find(
      (node) => node.type === workflowGraphNodeTypes.memory
    );
    const memoryToAgent = applyWorkflowGraphConnection(graphWithMemory, {
      id: 'memory-agent-edge',
      source: memory?.id ?? '',
      target: agent?.id ?? '',
      type: 'default',
    });
    const memoryToTask = applyWorkflowGraphConnection(graphWithMemory, {
      id: 'memory-task-edge',
      source: memory?.id ?? '',
      target: taskTwo?.id ?? '',
      type: 'default',
    });

    expect(memoryToAgent.issues).toEqual([]);
    expect(memoryToAgent.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: memory?.id,
          target: agent?.id,
          type: workflowGraphEdgeTypes.memory,
        }),
      ])
    );
    expect(memoryToTask.issues).toEqual([]);
    expect(memoryToTask.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: memory?.id,
          target: taskTwo?.id,
          type: workflowGraphEdgeTypes.memory,
        }),
      ])
    );

    const taskToMemory = applyWorkflowGraphConnection(graphWithMemory, {
      id: 'task-memory-edge',
      source: taskOne?.id ?? '',
      target: memory?.id ?? '',
      type: 'default',
    });

    expect(taskToMemory.issues).toEqual([]);
    expect(taskToMemory.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: memory?.id,
          target: taskOne?.id,
          type: workflowGraphEdgeTypes.memory,
        }),
      ])
    );

    const graphWithArtifact = addWorkflowArtifactNodeToGraphDocument(graph);
    const artifact = graphWithArtifact.nodes.find(
      (node) => node.type === workflowGraphNodeTypes.artifact
    );
    const taskToArtifact = applyWorkflowGraphConnection(graphWithArtifact, {
      id: 'task-artifact-edge',
      source: taskTwo?.id ?? '',
      target: artifact?.id ?? '',
      type: 'default',
    });

    expect(taskToArtifact.issues).toEqual([]);
    expect(taskToArtifact.document.nodes.find((node) => node.id === artifact?.id)?.data).toEqual(
      expect.objectContaining({ producerTaskId: 'task-2' })
    );
    expect(taskToArtifact.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: taskTwo?.id,
          target: artifact?.id,
          type: workflowGraphEdgeTypes.dataFlow,
          label: 'produces',
        }),
      ])
    );

    const toolToTask = applyWorkflowGraphConnection(graph, {
      id: 'tool-task-edge',
      source: tool?.id ?? '',
      target: taskOne?.id ?? '',
      type: 'default',
    });

    expect(toolToTask.document).toBe(graph);
    expect(toolToTask.issues).toEqual([
      expect.objectContaining({
        code: 'workflow.unsupportedConnection',
      }),
    ]);

    const invalidArtifactConnection = applyWorkflowGraphConnection(graphWithArtifact, {
      id: 'artifact-task-edge',
      source: artifact?.id ?? '',
      target: taskOne?.id ?? '',
      type: 'default',
    });

    expect(invalidArtifactConnection.document).toBe(graphWithArtifact);
    expect(invalidArtifactConnection.issues).toEqual([
      expect.objectContaining({
        code: 'workflow.unsupportedConnection',
      }),
    ]);

    const agentToTool = applyWorkflowGraphConnection(graph, {
      id: 'agent-tool-edge',
      source: agent?.id ?? '',
      target: tool?.id ?? '',
      type: 'default',
    });

    expect(agentToTool.issues).toEqual([]);
    expect(
      agentToTool.document.edges.filter(
        (edge) => edge.type === workflowGraphEdgeTypes.tool && edge.source === tool?.id
      )
    ).toEqual([
      expect.objectContaining({
        source: tool?.id,
        target: agent?.id,
      }),
    ]);

    const unsupported = applyWorkflowGraphConnection(graph, {
      id: 'unsupported-edge',
      source: agent?.id ?? '',
      target: agent?.id ?? '',
      type: 'default',
    });

    expect(unsupported.document).toBe(graph);
    expect(unsupported.issues).toEqual([
      expect.objectContaining({
        code: 'workflow.unsupportedConnection',
      }),
    ]);
  });

  it('round-trips dependency edge creation and deletion through workflow definitions', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      task_definitions: workflow.task_definitions?.map((task) =>
        task.id === 'task-2'
          ? {
              ...task,
              depends_on_task_ids: [],
            }
          : task
      ),
      edges: [],
    });
    const taskOne = graph.nodes.find((node) => node.data?.taskId === 'task-1');
    const taskTwo = graph.nodes.find((node) => node.data?.taskId === 'task-2');

    const connected = applyWorkflowGraphConnection(graph, {
      id: 'dependency-edge',
      source: taskOne?.id ?? '',
      target: taskTwo?.id ?? '',
      type: 'default',
    });

    expect(connected.issues).toEqual([]);
    expect(connected.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: taskOne?.id,
          target: taskTwo?.id,
          type: workflowGraphEdgeTypes.dependency,
        }),
      ])
    );

    const workflowWithDependency = graphDocumentToWorkflowDefinition(connected.document, workflow);

    expect(workflowWithDependency.task_definitions?.find((task) => task.id === 'task-2')).toEqual(
      expect.objectContaining({
        depends_on_task_ids: ['task-1'],
      })
    );

    const workflowAfterDeletion = graphDocumentToWorkflowDefinition(
      {
        ...connected.document,
        edges: connected.document.edges.filter(
          (edge) =>
            !(
              edge.source === taskOne?.id &&
              edge.target === taskTwo?.id &&
              edge.type === workflowGraphEdgeTypes.dependency
            )
        ),
      },
      workflowWithDependency
    );

    expect(workflowAfterDeletion.task_definitions?.find((task) => task.id === 'task-2')).toEqual(
      expect.objectContaining({
        depends_on_task_ids: [],
      })
    );
  });

  it('removes workflow dependencies when graph edges are deleted', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const nextWorkflow = graphDocumentToWorkflowDefinition(
      {
        ...graph,
        edges: graph.edges.filter((edge) => edge.type !== workflowGraphEdgeTypes.condition),
      },
      workflow
    );

    expect(nextWorkflow.task_definitions?.find((task) => task.id === 'task-2')).toMatchObject({
      depends_on_task_ids: [],
    });
    expect(nextWorkflow.edges).toEqual([]);
  });

  it('uses tool access edges as the source of truth for agent tool assignments', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const agent = graph.nodes.find((node) => node.data?.agentId === 'agent-1');
    const tool = graph.nodes.find(
      (node) =>
        node.type === workflowGraphNodeTypes.tool &&
        Array.isArray(node.data?.toolIds) &&
        node.data.toolIds.includes('tool-1')
    );

    const workflowWithoutToolAccess = graphDocumentToWorkflowDefinition(
      {
        ...graph,
        edges: graph.edges.filter((edge) => edge.type !== workflowGraphEdgeTypes.tool),
      },
      workflow
    );

    expect(workflowWithoutToolAccess.agent_definitions?.[0]?.tool_ids).toEqual([]);

    const connected = applyWorkflowGraphConnection(
      {
        ...graph,
        edges: graph.edges.filter((edge) => edge.type !== workflowGraphEdgeTypes.tool),
      },
      {
        id: 'new-tool-access',
        source: tool?.id ?? '',
        target: agent?.id ?? '',
        type: 'default',
      }
    );
    const workflowWithToolAccess = graphDocumentToWorkflowDefinition(connected.document, workflow);

    expect(workflowWithToolAccess.agent_definitions?.[0]?.tool_ids).toEqual(['tool-1']);
  });

  it('normalizes reverse graph connections for assignable node pairs', () => {
    const graphWithExistingEdges = workflowDefinitionToGraphDocument({
      ...workflow,
      memory_definitions: [
        {
          id: 'memory-1',
          name: 'Research Memory',
          description: 'Workflow memory context.',
        },
      ],
    });
    const graph = {
      ...graphWithExistingEdges,
      edges: graphWithExistingEdges.edges.filter(
        (edge) => edge.type !== workflowGraphEdgeTypes.tool
      ),
    };
    const agent = graph.nodes.find((node) => node.data?.agentId === 'agent-1');
    const task = graph.nodes.find((node) => node.data?.taskId === 'task-1');
    const tool = graph.nodes.find(
      (node) =>
        node.type === workflowGraphNodeTypes.tool &&
        Array.isArray(node.data?.toolIds) &&
        node.data.toolIds.includes('tool-1')
    );
    const memory = graph.nodes.find((node) => node.data?.memoryId === 'memory-1');

    const assignment = applyWorkflowGraphConnection(graph, {
      id: 'reverse-assignment',
      source: task?.id ?? '',
      target: agent?.id ?? '',
      type: 'default',
    });
    const toolAccess = applyWorkflowGraphConnection(graph, {
      id: 'reverse-tool',
      source: agent?.id ?? '',
      target: tool?.id ?? '',
      type: 'default',
    });
    const memoryAccess = applyWorkflowGraphConnection(graph, {
      id: 'reverse-memory',
      source: task?.id ?? '',
      target: memory?.id ?? '',
      type: 'default',
    });

    expect(assignment.issues).toEqual([]);
    expect(assignment.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: agent?.id,
          target: task?.id,
          type: workflowGraphEdgeTypes.assignment,
        }),
      ])
    );
    expect(toolAccess.issues).toEqual([]);
    expect(toolAccess.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: tool?.id,
          target: agent?.id,
          type: workflowGraphEdgeTypes.tool,
        }),
      ])
    );
    expect(memoryAccess.issues).toEqual([]);
    expect(memoryAccess.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: memory?.id,
          target: task?.id,
          type: workflowGraphEdgeTypes.memory,
        }),
      ])
    );
  });

  it('uses memory access edges as the source of truth for agent and task memory access', () => {
    const workflowWithMemory: WorkflowDefinition = {
      ...workflow,
      memory_definitions: [
        {
          id: 'memory-1',
          name: 'Research Memory',
          description: 'Workflow memory context.',
          memory_type: 'workflow',
          scope: 'workflow',
        },
      ],
      agent_definitions: workflow.agent_definitions?.map((agent) => ({
        ...agent,
        memory_ids: ['memory-1'],
      })),
      task_definitions: workflow.task_definitions?.map((task) =>
        task.id === 'task-2'
          ? {
              ...task,
              memory_ids: ['memory-1'],
            }
          : task
      ),
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithMemory);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workflow-memory-memory-1',
          type: workflowGraphNodeTypes.memory,
          label: 'Research Memory',
        }),
      ])
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'workflow-memory-memory-1',
          target: 'workflow-agent-agent-1',
          type: workflowGraphEdgeTypes.memory,
        }),
        expect.objectContaining({
          source: 'workflow-memory-memory-1',
          target: 'workflow-task-task-2',
          type: workflowGraphEdgeTypes.memory,
        }),
      ])
    );

    const workflowWithoutMemoryAccess = graphDocumentToWorkflowDefinition(
      {
        ...graph,
        edges: graph.edges.filter((edge) => edge.type !== workflowGraphEdgeTypes.memory),
      },
      workflowWithMemory
    );

    expect(workflowWithoutMemoryAccess.agent_definitions?.[0]?.memory_ids).toEqual([]);
    expect(
      workflowWithoutMemoryAccess.task_definitions?.find((task) => task.id === 'task-2')?.memory_ids
    ).toEqual([]);
  });

  it('round-trips graph layout positions through workflow metadata', () => {
    const sourceWorkflow = {
      ...workflow,
      agent_definitions: [
        {
          id: 'agent-1',
          name: 'Researcher',
          role: 'Find evidence',
          tool_ids: ['tool-1'],
          metadata: {
            workflow_graph_position: { x: -40, y: 120 },
          },
        },
      ],
      tool_definitions: [
        {
          id: 'tool-1',
          name: 'Search Tool',
          description: 'Searches documents.',
          tool_type: 'native',
          metadata: {
            workflow_graph_position: { x: -420, y: 120 },
          },
        },
      ],
      memory_definitions: [
        {
          id: 'memory-1',
          name: 'Research Memory',
          metadata: {
            workflow_graph_position: { x: -760, y: 120 },
          },
        },
      ],
      nodes: [
        {
          id: 'node-task-1',
          name: 'Search',
          node_type: 'task',
          task_id: 'task-1',
          metadata: {
            position: { x: 120, y: 140 },
            lane: 'research',
          },
        },
        {
          id: 'node-task-2',
          name: 'Summarize',
          node_type: 'task',
          task_id: 'task-2',
          metadata: {
            position: { x: 120, y: 300 },
          },
        },
      ],
    };
    const graph = workflowDefinitionToGraphDocument(sourceWorkflow);

    expect(graph.nodes.find((node) => node.data?.agentId === 'agent-1')?.position).toEqual({
      x: -40,
      y: 120,
    });
    expect(
      graph.nodes.find(
        (node) =>
          node.type === workflowGraphNodeTypes.tool &&
          Array.isArray(node.data?.toolIds) &&
          node.data.toolIds.includes('tool-1')
      )?.position
    ).toEqual({
      x: -420,
      y: 120,
    });
    expect(graph.nodes.find((node) => node.data?.memoryId === 'memory-1')?.position).toEqual({
      x: -760,
      y: 120,
    });

    const laidOutGraph = layoutGraphDocumentGrid(graph, {
      columns: 2,
      startX: 20,
      startY: 30,
      gapX: 400,
      gapY: 200,
    });
    const taskOneLayout = laidOutGraph.nodes.find((node) => node.data?.taskId === 'task-1');
    const taskTwoLayout = laidOutGraph.nodes.find((node) => node.data?.taskId === 'task-2');
    const agentLayout = laidOutGraph.nodes.find((node) => node.data?.agentId === 'agent-1');
    const toolLayout = laidOutGraph.nodes.find(
      (node) =>
        node.type === workflowGraphNodeTypes.tool &&
        Array.isArray(node.data?.toolIds) &&
        node.data.toolIds.includes('tool-1')
    );
    const memoryLayout = laidOutGraph.nodes.find((node) => node.data?.memoryId === 'memory-1');

    const nextWorkflow = graphDocumentToWorkflowDefinition(laidOutGraph, sourceWorkflow);
    const nextTaskOneNode = nextWorkflow.nodes?.find((node) => node.task_id === 'task-1');
    const nextTaskTwoNode = nextWorkflow.nodes?.find((node) => node.task_id === 'task-2');
    const reloadedGraph = workflowDefinitionToGraphDocument(nextWorkflow);

    expect(nextTaskOneNode).toMatchObject({
      id: 'node-task-1',
      metadata: {
        generated_by: 'workflow-graph-adapter',
        lane: 'research',
        position: taskOneLayout?.position,
      },
    });
    expect(nextTaskTwoNode?.metadata?.position).toEqual(taskTwoLayout?.position);
    expect(
      (nextWorkflow.agent_definitions?.[0]?.metadata as Record<string, unknown> | undefined)
        ?.workflow_graph_position
    ).toEqual(agentLayout?.position);
    expect(
      (nextWorkflow.tool_definitions?.[0]?.metadata as Record<string, unknown> | undefined)
        ?.workflow_graph_position
    ).toEqual(toolLayout?.position);
    expect(
      (nextWorkflow.memory_definitions?.[0]?.metadata as Record<string, unknown> | undefined)
        ?.workflow_graph_position
    ).toEqual(memoryLayout?.position);
    expect(reloadedGraph.nodes.find((node) => node.data?.taskId === 'task-1')?.position).toEqual({
      x: 700,
      y: taskOneLayout?.position?.y,
    });
    expect(reloadedGraph.nodes.find((node) => node.data?.taskId === 'task-2')?.position).toEqual({
      x: 700,
      y: Math.max(taskTwoLayout?.position?.y ?? 0, (taskOneLayout?.position?.y ?? 0) + 320),
    });
    expect(reloadedGraph.nodes.find((node) => node.data?.agentId === 'agent-1')?.position).toEqual(
      agentLayout?.position
    );
    expect(
      reloadedGraph.nodes.find(
        (node) =>
          node.type === workflowGraphNodeTypes.tool &&
          Array.isArray(node.data?.toolIds) &&
          node.data.toolIds.includes('tool-1')
      )?.position
    ).toEqual(toolLayout?.position);
    expect(
      reloadedGraph.nodes.find((node) => node.data?.memoryId === 'memory-1')?.position
    ).toEqual(memoryLayout?.position);
  });

  it('recomputes derived node positions from persisted task positions', () => {
    const graph = workflowDefinitionToGraphDocument({
      ...workflow,
      nodes: [
        {
          id: 'node-task-1',
          name: 'Search',
          node_type: 'task',
          task_id: 'task-1',
          metadata: {
            position: { x: 200, y: 100 },
          },
        },
        {
          id: 'node-task-2',
          name: 'Summarize',
          node_type: 'task',
          task_id: 'task-2',
          metadata: {
            position: { x: 500, y: 500 },
          },
        },
      ],
    });

    expect(graph.nodes.find((node) => node.type === workflowGraphNodeTypes.approval)).toEqual(
      expect.objectContaining({
        position: { x: 1300, y: 512 },
      })
    );
    expect(graph.nodes.find((node) => node.type === workflowGraphNodeTypes.router)).toEqual(
      expect.objectContaining({
        position: { x: 1020, y: 300 },
      })
    );
  });

  it('maps workflow draft validation issues to graph nodes and edges', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const issues = workflowDraftIssuesToGraphValidationIssues(graph, workflow, [
      'Task "Search" must have a description.',
      'Edge condition for "Search" -> "Summarize" is required when edge type is conditional.',
    ]);

    expect(issues).toEqual([
      expect.objectContaining({
        target: 'node',
        targetId: 'workflow-task-task-1',
        workflowReference: {
          kind: 'task',
          id: 'task-1',
        },
      }),
      expect.objectContaining({
        target: 'edge',
        targetId: expect.any(String),
        workflowReference: {
          kind: 'edge',
          id: expect.any(String),
        },
      }),
    ]);
  });

  it('maps generic graph validation issues to workflow references', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const taskNode = graph.nodes.find((node) => node.data?.taskId === 'task-1');

    const issues = validateWorkflowGraphDocument({
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== taskNode?.id),
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: 'edge',
          workflowReference: {
            kind: 'edge',
            id: expect.any(String),
          },
          workflowPath: expect.stringContaining('edges[id='),
        }),
      ])
    );
  });

  it('warns when workflow graph resources reference missing agents, tools, tasks, or memories', () => {
    const workflowWithMissingResources: WorkflowDefinition = {
      ...workflow,
      agent_definitions: [
        {
          ...workflow.agent_definitions![0],
          tool_ids: ['tool-missing'],
          memory_ids: ['memory-missing'],
          handoff_agent_ids: ['agent-missing'],
        },
      ],
      task_definitions: [
        {
          ...workflow.task_definitions![0],
          agent_id: null,
          tool_ids: ['task-tool-missing'],
          memory_ids: ['task-memory-missing'],
        },
        {
          ...workflow.task_definitions![1],
          agent_id: 'agent-missing',
          depends_on_task_ids: ['task-missing'],
        },
      ],
      tool_definitions: [],
      memory_definitions: [],
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithMissingResources);

    const issues = validateWorkflowResourceReferences(workflowWithMissingResources, graph);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'warning',
          code: 'workflow.taskUnassignedAgent',
          workflowReference: { kind: 'task', id: 'task-1' },
          target: 'node',
          targetId: 'workflow-task-task-1',
        }),
        expect.objectContaining({
          code: 'workflow.taskMissingAssignedAgent',
          workflowReference: { kind: 'task', id: 'task-2' },
          targetId: 'workflow-task-task-2',
        }),
        expect.objectContaining({
          code: 'workflow.taskMissingTool',
          message: 'Task "Search" references missing tool "task-tool-missing".',
        }),
        expect.objectContaining({
          code: 'workflow.taskMissingMemory',
          message: 'Task "Search" references missing memory "task-memory-missing".',
        }),
        expect.objectContaining({
          code: 'workflow.taskMissingDependency',
          message: 'Task "Summarize" depends on missing task "task-missing".',
        }),
        expect.objectContaining({
          code: 'workflow.agentMissingTool',
          workflowReference: { kind: 'agent', id: 'agent-1' },
          targetId: 'workflow-agent-agent-1',
        }),
        expect.objectContaining({
          code: 'workflow.agentMissingMemory',
          message: 'Agent "Researcher" references missing memory "memory-missing".',
        }),
        expect.objectContaining({
          code: 'workflow.agentMissingHandoffTarget',
          message: 'Agent "Researcher" can hand off to missing agent "agent-missing".',
        }),
      ])
    );
  });

  it('warns when a task mixes conditional and unqualified upstream dependencies', () => {
    const workflowWithAmbiguousDependencies: WorkflowDefinition = {
      ...workflow,
      task_definitions: [
        workflow.task_definitions![0],
        {
          ...workflow.task_definitions![1],
          depends_on_task_ids: ['task-1', 'task-3'],
        },
        {
          id: 'task-3',
          name: 'Review',
          description: 'Review evidence.',
          instructions: 'Review the search output.',
          expected_output: 'Reviewed evidence.',
          agent_id: 'agent-1',
          tool_ids: [],
          depends_on_task_ids: [],
          human_approval_required: false,
        },
      ],
      nodes: [
        ...(workflow.nodes ?? []),
        { id: 'node-task-3', name: 'Review', node_type: 'task', task_id: 'task-3', metadata: {} },
      ],
      edges: [
        {
          id: 'edge-node-task-1-node-task-2',
          source_node_id: 'node-task-1',
          target_node_id: 'node-task-2',
          edge_type: 'conditional',
          condition: 'ready',
          metadata: {},
        },
      ],
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithAmbiguousDependencies);

    expect(validateWorkflowResourceReferences(workflowWithAmbiguousDependencies, graph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'workflow.taskAmbiguousDependencies',
          message:
            'Task "Summarize" mixes conditional and unqualified upstream dependencies; add metadata to clarify readiness.',
          workflowReference: { kind: 'task', id: 'task-2' },
          targetId: 'workflow-task-task-2',
        }),
      ])
    );
  });

  it('warns when an approval-required task is blocked waiting for approval', () => {
    const events = workflowActivityToGraphRuntimeEvents({
      workflow,
      runs: [
        {
          id: 'run-approval-1',
          workflowId: 'workflow-1',
          status: 'waiting_for_approval',
          currentNodeId: 'node-task-2',
          updatedAt: '2026-05-21T00:00:02.000Z',
        },
      ],
    });

    expect(validateWorkflowRuntimeWarnings(workflow, events)).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'workflow.taskBlockedApproval',
        message: 'Task "Summarize" is blocked waiting for human approval.',
        target: 'node',
        targetId: 'workflow-approval-task-2',
        workflowReference: { kind: 'task', id: 'task-2' },
      }),
    ]);
  });

  it('maps workflow activity into graph runtime events', () => {
    const events = workflowActivityToGraphRuntimeEvents({
      runs: [
        {
          id: 'run-1',
          workflowId: 'workflow-1',
          status: 'waiting_for_approval',
          currentNodeId: 'node-task-2',
          updatedAt: '2026-05-21T00:00:02.000Z',
        },
      ],
      monitoringEvents: {
        workflow_id: 'workflow-1',
        monitoring: {} as never,
        findings: [
          {
            id: 'event-1',
            execution_id: 'run-1',
            workflow_id: 'workflow-1',
            task_id: 'task-1',
            event_type: 'task.started',
            timestamp: '2026-05-21T00:00:01.000Z',
            sequence: 1,
          },
        ],
        proposals: [],
        evaluations: [],
        comparisons: [],
        approval_controls: [],
      },
    });

    expect(events.map((event) => event.id)).toEqual(['event-1', expect.stringContaining('run-1')]);
    expect(events[0]).toMatchObject({
      type: 'task.started',
      graphId: 'workflow-1',
      nodeId: 'workflow-task-task-1',
    });
    expect(events[1]).toMatchObject({
      type: 'run.waiting_for_approval',
      status: 'waiting',
      nodeId: 'workflow-task-task-2',
    });
  });

  it('projects monitoring task events onto assigned agent and workflow edges', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const assignmentEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.assignment &&
        edge.data?.agentId === 'agent-1' &&
        edge.data?.taskId === 'task-2'
    );
    const dependencyEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.condition &&
        edge.data?.sourceTaskId === 'task-1' &&
        edge.data?.targetTaskId === 'task-2'
    );
    const events = workflowActivityToGraphRuntimeEvents({
      workflow,
      monitoringEvents: {
        workflow_id: 'workflow-1',
        monitoring: {} as never,
        findings: [
          {
            id: 'event-task-2-started',
            execution_id: 'run-1',
            workflow_id: 'workflow-1',
            task_id: 'task-2',
            event_type: 'task.started',
            timestamp: '2026-05-21T00:00:01.000Z',
            sequence: 1,
            payload: {
              input: { query: 'evidence' },
            },
          },
        ],
        proposals: [],
        evaluations: [],
        comparisons: [],
        approval_controls: [],
      },
    });

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'event-task-2-started',
          type: 'task.started',
          status: 'running',
          nodeId: 'workflow-task-task-2',
        }),
        expect.objectContaining({
          id: 'event-task-2-started-agent-agent-1',
          type: 'task.started',
          status: 'running',
          nodeId: 'workflow-agent-agent-1',
        }),
        expect.objectContaining({
          id: 'event-task-2-started-assignment-edge-agent-1-task-2',
          type: 'task.started',
          status: 'transmitting',
          nodeId: undefined,
          edgeId: assignmentEdge?.id,
        }),
        expect.objectContaining({
          id: 'event-task-2-started-dependency-edge-task-1-task-2',
          type: 'task.started',
          status: 'transmitting',
          nodeId: undefined,
          edgeId: dependencyEdge?.id,
        }),
      ])
    );
  });

  it('projects execution events onto assigned agent and workflow edges', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const assignmentEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.assignment &&
        edge.data?.agentId === 'agent-1' &&
        edge.data?.taskId === 'task-2'
    );
    const dependencyEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.condition &&
        edge.data?.sourceTaskId === 'task-1' &&
        edge.data?.targetTaskId === 'task-2'
    );
    const events = workflowActivityToGraphRuntimeEvents({
      workflow,
      executionEvents: [
        {
          id: 'execution-event-task-2-completed',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          task_id: 'task-2',
          event_type: 'task.completed',
          timestamp: '2026-05-21T00:00:03.000Z',
          sequence: 3,
          payload: {
            output: { summary: 'done' },
          },
        },
      ],
    });

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'execution-event-task-2-completed',
          type: 'task.completed',
          status: 'succeeded',
          nodeId: 'workflow-task-task-2',
        }),
        expect.objectContaining({
          id: 'execution-event-task-2-completed-agent-agent-1',
          status: 'succeeded',
          nodeId: 'workflow-agent-agent-1',
        }),
        expect.objectContaining({
          id: 'execution-event-task-2-completed-assignment-edge-agent-1-task-2',
          status: 'completed',
          edgeId: assignmentEdge?.id,
          nodeId: undefined,
        }),
        expect.objectContaining({
          id: 'execution-event-task-2-completed-dependency-edge-task-1-task-2',
          status: 'completed',
          edgeId: dependencyEdge?.id,
          nodeId: undefined,
        }),
      ])
    );
  });

  it('projects completed task output across downstream task edges with metrics', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const downstreamEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.condition &&
        edge.data?.sourceTaskId === 'task-1' &&
        edge.data?.targetTaskId === 'task-2'
    );
    const events = workflowActivityToGraphRuntimeEvents({
      workflow,
      executionEvents: [
        {
          id: 'execution-event-task-1-completed',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          task_id: 'task-1',
          event_type: 'task.completed',
          timestamp: '2026-05-21T00:00:02.000Z',
          sequence: 2,
          payload: {
            output: { evidence: ['a', 'b'] },
          },
          metrics: {
            durationMs: 1250,
          },
        },
      ],
    });

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'execution-event-task-1-completed',
          status: 'succeeded',
          nodeId: 'workflow-task-task-1',
          metadata: expect.objectContaining({
            metrics: expect.objectContaining({ durationMs: 1250 }),
          }),
        }),
        expect.objectContaining({
          id: 'execution-event-task-1-completed-downstream-edge-task-1-task-2',
          status: 'transmitting',
          edgeId: downstreamEdge?.id,
          nodeId: undefined,
          metadata: expect.objectContaining({
            projectedRole: 'downstreamEdge',
            sourceTaskId: 'task-1',
            targetTaskId: 'task-2',
          }),
        }),
      ])
    );
  });

  it('projects tool call activity only onto the matching tool access edge', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const toolEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.tool &&
        edge.data?.agentId === 'agent-1' &&
        Array.isArray(edge.data?.toolIds) &&
        edge.data.toolIds.includes('tool-1')
    );
    const dependencyEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.condition &&
        edge.data?.sourceTaskId === 'task-1' &&
        edge.data?.targetTaskId === 'task-2'
    );
    const events = workflowActivityToGraphRuntimeEvents({
      workflow,
      executionEvents: [
        {
          id: 'execution-event-tool-started',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          task_id: 'task-2',
          agent_id: 'agent-1',
          event_type: 'tool.call.started',
          timestamp: '2026-05-21T00:00:02.000Z',
          sequence: 2,
          payload: {
            tool_id: 'tool-1',
            input: { query: 'evidence' },
          },
        },
      ],
    });

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'execution-event-tool-started-tool-edge-agent-1-tool-1',
          status: 'transmitting',
          edgeId: toolEdge?.id,
          nodeId: undefined,
          metadata: expect.objectContaining({
            projectedRole: 'toolEdge',
            toolId: 'tool-1',
          }),
        }),
      ])
    );
    expect(
      events.some(
        (event) =>
          event.edgeId === dependencyEdge?.id &&
          event.metadata?.source === 'workflowRuntimeProjection'
      )
    ).toBe(false);
  });

  it('maps skipped and explicit source-target execution events', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const dependencyEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.condition &&
        edge.data?.sourceTaskId === 'task-1' &&
        edge.data?.targetTaskId === 'task-2'
    );
    const events = workflowActivityToGraphRuntimeEvents({
      workflow,
      executionEvents: [
        {
          id: 'execution-event-task-2-skipped',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          task_id: 'task-2',
          event_type: 'task.skipped',
          timestamp: '2026-05-21T00:00:04.000Z',
          sequence: 4,
          payload: {
            source_task_id: 'task-1',
            target_task_id: 'task-2',
            reason: 'condition false',
          },
        },
      ],
    });

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'execution-event-task-2-skipped',
          status: 'skipped',
          edgeId: dependencyEdge?.id,
          nodeId: 'workflow-task-task-2',
        }),
        expect.objectContaining({
          id: 'execution-event-task-2-skipped-dependency-edge-task-1-task-2',
          status: 'inactive',
          edgeId: dependencyEdge?.id,
          nodeId: undefined,
        }),
      ])
    );
  });

  it('maps backend handoff edges and runtime events onto handoff graph edges', () => {
    const workflowWithHandoff: WorkflowDefinition = {
      ...workflow,
      edges: [
        {
          id: 'edge-handoff-1-2',
          source_node_id: 'node-task-1',
          target_node_id: 'node-task-2',
          edge_type: 'handoff',
        },
      ],
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithHandoff);
    const handoffEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.handoff &&
        edge.data?.sourceTaskId === 'task-1' &&
        edge.data?.targetTaskId === 'task-2'
    );
    const events = workflowActivityToGraphRuntimeEvents({
      workflow: workflowWithHandoff,
      executionEvents: [
        {
          id: 'execution-event-handoff-requested',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          task_id: 'task-2',
          event_type: 'handoff.requested',
          timestamp: '2026-05-21T00:00:04.000Z',
          sequence: 4,
          payload: {
            edge_id: 'edge-handoff-1-2',
            source_node_id: 'node-task-1',
            target_node_id: 'node-task-2',
            source_task_id: 'task-1',
            target_task_id: 'task-2',
            source_agent_id: 'agent-1',
            target_agent_id: 'agent-1',
            status: 'requested',
          },
        },
      ],
    });

    expect(handoffEdge).toBeDefined();
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'execution-event-handoff-requested',
          status: 'requested',
          edgeId: handoffEdge?.id,
          nodeId: 'workflow-task-task-2',
        }),
      ])
    );
  });

  it('projects memory runtime events onto task memory access edges', () => {
    const workflowWithMemory: WorkflowDefinition = {
      ...workflow,
      memory_definitions: [
        {
          id: 'memory-1',
          name: 'Decision memory',
          memory_type: 'workflow',
          scope: 'workflow',
        },
      ],
      task_definitions: workflow.task_definitions?.map((task) =>
        task.id === 'task-2' ? { ...task, memory_ids: ['memory-1'] } : task
      ),
    };
    const graph = workflowDefinitionToGraphDocument(workflowWithMemory);
    const memoryEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.memory &&
        edge.data?.memoryId === 'memory-1' &&
        edge.data?.taskId === 'task-2'
    );
    const events = workflowActivityToGraphRuntimeEvents({
      workflow: workflowWithMemory,
      executionEvents: [
        {
          id: 'event-memory-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          task_id: 'task-2',
          event_type: 'memory.retrieved',
          timestamp: '2026-05-21T00:00:01.000Z',
          sequence: 1,
          payload: {
            memoryId: 'memory-1',
            status: 'running',
            summary: 'Retrieved decision context.',
          },
        },
      ],
    });

    expect(memoryEdge?.id).toBeTruthy();
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'event-memory-1-memory-edge-memory-1-task-2',
          type: 'memory.retrieved',
          edgeId: memoryEdge?.id,
          nodeId: undefined,
          status: 'transmitting',
          metadata: expect.objectContaining({
            source: 'workflowRuntimeProjection',
            projectedRole: 'memoryEdge',
            memoryId: 'memory-1',
            taskId: 'task-2',
          }),
        }),
      ])
    );
  });

  it('projects live run status onto assigned agent, approval, and workflow edges', () => {
    const graph = workflowDefinitionToGraphDocument(workflow);
    const assignmentEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.assignment &&
        edge.data?.agentId === 'agent-1' &&
        edge.data?.taskId === 'task-2'
    );
    const dependencyEdge = graph.edges.find(
      (edge) =>
        edge.type === workflowGraphEdgeTypes.condition &&
        edge.data?.sourceTaskId === 'task-1' &&
        edge.data?.targetTaskId === 'task-2'
    );
    const events = workflowActivityToGraphRuntimeEvents({
      workflow,
      runs: [
        {
          id: 'run-1',
          workflowId: 'workflow-1',
          status: 'waiting_for_approval',
          currentNodeId: 'node-task-2',
          updatedAt: '2026-05-21T00:00:02.000Z',
        },
      ],
    });

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'run.waiting_for_approval',
          status: 'waiting',
          nodeId: 'workflow-task-task-2',
        }),
        expect.objectContaining({
          type: 'agent.waiting_for_approval',
          status: 'waiting',
          nodeId: 'workflow-agent-agent-1',
          metadata: expect.objectContaining({
            projectedRole: 'assignedAgent',
          }),
        }),
        expect.objectContaining({
          type: 'approval.waiting_for_approval',
          status: 'waiting',
          nodeId: 'workflow-approval-task-2',
          metadata: expect.objectContaining({
            projectedRole: 'approvalGate',
          }),
        }),
        expect.objectContaining({
          type: 'assignment.waiting_for_approval',
          status: 'blocked',
          edgeId: assignmentEdge?.id,
          nodeId: undefined,
          metadata: expect.objectContaining({
            projectedRole: 'assignmentEdge',
          }),
        }),
        expect.objectContaining({
          type: 'dependency.waiting_for_approval',
          status: 'blocked',
          edgeId: dependencyEdge?.id,
          nodeId: undefined,
          metadata: expect.objectContaining({
            projectedRole: 'dependencyEdge',
            sourceTaskId: 'task-1',
            targetTaskId: 'task-2',
          }),
        }),
      ])
    );
  });

  it('maps supervisor steering requests from evidence onto affected graph nodes', () => {
    const events = workflowMonitoringEventsToGraphRuntimeEvents(
      {
        workflow_id: 'workflow-1',
        monitoring: {
          enabled: true,
          level: 'standard',
          exempted: false,
          visible_to_main_agent: true,
          mutable_by_main_agent: true,
          default_enabled: true,
          is_main_agent_default_workflow: false,
          status_label: 'Standard',
          controls: {
            enabled: true,
            level: 'standard',
            store_run_summaries: true,
            store_failure_summaries: true,
            allow_improvement_proposals: true,
            allow_evaluation_agent_review: true,
            allow_self_monitoring: false,
            safe_to_summarize: true,
            route_improvement_proposals_to_approval: true,
            supervise_token_usage: true,
            supervise_context_health: true,
            supervise_subagents: true,
            supervise_tool_failures: true,
            excluded_subagent_ids: [],
            excluded_task_ids: [],
            allowed_steering_actions: ['request_human_review'],
          },
        },
        findings: [],
        proposals: [],
        evaluations: [],
        comparisons: [],
        steering_requests: [
          {
            id: 'steering-1',
            execution_id: 'execution-1',
            workflow_id: 'workflow-1',
            event_type: 'supervisor.steering.requested',
            timestamp: '2026-05-25T00:00:00.000Z',
            sequence: 1,
            payload: {
              evidence: {
                agent_id: 'agent-1',
                task_id: 'task-2',
              },
              status: 'requested',
            },
          },
        ],
        steering_applied: [],
        approval_controls: [],
      },
      workflow
    );

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'steering-1',
          type: 'supervisor.steering.requested',
          nodeId: 'workflow-task-task-2',
          metadata: expect.objectContaining({
            agentId: 'agent-1',
            taskId: 'task-2',
          }),
        }),
        expect.objectContaining({
          id: 'steering-1-agent-agent-1',
          type: 'supervisor.steering.requested',
          nodeId: 'workflow-agent-agent-1',
          metadata: expect.objectContaining({
            projectedRole: 'assignedAgent',
          }),
        }),
      ])
    );
  });
});
