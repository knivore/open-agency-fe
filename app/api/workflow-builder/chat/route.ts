import { createUIMessageStream, createUIMessageStreamResponse, generateId } from 'ai';
import { workflowBuilderApi } from '@/lib/api/backend';

export const maxDuration = 30;

type RequestMessage = {
  role?: string;
  parts?: Array<
    | { type: 'text'; text?: string }
    | { type: string; state?: string; output?: { tasks?: Array<Record<string, unknown>> } }
  >;
};

type ToolTasksPart = {
  type: string;
  state?: string;
  output?: { tasks?: Array<Record<string, unknown>> };
};

function getMessageText(message: RequestMessage) {
  return (message.parts || [])
    .filter((part): part is Extract<NonNullable<RequestMessage['parts']>[number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text || '')
    .join('');
}

function getLatestTasks(messages: RequestMessage[]) {
  const assistantMessages = [...messages].reverse().filter((message) => message.role === 'assistant');
  for (const message of assistantMessages) {
    const toolPart = (message.parts || []).find(
      (part) => part.type === 'tool-createTasks' && part.state === 'output-available'
    ) as ToolTasksPart | undefined;
    if (toolPart?.output?.tasks) {
      return toolPart.output.tasks;
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = (body.messages || []) as RequestMessage[];
    const latestInstruction = getMessageText(messages[messages.length - 1] || {});
    const latestTasks = getLatestTasks(messages);
    const conversationHistory = messages
      .map((message) => `${message.role || 'unknown'}: ${getMessageText(message)}`)
      .filter((line) => line.trim().length > 0)
      .join('\n');

    const response = await workflowBuilderApi.generateDraft({
      draftType: 'tasks',
      conversationHistory,
      latestInstruction,
      latestTasks: latestTasks ? JSON.stringify(latestTasks) : undefined,
    });

    const assistantMessage =
      typeof response.assistant_message === 'string'
        ? response.assistant_message
        : 'I drafted a workflow outline you can review and create.';
    const tasks = Array.isArray(response.tasks) ? response.tasks : [];
    const toolCallId = generateId();
    const textId = generateId();

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'start' });
        writer.write({ type: 'text-start', id: textId });
        writer.write({ type: 'text-delta', id: textId, delta: assistantMessage });
        writer.write({ type: 'text-end', id: textId });
        writer.write({
          type: 'tool-input-available',
          toolCallId,
          toolName: 'createTasks',
          input: {
            latestInstruction,
          },
        });
        writer.write({
          type: 'tool-output-available',
          toolCallId,
          output: {
            tasks,
          },
        });
        writer.write({ type: 'finish' });
      },
    });

    return createUIMessageStreamResponse({
      stream,
    });
  } catch (error) {
    console.error('Error generating workflow builder chat response:', error);
    return new Response('Failed to fetch message stream', { status: 500 });
  }
}
