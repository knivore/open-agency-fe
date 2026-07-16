import { describe, expect, it } from 'vitest';

import {
  createObservatorySourceRegistry,
  OBSERVATORY_POST_MESSAGE_SOURCE_ID,
} from '@/modules/observatory/integrations/sourceRegistry';

describe('Observatory source origin validation', () => {
  it('binds the self origin to the receiving application', () => {
    const registry = createObservatorySourceRegistry();

    expect(
      registry.validateSourceOrigin(
        OBSERVATORY_POST_MESSAGE_SOURCE_ID,
        'https://attacker.example',
        'https://agency.example'
      )
    ).toBe(false);
    expect(
      registry.validateSourceOrigin(
        OBSERVATORY_POST_MESSAGE_SOURCE_ID,
        'https://agency.example',
        'https://agency.example'
      )
    ).toBe(true);
  });
});
