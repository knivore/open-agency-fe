import { describe, expect, it } from 'vitest';

import { observatoryRuntimeDemoFixtures } from '@/modules/observatory/runtime/demoFixtures';

const activeStatuses = new Set([
  'created',
  'queued',
  'running',
  'waiting_for_approval',
  'paused',
  'cancelling',
]);

describe('observatory pixel runtime demo fixtures', () => {
  it('provide active visual contexts with agents, events, and logs', () => {
    expect(observatoryRuntimeDemoFixtures.length).toBeGreaterThanOrEqual(2);

    observatoryRuntimeDemoFixtures.forEach((fixture) => {
      expect(fixture.agents.length).toBeGreaterThan(0);
      expect(fixture.runtimeContext.length).toBeGreaterThan(0);

      fixture.runtimeContext.forEach((context) => {
        expect(activeStatuses.has(context.run.status)).toBe(true);
        expect(context.workflow.agent_definitions?.length).toBeGreaterThan(0);
        expect(context.events.length).toBeGreaterThan(0);
        expect(context.logs.length).toBeGreaterThan(0);
      });
    });
  });

  it('includes an overflow fixture large enough to require generated floors', () => {
    const overflowFixture = observatoryRuntimeDemoFixtures.find(
      (fixture) => fixture.id === 'overflow-load'
    );

    expect(overflowFixture?.runtimeContext.length).toBeGreaterThanOrEqual(10);
    expect(
      new Set(overflowFixture?.runtimeContext.map((context) => context.run.workflowId)).size
    ).toBe(overflowFixture?.runtimeContext.length);
  });
});
