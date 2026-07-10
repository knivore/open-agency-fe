import { expect, test, type Page } from '@playwright/test';

const frontendBaseUrl = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3000';
const backendBaseUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:8000';
const devAuthUserId =
  process.env.E2E_DEV_AUTH_USER_ID ?? process.env.DEV_AUTH_USER_ID ?? 'dev-user';
const devAuthEmail =
  process.env.E2E_DEV_AUTH_EMAIL ?? process.env.DEV_AUTH_EMAIL ?? 'dev@example.com';
const devAuthPassword =
  process.env.E2E_DEV_AUTH_PASSWORD ?? process.env.DEV_AUTH_PASSWORD ?? 'change-me';

function devAuthHeaders() {
  return {
    'x-agency-user-id': devAuthUserId,
    'x-agency-user-email': devAuthEmail,
    'x-agency-user-name': process.env.E2E_DEV_AUTH_NAME ?? process.env.DEV_AUTH_NAME ?? 'Dev User',
    'x-agency-auth-provider': 'dev-auth',
    'x-agency-provider-subject': devAuthUserId,
    'x-agency-provider-account-id': devAuthEmail,
  };
}

function workflowPayload(workflowId: string, workflowName: string) {
  return {
    id: workflowId,
    name: workflowName,
    description: 'Runtime graph visualization fixture.',
    entrypoint: 'node-task-a',
    nodes: [
      {
        id: 'node-task-a',
        name: 'Prepare data',
        node_type: 'task',
        task_id: 'task-a',
        agent_id: 'agent-a',
        metadata: {
          position: { x: 220, y: 160 },
        },
      },
      {
        id: 'node-task-b',
        name: 'Review result',
        node_type: 'task',
        task_id: 'task-b',
        agent_id: 'agent-a',
        metadata: {
          position: { x: 620, y: 160 },
        },
      },
    ],
    edges: [
      {
        id: 'edge-node-task-a-node-task-b',
        source_node_id: 'node-task-a',
        target_node_id: 'node-task-b',
        edge_type: 'default',
        condition: null,
        metadata: {},
      },
    ],
    agent_definitions: [
      {
        id: 'agent-a',
        name: 'Runtime Agent',
        description: 'Processes runtime data.',
        role: 'Processes runtime data',
        model_profile_id: null,
        tool_ids: [],
      },
    ],
    task_definitions: [
      {
        id: 'task-a',
        name: 'Prepare data',
        description: 'Prepare the input package.',
        instructions: 'Prepare input.',
        expected_output: 'Prepared input.',
        agent_id: 'agent-a',
        tool_ids: [],
        depends_on_task_ids: [],
        human_approval_required: false,
      },
      {
        id: 'task-b',
        name: 'Review result',
        description: 'Review the prepared result.',
        instructions: 'Review result.',
        expected_output: 'Review notes.',
        agent_id: 'agent-a',
        tool_ids: [],
        depends_on_task_ids: ['task-a'],
        human_approval_required: false,
      },
    ],
    tool_definitions: [],
    allowed_runtime_adapter_ids: ['native'],
    default_runtime_adapter_id: 'native',
    metadata: {
      created_from: 'workflow-runtime-graph-e2e',
    },
  };
}

async function login(page: Page) {
  await page.goto(`${frontendBaseUrl}/login?callbackUrl=${encodeURIComponent('/workflows')}`);

  if (await page.getByRole('heading', { name: 'Sign in' }).isVisible()) {
    await page.getByLabel('Email').fill(devAuthEmail);
    await page.getByLabel('Password').fill(devAuthPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/workflows');
  }
}

test.describe('workflow graph runtime overlay', () => {
  test('renders persisted workflow run activity on the real graph tab', async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const workflowId = `workflow-runtime-graph-e2e-${uniqueId}`;
    const workflowName = `Runtime Graph E2E ${uniqueId}`;
    const workflow = workflowPayload(workflowId, workflowName);
    const headers = devAuthHeaders();
    let createdFixture = false;

    try {
      await login(page);

      const createWorkflowResponse = await request.post(`${backendBaseUrl}/workflows`, {
        headers,
        data: workflow,
      });
      expect(createWorkflowResponse.ok(), await createWorkflowResponse.text()).toBe(true);
      createdFixture = true;

      const createExecutionResponse = await request.post(`${backendBaseUrl}/executions`, {
        headers,
        data: {
          workflowId,
          input: { inputs: {} },
          trigger: { type: 'manual', requested_by: devAuthUserId },
          runtime_adapter_id: 'native',
          workflow_definition: workflow,
        },
      });
      expect(createExecutionResponse.ok(), await createExecutionResponse.text()).toBe(true);
      const execution = await createExecutionResponse.json();
      const executionTimestamp =
        execution.started_at ??
        execution.created_at ??
        execution.updated_at ??
        execution.completed_at;
      const executionDateTime = new Intl.DateTimeFormat('en-SG', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(executionTimestamp));

      await page.goto(`${frontendBaseUrl}/workflows/${workflowId}?tab=graph`);
      await expect(page.getByRole('heading', { name: workflowName })).toBeVisible();
      // The timeline toolbar renders alongside the graph canvas instead of inside the old tabpanel
      // boundary, and the runtime panel may already be open if the page restores state.
      await expect(page.getByRole('button', { name: /graph execution timeline/i })).toBeVisible();
      const showTimelineButton = page.getByRole('button', {
        name: 'Show graph execution timeline',
      });
      if (await showTimelineButton.count()) {
        await showTimelineButton.click();
      }
      await expect(
        page.getByRole('button', { name: 'Hide graph execution timeline' })
      ).toBeVisible();
      await expect(page.getByText('Execution timeline')).toBeVisible();
      await expect(page.getByLabel('Runtime run filter')).toBeVisible();
      await expect(page.getByLabel('Runtime event type filter')).toBeVisible();
      await expect(page.getByLabel('Hide projected runtime events')).toBeVisible();
      await expect(page.getByLabel('Graph runtime timeline')).toBeVisible();
      await expect(page.getByText(/Live · \d+ events?/)).toBeVisible();
      await expect(page.getByText('Run created')).toBeVisible();
      await page.getByLabel('Runtime event type filter').selectOption('Status');
      await expect(page.getByRole('button', { name: /execution\.created/ })).toBeVisible();
      await page.getByLabel('Runtime event type filter').selectOption('Error');
      await expect(page.getByText('Run created')).toBeVisible();
      await expect(page.getByText(`Run ${executionDateTime}`)).toBeVisible();
      await expect(page.getByText(`runId: ${execution.id}`)).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Open run' })).toHaveAttribute(
        'href',
        `/runs/${execution.id}?workflowId=${workflowId}&tab=runs`
      );

      await page.locator('.react-flow__node').filter({ hasText: 'Prepare data' }).click();
      await expect(page.getByRole('heading', { name: 'Selected Task' })).toBeVisible();
      await expect(page.getByLabel('Selected Task')).toContainText('Prepare the input package.');
      await page.getByLabel('Close selected graph drawer').click();
      await expect(page.getByLabel('Selected Task')).toBeHidden();

      await page.getByTestId('rf__node-workflow-agent-agent-a').click();
      await expect(page.getByLabel('Selected Agent')).toContainText('Runtime Agent');
      await expect(page.getByLabel('Selected Agent')).toContainText('Processes runtime data.');
      await expect(page.getByLabel('Selected Agent')).toContainText(
        'Switch to edit mode to modify this agent.'
      );

      await page.getByLabel('Close selected graph drawer').click();
      await expect(page.getByLabel('Selected Agent')).toBeHidden();
      await page.getByRole('button', { name: 'Dependency' }).click();
      await expect(page.getByLabel('Selected Edge')).toContainText('Prepare data -> Review result');
      await expect(page.getByLabel('Selected Edge')).toContainText(
        'Switch to edit mode to modify this connection.'
      );
      await page.getByLabel('Close selected graph drawer').click();
      await expect(page.getByLabel('Selected Edge')).toBeHidden();
    } finally {
      if (createdFixture) {
        await request.delete(`${backendBaseUrl}/workflows/${workflowId}`, { headers });
      }
    }
  });
});
