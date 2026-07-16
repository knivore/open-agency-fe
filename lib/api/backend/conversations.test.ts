import { describe, expect, it } from 'vitest';
import { conversationsApi } from './conversations';

describe('conversation API helpers', () => {
  it('uses the authenticated same-origin BFF for conversation streams', () => {
    expect(conversationsApi.getStreamUrl('conversation/one', 'message-1')).toBe(
      '/api/conversations/conversation%2Fone/stream?after=message-1'
    );
  });
});
