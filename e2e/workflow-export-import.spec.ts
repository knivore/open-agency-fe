import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

const frontendBaseUrl = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3000';
const backendBaseUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:8000';
const devAuthUserId =
  process.env.E2E_DEV_AUTH_USER_ID ?? process.env.DEV_AUTH_USER_ID ?? 'dev-user';
const devAuthEmail =
  process.env.E2E_DEV_AUTH_EMAIL ?? process.env.DEV_AUTH_EMAIL ?? 'dev@example.com';
const devAuthPassword =
  process.env.E2E_DEV_AUTH_PASSWORD ?? process.env.DEV_AUTH_PASSWORD ?? 'change-me';

function workflowPayload(workflowId: string, workflowName: string) {
  return {
    id: workflowId,
    name: workflowName,
    description: 'Workflow export/import round trip fixture.',
    entrypoint: 'node-task-a',
    nodes: [
      {
        id: 'node-task-a',
        name: 'Research',
        node_type: 'task',
        task_id: 'task-a',
        agent_id: 'agent-a',
        metadata: {
          position: { x: 280, y: 160 },
        },
      },
      {
        id: 'node-task-b',
        name: 'Summarize',
        node_type: 'task',
        task_id: 'task-b',
        agent_id: 'agent-a',
        metadata: {
          position: { x: 680, y: 160 },
        },
      },
    ],
    edges: [
      {
        id: 'edge-node-task-a-node-task-b',
        source_node_id: 'node-task-a',
        target_node_id: 'node-task-b',
        edge_type: 'default',
        condition: 'research complete',
        metadata: {
          route: 'happy-path',
        },
      },
    ],
    agent_definitions: [
      {
        id: 'agent-a',
        name: 'Round Trip Agent',
        description: 'Owns the e2e round trip tasks.',
        role: 'Research and summarize',
        model_profile_id: 'missing-model-profile-e2e',
        tool_ids: ['custom-tool-e2e', 'missing-tool-e2e'],
      },
    ],
    task_definitions: [
      {
        id: 'task-a',
        name: 'Research',
        description: 'Collect evidence.',
        instructions: 'Find the relevant evidence.',
        expected_output: 'Evidence notes.',
        agent_id: 'agent-a',
        tool_ids: ['custom-tool-e2e'],
        depends_on_task_ids: [],
        human_approval_required: false,
      },
      {
        id: 'task-b',
        name: 'Summarize',
        description: 'Summarize evidence.',
        instructions: 'Use only collected evidence.',
        expected_output: 'A concise summary.',
        agent_id: 'agent-a',
        tool_ids: [],
        depends_on_task_ids: ['task-a'],
        human_approval_required: true,
      },
    ],
    tool_definitions: [
      {
        id: 'custom-tool-e2e',
        name: 'custom.e2e',
        display_name: 'Custom E2E Tool',
        description: 'A custom tool included in workflow exports.',
        tool_type: 'python_function',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
        },
        output_schema: {
          type: 'object',
          properties: {
            result: { type: 'string' },
          },
        },
        implementation: {
          implementation_type: 'python',
          target: 'e2e.tools.custom_e2e',
          entrypoint: 'run',
        },
      },
    ],
    allowed_runtime_adapter_ids: ['native'],
    default_runtime_adapter_id: 'native',
    versioning: {
      version: '1.0.0',
      revision: 1,
      labels: ['draft'],
    },
    metadata: {
      inputs: ['topic'],
      process: 'sequential',
      created_from: 'workflow-export-import-e2e',
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

test.describe('workflow export/import', () => {
  test('round-trips an exported workflow package through the workflows page importer', async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const workflowId = `workflow-export-import-e2e-${uniqueId}`;
    const workflowName = `Export Import E2E ${uniqueId}`;
    let importedWorkflowId: string | null = null;
    let createdFixture = false;

    try {
      await login(page);
      const createResult = await page.evaluate(
        async (payload) => {
          const response = await fetch('/api/workflows', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });

          return {
            ok: response.ok,
            status: response.status,
            text: await response.text(),
          };
        },
        workflowPayload(workflowId, workflowName)
      );
      expect(createResult.ok, createResult.text).toBe(true);
      createdFixture = true;

      await page.goto(`${frontendBaseUrl}/workflows/${workflowId}?tab=graph`);
      await expect(page.getByRole('heading', { name: workflowName })).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'More workflow actions' }).click();
      await page.getByRole('menuitem', { name: 'Export Workflow' }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(
        `${workflowName.toLowerCase().replaceAll(' ', '-')}.workflow.json`
      );

      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();
      const packageJson = JSON.parse(await fs.readFile(downloadPath as string, 'utf8'));
      expect(packageJson.schemaVersion).toBe('agency.workflow.export.v1');
      expect(packageJson.workflow.name).toBe(workflowName);
      expect(packageJson.dependencies.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'custom-tool-e2e',
            implementation: expect.objectContaining({
              implementation_type: 'python',
              target: 'e2e.tools.custom_e2e',
            }),
          }),
          expect.objectContaining({
            id: 'missing-tool-e2e',
            status: 'missing',
          }),
        ])
      );
      expect(packageJson.importNotes).toEqual(
        expect.arrayContaining([
          'Model profile "missing-model-profile-e2e" must be mapped locally during import.',
          'Tool "missing-tool-e2e" was not found locally and was exported as a reference only.',
        ])
      );

      await page.goto(`${frontendBaseUrl}/workflows`);
      await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();
      const importWorkflowButton = page.getByRole('button', {
        name: 'Import workflow',
        exact: true,
      });
      await expect(importWorkflowButton).toBeVisible();
      await importWorkflowButton.click();
      const importDialog = page.getByRole('dialog', { name: 'Import workflow' });
      if (!(await importDialog.isVisible())) {
        await page.evaluate(() => {
          const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
            candidate.textContent?.includes('Import workflow')
          );
          button?.click();
        });
      }
      await expect(importDialog).toBeVisible();
      await importDialog.locator('input[type="file"]').setInputFiles(downloadPath as string);
      await expect(importDialog.getByText(workflowName)).toBeVisible();
      await expect(importDialog.getByText('2 tasks')).toBeVisible();
      await expect(importDialog.getByText('2 tool references')).toBeVisible();
      await expect(
        importDialog.getByLabel('Map model profile missing-model-profile-e2e')
      ).toBeVisible();
      await expect(importDialog.getByLabel('Map tool missing-tool-e2e')).toBeVisible();
      await expect(importDialog.getByText('Custom tool will import')).toBeVisible();
      await expect(
        importDialog.getByText('some references need action after import')
      ).toBeVisible();
      const importResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/workflows') && response.request().method() === 'POST',
        { timeout: 10_000 }
      );
      await importDialog.getByRole('button', { name: 'Import workflow' }).click();
      const importResponse = await importResponsePromise;
      expect(importResponse.ok(), await importResponse.text()).toBe(true);

      await page.waitForURL('**/workflows/**', { timeout: 10_000 });
      importedWorkflowId = new URL(page.url()).pathname.split('/').pop() ?? null;
      expect(importedWorkflowId).toBeTruthy();
      expect(importedWorkflowId).not.toBe(workflowId);

      await expect(page.getByRole('heading', { name: workflowName })).toBeVisible();
      await expect(page.getByText('Import needs review')).toBeVisible();
      await expect(
        page.getByText('Model profile "missing-model-profile-e2e" was not found')
      ).toBeVisible();
      await expect(page.getByText('Tool "missing-tool-e2e" was not found')).toBeVisible();
      await page.getByRole('tab', { name: 'Graph' }).click();
      const graphPanel = page.getByRole('tabpanel', { name: 'Graph' });
      await expect(graphPanel.getByText('Round Trip Agent').first()).toBeVisible();
      await expect(graphPanel.getByText('No model selected').first()).toBeVisible();
      await expect(graphPanel.getByText('1 tool').first()).toBeVisible();
      await expect(graphPanel.getByText('Research').first()).toBeVisible();
      await expect(graphPanel.getByText('Summarize').first()).toBeVisible();
    } finally {
      if (createdFixture || importedWorkflowId) {
        const headers = {
          'x-agency-user-id': devAuthUserId,
          'x-agency-user-email': devAuthEmail,
          'x-agency-user-name':
            process.env.E2E_DEV_AUTH_NAME ?? process.env.DEV_AUTH_NAME ?? 'Dev User',
          'x-agency-auth-provider': 'dev-auth',
          'x-agency-provider-subject': devAuthUserId,
          'x-agency-provider-account-id': devAuthEmail,
        };
        await Promise.all(
          [createdFixture ? workflowId : null, importedWorkflowId]
            .flatMap((id) => (id ? [id] : []))
            .map((id) => request.delete(`${backendBaseUrl}/workflows/${id}`, { headers }))
        );
      }
    }
  });
});
