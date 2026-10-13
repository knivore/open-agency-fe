import {describe, expect, it} from 'vitest';
import type {ApprovalRequest, ConversationMessage} from '@/types/conversations';
import {
  hasApprovalAfterCursor,
  hasTerminalAssistantTurnMessageAfterCursor
} from './conversationTurnState';

function user(id: string, at: string): ConversationMessage {
  return {id, conversation_id: 'chat', role: 'user', message_type: 'user_text', created_at: at};
}

function stop(origin: string, at: string): ConversationMessage {
  return {
    id: 'turn-stop:fixture',
    conversation_id: 'chat',
    role: 'system',
    message_type: 'system_note',
    created_at: at,
    metadata: {
      assistant_turn_control: 'stop_requested',
      origin_message_id: origin,
      turn_id: `turn:${origin}`
    }
  };
}

describe('persisted assistant turn control', () => {
  it('releases a stopped orphaned turn after reconnect without a final assistant reply', () => {
    const origin = user('origin', '2026-10-03T13:30:00Z');
    const tool: ConversationMessage = {
      id: 'result',
      conversation_id: 'chat',
      role: 'tool',
      message_type: 'tool_result',
      created_at: '2026-10-03T13:30:02Z'
    };
    const restored = [stop('origin', '2026-10-03T13:31:00Z'), tool, origin];
    expect(hasTerminalAssistantTurnMessageAfterCursor(restored, origin.id)).toBe(true);
    expect(restored[0].id).toBe('turn-stop:fixture'); // Sorting must not mutate restored state.
  });
  it('does not stop a new turn when an older turn receives a late Stop marker', () => {
    const restored = [user('old', '2026-10-03T13:30:00Z'), user('new', '2026-10-03T13:31:00Z'), stop('old', '2026-10-03T13:32:00Z')];
    expect(hasTerminalAssistantTurnMessageAfterCursor(restored, 'new')).toBe(false);
    expect(hasTerminalAssistantTurnMessageAfterCursor(restored, 'old')).toBe(true);
  });
  it('does not treat ordinary notes, mismatched scope or tool rows as authoritative Stop', () => {
    const origin = user('origin', '2026-10-03T13:30:00Z');
    for (const patch of [{id: 'ordinary-note'}, {conversation_id: 'other'}, {role: 'tool' as const},
      {
        metadata: {
          assistant_turn_control: 'stop_requested',
          origin_message_id: 'other',
          turn_id: 'turn:origin'
        }
      },
      {
        metadata: {
          assistant_turn_control: 'stop_requested',
          origin_message_id: 'origin',
          turn_id: 'turn:other'
        }
      }]) {
      expect(hasTerminalAssistantTurnMessageAfterCursor([origin, {...stop('origin', '2026-10-03T13:31:00Z'), ...patch}], 'origin')).toBe(false);
    }
  });
  it('retains normal completion and keeps a read-only tool result pending without Stop', () => {
    const origin = user('origin', '2026-10-03T13:30:00Z');
    const result: ConversationMessage = {
      id: 'reply',
      conversation_id: 'chat',
      role: 'tool',
      message_type: 'tool_result',
      created_at: '2026-10-03T13:31:00Z'
    };
    expect(hasTerminalAssistantTurnMessageAfterCursor([origin, result], 'origin')).toBe(false);
    expect(hasTerminalAssistantTurnMessageAfterCursor([origin, {
      ...result,
      role: 'assistant',
      message_type: 'assistant_text'
    }], 'origin')).toBe(true);
  });
});


function approval(patch: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: 'review',
    approval_type: 'tool_execute',
    status: 'pending',
    target_type: 'tool',
    requested_by_agent_id: 'main',
    conversation_id: 'chat',
    origin_message_id: 'origin',
    summary: 'Review',
    created_at: '2026-10-03T13:32:00Z',
    updated_at: '2026-10-03T13:32:00Z', ...patch
  } as ApprovalRequest;
}

describe('turn-scoped completion and approval recovery', () => {
  const origin = user('origin', '2026-10-03T13:30:00Z');
  const next = user('next', '2026-10-03T13:31:00Z');
  it('keeps a newer turn pending when an older scoped reply arrives late', () => {
    const late: ConversationMessage = {
      id: 'late',
      conversation_id: 'chat',
      role: 'assistant',
      message_type: 'assistant_text',
      created_at: '2026-10-03T13:32:00Z',
      metadata: {turn_id: 'turn:origin'}
    };
    expect(hasTerminalAssistantTurnMessageAfterCursor([origin, next, late], next.id)).toBe(false);
    expect(hasTerminalAssistantTurnMessageAfterCursor([origin, next, late], origin.id)).toBe(true);
    expect(hasTerminalAssistantTurnMessageAfterCursor([origin, next, {
      ...late,
      metadata: {turn_id: 'turn:next'}
    }], next.id)).toBe(true);
  });
  it('does not complete from foreign-conversation terminal rows', () => {
    const foreign: ConversationMessage = {
      id: 'foreign',
      conversation_id: 'other',
      role: 'assistant',
      message_type: 'assistant_text',
      created_at: '2026-10-03T13:32:00Z'
    };
    expect(hasTerminalAssistantTurnMessageAfterCursor([origin, foreign], origin.id)).toBe(false);
  });
  it('uses explicit approval turn identity even before its tool origin is streamed', () => {
    const review = approval({origin_message_id: 'unloaded-tool', metadata: {turn_id: 'turn:next'}});
    expect(hasApprovalAfterCursor([origin, next], [review], next.id)).toBe(true);
    expect(hasApprovalAfterCursor([origin, next], [review], origin.id)).toBe(false);
    expect(hasApprovalAfterCursor([origin, next], [{
      ...review,
      conversation_id: 'other'
    }], next.id)).toBe(false);
  });
  it('does not infer approval ownership from a newer creation timestamp', () => {
    expect(hasApprovalAfterCursor([origin, next], [approval({origin_message_id: 'unknown-tool'})], next.id)).toBe(false);
    expect(hasApprovalAfterCursor([origin, next], [approval({metadata: {turn_id: 'turn:origin'}})], next.id)).toBe(false);
  });
  it('traces legacy approval origins to the correct preceding user turn', () => {
    const tool: ConversationMessage = {
      id: 'old-tool',
      conversation_id: 'chat',
      role: 'tool',
      message_type: 'tool_call',
      created_at: '2026-10-03T13:30:30Z'
    };
    const review = approval({origin_message_id: tool.id});
    expect(hasApprovalAfterCursor([origin, tool, next], [review], origin.id)).toBe(true);
    expect(hasApprovalAfterCursor([origin, tool, next], [review], next.id)).toBe(false);
    expect(hasApprovalAfterCursor([origin, next], [approval({origin_message_id: next.id})], next.id)).toBe(true);
  });
});
