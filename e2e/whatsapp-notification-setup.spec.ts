import {expect, test} from '@playwright/test';

for (const mode of ['personal', 'business'] as const) {
  test(`sets up ${mode} WhatsApp and enables verified alerts`, async ({page}) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    // Keep unrelated application-shell services out of this isolated setup fixture.
    for (const path of [
      '/api/backend-users/sync',
      '/api/capabilities',
      '/api/smart-home/entities',
      '/api/physical-events/health',
      '/backend/conversations/main-agent-profile',
    ]) {
      await page.route(`**${path}`, (route) =>
        route.fulfill({
          json: {items: [], capabilities: [], available: false, profile: null, ok: true},
        })
      );
    }

    let state = 'not_linked';
    const id = 'whatsapp-ui-' + mode;
    const item = {
      id,
      provider: mode === 'personal' ? 'whatsapp-personal' : 'whatsapp-cloud-api',
      name: 'WhatsApp ' + mode,
      status: 'active',
      metadata: {},
    };
    const status = () => ({
      mode,
      installation_id: id,
      connection_status: 'active',
      account_connected: true,
      linking: {status: state},
      webhook_verified: state !== 'not_linked',
    });
    await page.route('**/api/backend-connectors/installations', (route) =>
      route.fulfill({json: {items: [item]}})
    );
    await page.route(`**/api/backend-connectors/installations/${id}/whatsapp-setup`, (route) =>
      route.fulfill({json: status()})
    );
    await page.route(
      `**/api/backend-connectors/installations/${id}/whatsapp-setup/*`,
      async (route) => {
        const action = route.request().url().split('/').pop();
        if (action === 'enable') {
          expect(state).toBe('verified');
          state = 'enabled';
        } else state = 'waiting';
        await route.fulfill({
          json: {
            ...status(),
            ...(mode === 'business'
              ? {
                link_url: 'https://wa.me/6580000000?text=AGENCYLINK_fixture',
                webhook_url: 'https://agency.example/webhook',
                webhook_verify_token: 'fixture-token',
              }
              : {}),
          },
        });
      }
    );
    await page.route('**/api/main-agent/monitor', (route) =>
      route.fulfill({
        json: {
          settings: {enabled: true},
          summary: {},
          runtime: {},
          notification_route: {},
          workflows: [],
          pending_approvals: [],
          repo_write_requests: [],
          findings: [],
          proposals: [],
          steering_requests: [],
        },
      })
    );
    await page.route('**/api/backend-credentials', (route) =>
      route.fulfill({json: {items: []}})
    );
    await page.goto('/login?callbackUrl=%2Foperations%2Fmain-agent-monitor');
    await page
      .getByLabel('Email')
      .fill(process.env.E2E_DEV_AUTH_EMAIL ?? process.env.DEV_AUTH_EMAIL ?? 'dev@example.com');
    await page
      .getByLabel('Password')
      .fill(process.env.E2E_DEV_AUTH_PASSWORD ?? process.env.DEV_AUTH_PASSWORD ?? 'change-me');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await page.waitForURL('**/operations/main-agent-monitor', {timeout: 60000});
    await expect(page).toHaveTitle(/Open Agency/);

    const panel = page.getByRole('region', {name: 'WhatsApp notifications'});
    await expect(
      panel.getByRole('heading', {name: 'Connect WhatsApp notifications'})
    ).toBeVisible();
    expect(await panel.getByRole('textbox').count()).toBe(0);
    await panel
      .getByRole('button', {
        name:
          mode === 'personal'
            ? 'Send confirmation test to myself'
            : 'Prepare Business WhatsApp link',
      })
      .click();
    if (mode === 'business') {
      await expect(
        panel.getByRole('link', {name: 'Open WhatsApp and send the linking message'})
      ).toHaveAttribute('href', 'https://wa.me/6580000000?text=AGENCYLINK_fixture');
      await expect(panel.getByRole('button', {name: 'Copy verification token'})).toBeVisible();
    } else await expect(panel.getByText(/reply with the CONFIRM code/)).toBeVisible();
    await expect(panel.getByRole('button', {name: 'Enable WhatsApp alerts'})).toHaveCount(0);
    state = 'verified';
    await expect(panel.getByRole('button', {name: 'Enable WhatsApp alerts'})).toBeVisible();
    await panel.screenshot({path: `test-results/whatsapp-${mode}-desktop.png`});
    await page.setViewportSize({width: 390, height: 844});
    await panel.screenshot({path: `test-results/whatsapp-${mode}-mobile.png`});
    await panel.getByRole('button', {name: 'Enable WhatsApp alerts'}).click();
    await expect(panel.getByText(/WhatsApp alerts enabled/)).toBeVisible();
    expect(errors).toEqual([]);
  });
}
