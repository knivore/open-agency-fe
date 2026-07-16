export const assistantOpenEvent = 'agency:assistant:open';

export function requestAssistantOpen() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(assistantOpenEvent));
}
