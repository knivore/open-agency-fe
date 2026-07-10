import { describe, expect, it } from 'vitest';
import {
  buildWorkflowExportPackage,
  createWorkflowDefinitionFromExportPackage,
  parseWorkflowExportPackageJson,
  stringifyWorkflowExportPackage,
  workflowExportFileName,
  workflowExportSchemaVersion,
} from '@/lib/workflows/workflowExport';
import type { WorkflowDefinition } from '@/types/workflows';

const workflow: WorkflowDefinition = {
  id: 'workflow-1',
  name: 'Market Research Workflow',
  description: 'Collect and summarize market data.',
  agent_definitions: [
    {
      id: 'agent-1',
      name: 'Researcher',
      model_profile_id: 'profile-1',
      tool_ids: ['custom-search', 'catalog.browser', 'missing-tool'],
    },
  ],
  task_definitions: [
    {
      id: 'task-1',
      name: 'Research',
      description: 'Find market signals.',
      agent_id: 'agent-1',
      tool_ids: ['custom-search'],
      depends_on_task_ids: [],
    },
  ],
  tool_definitions: [
    {
      id: 'custom-search',
      name: 'custom.search',
      display_name: 'Custom Search',
      description: 'Searches a private source.',
      tool_type: 'custom',
      implementation: {
        runtime: 'python',
        code: 'def run(input): return input',
      },
    },
  ],
  monitoring: {
    enabled: false,
    level: 'off',
    exempted: false,
    visible_to_main_agent: false,
    mutable_by_main_agent: false,
    default_enabled: true,
    is_main_agent_default_workflow: false,
    status_label: 'off',
    store_run_summaries: false,
    store_failure_summaries: false,
    allow_improvement_proposals: false,
    allow_evaluation_agent_review: false,
    allow_self_monitoring: false,
    safe_to_summarize: false,
    route_improvement_proposals_to_approval: false,
    controls: {
      enabled: false,
      level: 'off',
      store_run_summaries: false,
      store_failure_summaries: false,
      allow_improvement_proposals: false,
      allow_evaluation_agent_review: false,
      allow_self_monitoring: false,
      safe_to_summarize: false,
      route_improvement_proposals_to_approval: false,
    },
  },
  runtime_governance: {
    workflow_id: 'workflow-1',
    token_budget: {
      configured: true,
      run_total_tokens: 100000,
      workflow_total_tokens: null,
      agent_total_tokens: null,
      warn_ratio: 0.8,
      hard_ratio: 1,
      action: 'compact_context',
    },
    context_compaction: {
      enabled: true,
      persist_context_pack: false,
      persist_context_pack_source: 'workflow',
      preserve_recent_messages: 3,
      oversized_message_tokens: 600,
      min_estimated_tokens_saved: 50,
      max_summary_chars: 5000,
    },
  },
};

describe('workflow export packages', () => {
  it('exports workflow definitions with model and tool dependency metadata', () => {
    const pkg = buildWorkflowExportPackage(workflow, {
      exportedAt: '2026-05-21T00:00:00.000Z',
      availableTools: [
        {
          id: 'catalog.browser',
          name: 'browser.open',
          display_name: 'Open Browser',
          description: 'Opens a browser page.',
          tool_type: 'catalog',
        },
      ],
    });

    expect(pkg.schemaVersion).toBe(workflowExportSchemaVersion);
    expect(pkg.exportedAt).toBe('2026-05-21T00:00:00.000Z');
    expect(pkg.workflow).toMatchObject({
      id: workflow.id,
      name: workflow.name,
      agent_definitions: workflow.agent_definitions,
      task_definitions: workflow.task_definitions,
    });
    expect(pkg.workflow.monitoring).toBeUndefined();
    expect(pkg.workflow.runtime_governance).toBeUndefined();
    expect(pkg.dependencies.modelProfiles).toEqual([
      {
        id: 'profile-1',
        status: 'referenced',
      },
    ]);
    expect(pkg.dependencies.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'custom-search',
          source: 'workflow',
          implementation: expect.objectContaining({
            code: 'def run(input): return input',
          }),
        }),
        expect.objectContaining({
          id: 'catalog.browser',
          source: 'available',
          name: 'browser.open',
        }),
        expect.objectContaining({
          id: 'missing-tool',
          source: 'reference',
          status: 'missing',
        }),
      ])
    );
    expect(pkg.importNotes).toEqual(
      expect.arrayContaining([
        'Model profile "profile-1" must be mapped locally during import.',
        'Catalog tool "catalog.browser" was exported as metadata and may need local mapping.',
        'Tool "missing-tool" was not found locally and was exported as a reference only.',
      ])
    );
  });

  it('round-trips the export package JSON and normalizes unavailable import references', () => {
    const pkg = buildWorkflowExportPackage(workflow, {
      availableTools: [
        {
          id: 'catalog.browser',
          name: 'browser.open',
          description: 'Opens a browser page.',
        },
      ],
    });
    const parsed = parseWorkflowExportPackageJson(stringifyWorkflowExportPackage(pkg));

    const imported = createWorkflowDefinitionFromExportPackage(parsed, {
      importedWorkflowId: 'imported-workflow',
      availableTools: [
        {
          id: 'catalog.browser',
          name: 'browser.open',
          description: 'Opens a browser page.',
        },
      ],
    });

    expect(imported.id).toBe('imported-workflow');
    expect(imported.agent_definitions?.[0]?.model_profile_id).toBeNull();
    expect(imported.agent_definitions?.[0]?.tool_ids).toEqual(['custom-search', 'catalog.browser']);
    expect(imported.task_definitions?.[0]?.tool_ids).toEqual(['custom-search']);
    expect(imported.tool_definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'custom-search',
          implementation: expect.objectContaining({
            runtime: 'python',
          }),
        }),
      ])
    );
  });

  it('applies explicit model and tool mappings during import', () => {
    const pkg = buildWorkflowExportPackage(workflow);

    const imported = createWorkflowDefinitionFromExportPackage(pkg, {
      availableModelProfiles: [
        {
          id: 'local-profile',
          name: 'Local Profile',
          provider: 'openai',
          model: 'gpt-test',
        },
      ],
      availableTools: [
        {
          id: 'local-browser',
          name: 'browser.open',
          description: 'Local browser tool.',
        },
      ],
      modelProfileMappings: {
        'profile-1': 'local-profile',
      },
      toolMappings: {
        'catalog.browser': 'local-browser',
        'missing-tool': '',
      },
    });

    expect(imported.agent_definitions?.[0]).toMatchObject({
      model_profile_id: 'local-profile',
      tool_ids: ['custom-search', 'local-browser'],
    });
  });

  it('uses workflow-specific export filenames', () => {
    expect(workflowExportFileName(workflow)).toBe('market-research-workflow.workflow.json');
  });
});
