import { expect, test } from '@playwright/test';

const frontendBaseUrl = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3000';
const backendBaseUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:8000';
const devAuthEmail = process.env.E2E_DEV_AUTH_EMAIL ?? process.env.DEV_AUTH_EMAIL ?? 'dev@example.com';
const devAuthPassword = process.env.E2E_DEV_AUTH_PASSWORD ?? process.env.DEV_AUTH_PASSWORD ?? 'change-me';
const activeConversationStorageKey = 'agency.active_conversation_id';

function workflowPayload(workflowId: string, workflowName: string) {
  return {
    id: workflowId,
    name: workflowName,
    description: 'Protected workflow smoke test fixture.',
    entrypoint: 'manual',
    nodes: [],
    edges: [],
    task_definitions: [],
    agent_definitions: [],
    tool_definitions: [],
    allowed_runtime_adapter_ids: ['native'],
    default_runtime_adapter_id: 'native',
    metadata: {
      visible_to_main_agent: true,
      protected_execution: true,
    },
  };
}

test.describe('workflow-builder protected execution', () => {
  test('approves a protected workflow and renders execution lifecycle messages', async ({ page, request }) => {
    const workflowId = `workflow-protected-e2e-${Date.now()}`;
    const workflowName = `Protected E2E Workflow ${Date.now()}`;

    await request.post(`${backendBaseUrl}/workflows`, {
      data: workflowPayload(workflowId, workflowName),
    });

    await page.goto(
      `${frontendBaseUrl}/login?callbackUrl=${encodeURIComponent('/workflow-builder')}`
    );

    if (await page.getByRole('heading', { name: 'Sign in' }).isVisible()) {
      await page.getByLabel('Email').fill(devAuthEmail);
      await page.getByLabel('Password').fill(devAuthPassword);
      await page.getByRole('button', { name: 'Sign in' }).click();
    }

    await page.goto(`${frontendBaseUrl}/workflow-builder`);
    await expect(page.getByRole('heading', { name: 'Main Agent Chat' })).toBeVisible();

    const initialMessage = `Protected execution smoke setup ${Date.now()}`;
    await page.getByPlaceholder('Message the main agent').fill(initialMessage);
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText(initialMessage)).toBeVisible();
    await expect(page.getByText(`I received your message: ${initialMessage}`)).toBeVisible();

    await page.waitForFunction((storageKey) => window.localStorage.getItem(storageKey), activeConversationStorageKey);
    const conversationId = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), activeConversationStorageKey);
    expect(conversationId).toBeTruthy();

    const executionPrompt = `Run protected workflow ${workflowName}`;
    const inject = await request.post(`${backendBaseUrl}/conversations/${conversationId}/messages`, {
      data: {
        message: {
          role: 'user',
          message_type: 'user_text',
          plain_text: executionPrompt,
          content: {
            text: executionPrompt,
            execution_request: {
              workflow_id: workflowId,
            },
          },
        },
        response_mode: 'sync',
      },
    });

    expect(inject.ok()).toBeTruthy();

    const approvalSummary = `Run protected workflow '${workflowName}'.`;
    await expect(page.getByText(approvalSummary)).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();

    await expect(page.getByText(`Approval granted: ${approvalSummary}`)).toBeVisible();
    await expect(page.getByText(`Started workflow '${workflowName}'.`)).toBeVisible();
    await expect(page.getByText(`Workflow '${workflowName}' completed.`)).toBeVisible();

    await request.delete(`${backendBaseUrl}/workflows/${workflowId}`);
  });
});
