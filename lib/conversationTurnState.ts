import type {ApprovalRequest, ConversationMessage} from '@/types/conversations';

export function sortMessages(messages: ConversationMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.id.localeCompare(right.id);
  });
}


export function isTerminalAssistantTurnMessage(message: ConversationMessage) {
  return (
    message.role === 'assistant' ||
    message.message_type === 'approval_request' ||
    message.message_type === 'approval_result' ||
    message.message_type === 'execution_completed'
  );
}

export function hasTerminalAssistantTurnMessageAfterCursor(
  messages: ConversationMessage[],
  cursorMessageId: string
) {
  let seenCursor = false;
  const cursorConversationId = messages.find((message) => message.id === cursorMessageId)?.conversation_id;
  // A server-persisted Stop is enough to release the composer even when the old
  // worker disappeared and cannot write its normal final assistant message.
  // This acknowledges the control fence, not physical termination of side effects.
  for (const message of sortMessages(messages)) {
    const stopRequested = message.role === 'system' && message.message_type === 'system_note' &&
      message.id.startsWith('turn-stop:') &&
      message.conversation_id === cursorConversationId &&
      message.metadata?.assistant_turn_control === 'stop_requested' &&
      message.metadata?.origin_message_id === cursorMessageId &&
      message.metadata?.turn_id === `turn:${cursorMessageId}`;
    const sameConversation = message.conversation_id === cursorConversationId;
    const messageTurnId = message.metadata?.turn_id;
    // New server rows carry durable turn identity. Never let an older turn's
    // late reply/approval complete this one merely because it arrived later.
    // Legacy rows without identity retain timeline-based compatibility.
    const sameTurn = messageTurnId == null || messageTurnId === `turn:${cursorMessageId}`;
    if (seenCursor && sameConversation && ((sameTurn && isTerminalAssistantTurnMessage(message)) || stopRequested)) {
      return true;
    }
    if (message.id === cursorMessageId) {
      seenCursor = true;
    }
  }
  return false;
}


export function hasApprovalAfterCursor(
  messages: ConversationMessage[],
  approvals: ApprovalRequest[],
  cursorMessageId: string
) {
  const ordered = sortMessages(messages);
  const cursor = ordered.find((message) => message.id === cursorMessageId);
  if (!cursor) return false;
  return approvals.some((approval) => {
    if (approval.conversation_id !== cursor.conversation_id) return false;
    const turnId = approval.metadata?.turn_id;
    if (turnId != null) return turnId === `turn:${cursorMessageId}`;
    if (approval.origin_message_id === cursorMessageId) return true;
    const originIndex = ordered.findIndex((message) =>
      message.id === approval.origin_message_id && message.conversation_id === cursor.conversation_id);
    if (originIndex < 0) return false;
    const originTurnId = ordered[originIndex].metadata?.turn_id;
    if (originTurnId != null) return originTurnId === `turn:${cursorMessageId}`;
    // Older approvals may link a tool-call row instead of the user row. Infer
    // only from that known origin, never from approval creation time alone.
    const originUser = ordered.slice(0, originIndex + 1).reverse().find((message) =>
      message.conversation_id === cursor.conversation_id && message.role === 'user');
    return originUser?.id === cursorMessageId;
  });
}
