import {
  AssistantMarkdown,
  formatAssistantMarkdownText,
} from '@/components/conversations/AssistantMarkdown';

export default function TextMessage({
  role,
  content,
  isLastMessage,
}: {
  role: string;
  content: string;
  isLastMessage?: boolean;
}) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-2xl px-4 py-2 wrap-break-word max-w-[70%] text-sm ${
          role === 'user'
            ? 'agency-gradient text-primary-foreground rounded-br-none'
            : role === 'assistant'
              ? 'rounded-bl-none border border-(--agency-shell-border) bg-muted text-foreground'
              : 'mx-4 text-(--agency-shell-text)'
        } ${isLastMessage ? 'rounded-b-none-!' : ''}`}
      >
        {/* Keep the original message spacing so plain-text assistant output stays readable. */}
        <div className="whitespace-pre-wrap text-sm leading-6" style={{ tabSize: 8 }}>
          <AssistantMarkdown>{formatAssistantMarkdownText(content)}</AssistantMarkdown>
        </div>
      </div>
    </div>
  );
}
