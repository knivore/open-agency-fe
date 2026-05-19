import ReactMarkdown from 'react-markdown';

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
        className={`rounded-2xl px-4 py-2 break-words max-w-[70%] text-sm ${
          role === 'user'
            ? 'agency-gradient text-primary-foreground rounded-br-none'
            : role === 'assistant'
              ? 'bg-secondary-400 rounded-bl-none'
              : 'text-gray-800 mx-4'
        } ${isLastMessage ? 'rounded-b-none-!' : ''}`}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
