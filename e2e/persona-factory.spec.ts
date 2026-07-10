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

async function apiStep<T>(label: string, action: () => Promise<T>) {
  return test.step(label, action);
}

async function login(page: Page) {
  await page.goto(`${frontendBaseUrl}/login?callbackUrl=${encodeURIComponent('/persona')}`);

  if (await page.getByRole('heading', { name: 'Sign in' }).isVisible()) {
    await page.getByLabel('Email').fill(devAuthEmail);
    await page.getByLabel('Password').fill(devAuthPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect
      .poll(async () => {
        const session = await page.request.get(`${frontendBaseUrl}/api/auth/session`);
        const payload = await session.json().catch(() => null);
        return Boolean(payload?.user?.email);
      })
      .toBe(true);
  }

  await page.goto(`${frontendBaseUrl}/persona`);
  await expect(page.getByRole('heading', { name: 'Persona Factory' })).toBeVisible();
}

test.describe('persona factory', () => {
  test('distills, corrects, re-distills, publishes, and exposes runtime test controls', async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);
    const uniqueId = Date.now();
    const headers = devAuthHeaders();
    const memoryId = `persona-factory-e2e-memory-${uniqueId}`;
    const filename = `release-persona-e2e-${uniqueId}.md`;
    const personaName = `Persona Factory E2E ${uniqueId}`;
    let personaId: string | null = null;
    let runId: string | null = null;

    try {
      await apiStep('sync user', () =>
        request.post(`${backendBaseUrl}/users/sync`, {
          data: {
            id: devAuthUserId,
            email: devAuthEmail,
            display_name: 'Dev User',
          },
        })
      );
      const memoryResponse = await apiStep('create source memory', () =>
        request.post(`${backendBaseUrl}/memories`, {
          headers,
          data: {
            memory: {
              id: memoryId,
              scope: 'user',
              content:
                'Release SOP requires approval evidence before deployment. If test evidence is missing, escalate to the release owner. Teams must not bypass the change approval record.',
              summary: 'Release approval source',
              memory_type: 'archive',
              tags: ['persona-source', 'release'],
              importance: 80,
              metadata: {
                document_id: `doc-${memoryId}`,
                filename,
                upload_intelligence: {
                  source: 'e2e',
                  document_kind: 'policy_sop',
                  confidence: 0.9,
                  recommended: { tags: ['release', 'approval'] },
                },
              },
            },
          },
        })
      );
      expect(memoryResponse.ok(), await memoryResponse.text()).toBe(true);

      await login(page);
      await expect(page.getByRole('heading', { name: 'Start a persona' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Personas' })).toBeVisible();

      await page.getByRole('button', { name: 'New Persona' }).click();
      await page.getByLabel('Name').fill(personaName);
      await page.getByText(filename).click();
      await page.getByRole('button', { name: /Generate draft/i }).click();

      await expect(page.getByRole('heading', { name: 'Review extracted items' })).toBeVisible({
        timeout: 30000,
      });
      const createdPersonaResponse = await apiStep('lookup created persona', () =>
        request.get(`${backendBaseUrl}/persona`, { headers, timeout: 10000 })
      );
      expect(createdPersonaResponse.ok(), await createdPersonaResponse.text()).toBe(true);
      const createdPersonas = await createdPersonaResponse.json();
      personaId =
        createdPersonas.items.find((persona: { name?: string }) => persona.name === personaName)
          ?.id ?? null;
      expect(personaId).toBeTruthy();
      const runResponse = await apiStep('lookup distillation run', () =>
        request.get(`${backendBaseUrl}/persona-factory/runs?persona_id=${personaId}`, {
          headers,
          timeout: 10000,
        })
      );
      expect(runResponse.ok(), await runResponse.text()).toBe(true);
      const runs = await runResponse.json();
      runId = runs.items[0]?.id ?? null;
      expect(runId).toBeTruthy();

      const sourceMapResponse = await apiStep('load source map', () =>
        request.get(`${backendBaseUrl}/persona-factory/runs/${runId}/source-map`, {
          headers,
          timeout: 10000,
        })
      );
      expect(sourceMapResponse.ok(), await sourceMapResponse.text()).toBe(true);
      const sourceMap = await sourceMapResponse.json();
      const sourceKey = sourceMap.items[0]?.key;
      expect(sourceKey).toBeTruthy();

      const correctionResponse = await apiStep('correct source classification', () =>
        request.patch(
          `${backendBaseUrl}/persona-factory/runs/${runId}/sources/${encodeURIComponent(
            sourceKey
          )}/classification`,
          {
            headers,
            data: {
              classification: 'workflow',
              document_kind: 'ticket',
              vector_tags: ['release', 'manual-flow'],
            },
            timeout: 10000,
          }
        )
      );
      expect(correctionResponse.ok(), await correctionResponse.text()).toBe(true);

      const redistillResponse = await apiStep('redistill corrected source', () =>
        request.post(
          `${backendBaseUrl}/persona-factory/runs/${runId}/sources/${encodeURIComponent(
            sourceKey
          )}/redistill`,
          { headers, data: { limit: 250 }, timeout: 10000 }
        )
      );
      expect(redistillResponse.ok(), await redistillResponse.text()).toBe(true);

      const bulkReviewResponse = await apiStep('bulk approve run items', () =>
        request.post(`${backendBaseUrl}/persona-factory/runs/${runId}/items/bulk-review`, {
          headers,
          data: { action: 'approve', filters: {}, limit: 250 },
          timeout: 10000,
        })
      );
      expect(bulkReviewResponse.ok(), await bulkReviewResponse.text()).toBe(true);

      const synthesizeResponse = await apiStep('synthesize package', () =>
        request.post(`${backendBaseUrl}/persona-factory/runs/${runId}/synthesize-package`, {
          headers,
          data: {},
          timeout: 10000,
        })
      );
      expect(synthesizeResponse.ok(), await synthesizeResponse.text()).toBe(true);

      const approveResponse = await apiStep('approve package', () =>
        request.post(`${backendBaseUrl}/persona-factory/runs/${runId}/approve`, {
          headers,
          data: {},
          timeout: 10000,
        })
      );
      expect(approveResponse.ok(), await approveResponse.text()).toBe(true);
      const publishResponse = await apiStep('publish persona', () =>
        request.post(`${backendBaseUrl}/persona-factory/runs/${runId}/publish`, {
          headers,
          data: {},
          timeout: 10000,
        })
      );
      expect(publishResponse.ok(), await publishResponse.text()).toBe(true);

      await expect
        .poll(async () => {
          const personaResponse = await request.get(`${backendBaseUrl}/persona`, { headers });
          expect(personaResponse.ok(), await personaResponse.text()).toBe(true);
          const personas = await personaResponse.json();
          const persona =
            personas.items.find((item: { name?: string }) => item.name === personaName) ?? null;
          personaId = persona?.id ?? personaId;
          return persona?.status ?? null;
        })
        .toBe('published');

      await page.goto(`${frontendBaseUrl}/persona`);
      await page.getByRole('button', { name: new RegExp(`Select ${personaName}`) }).click();
      await page.getByRole('tab', { name: '5. Use' }).click();
      await expect(page.getByRole('button', { name: /Invoke @/ })).toBeVisible();
    } finally {
      if (personaId) {
        await request.delete(`${backendBaseUrl}/persona/${personaId}`, { headers });
      }
      await request.delete(`${backendBaseUrl}/memories/${memoryId}`, { headers });
    }
  });
});
