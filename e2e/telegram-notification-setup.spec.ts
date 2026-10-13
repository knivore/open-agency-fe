import {expect, test} from '@playwright/test';

test('links Telegram, confirms the account, and enables notifications', async ({page}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`);
  });
  page.on('pageerror', (error) => errors.push(error.message));
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
  const bot = {
    id: 'telegram-ui-bot',
    provider: 'telegram-bot',
    name: 'Test bot',
    status: 'active',
    metadata: {},
  };
  await page.route('**/api/backend-connectors/installations', (route) =>
    route.fulfill({json: {items: [bot]}})
  );
  await page.route(
    '**/api/backend-connectors/installations/telegram-ui-bot/telegram-link',
    async (route) => {
      if (route.request().method() === 'POST') {
        state = 'waiting';
        await route.fulfill({
          json: {status: state, link_url: 'https://t.me/test_bot?start=agency_fixture'},
        });
      } else await route.fulfill({json: {status: state, display_name: 'telegram_test_user'}});
    }
  );
  await page.route(
    '**/api/backend-connectors/installations/telegram-ui-bot/telegram-link/enable',
    async (route) => {
      expect(state).toBe('verified');
      state = 'enabled';
      await route.fulfill({json: {status: state, display_name: 'telegram_test_user'}});
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
  await page.route('**/api/backend-credentials', (route) => route.fulfill({json: {items: []}}));
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
  const panel = page.getByRole('region', {name: 'Telegram notifications'});
  await expect(
    panel.getByRole('heading', {name: 'Connect Telegram notifications'})
  ).toBeVisible();
  await panel.getByRole('button', {name: 'Link my Telegram account'}).click();
  await expect(panel.getByRole('link', {name: 'Open Telegram'})).toHaveAttribute(
    'href',
    'https://t.me/test_bot?start=agency_fixture'
  );
  await expect(panel.getByRole('textbox')).toHaveCount(0);
  state = 'linked';
  await expect(panel.getByText(/Tap Confirm connection/)).toBeVisible();
  state = 'verified';
  await expect(panel.getByRole('button', {name: 'Enable approvals and alerts'})).toBeVisible();
  await panel.screenshot({path: 'test-results/telegram-verified-desktop.png'});
  await page.setViewportSize({width: 390, height: 844});
  await panel.screenshot({path: 'test-results/telegram-verified-mobile.png'});
  await panel.getByRole('button', {name: 'Enable approvals and alerts'}).click();
  await expect(panel.getByText(/Notifications enabled for telegram_test_user/)).toBeVisible();
  expect(errors).toEqual([]);
});
