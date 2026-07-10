import ReactMarkdown, { type Components } from 'react-markdown';

export function formatAssistantMarkdownText(value: string) {
  // Keep the message compact without rewriting authored indentation.
  return value
    .replace(/\\t/g, '\u00A0\u00A0\u00A0\u00A0')
    .replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0')
    .replace(/\n{3,}/g, '\n\n');
}

type RemarkNode = {
  type: string;
  value?: string;
  children?: RemarkNode[];
};

function expandTabNodes(node: RemarkNode, parentType?: string): RemarkNode | RemarkNode[] {
  if (node.type === 'text' && typeof node.value === 'string' && parentType !== 'code') {
    if (!node.value.includes('\t') && !node.value.includes('\\t')) {
      return node;
    }

    const children: RemarkNode[] = [];
    const rawValue = node.value.replace(/\\t/g, '\t');
    rawValue.split('\t').forEach((segment, index, segments) => {
      if (segment.length > 0) {
        children.push({ type: 'text', value: segment });
      }
      if (index < segments.length - 1) {
        children.push({ type: 'text', value: '\u00A0\u00A0\u00A0\u00A0' });
      }
    });

    return children;
  }

  if (!Array.isArray(node.children) || node.children.length === 0) {
    return node;
  }

  return {
    ...node,
    children: node.children.flatMap((child) => {
      const nextNode = expandTabNodes(child, node.type);
      return Array.isArray(nextNode) ? nextNode : [nextNode];
    }),
  };
}

function preserveAssistantTabs() {
  return (tree: RemarkNode) => {
    const transformed = expandTabNodes(tree);
    if (!Array.isArray(transformed)) {
      Object.assign(tree, transformed);
    }
  };
}

const assistantMarkdownComponents: Components = {
  p: ({ children }) => <p className="my-0 leading-6 text-inherit">{children}</p>,
  ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-5 leading-6">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-1.5 flex list-decimal flex-col gap-1.5 pl-5 leading-6">{children}</ol>
  ),
  li: ({ children }) => <li className="my-0 pl-1">{children}</li>,
  h1: ({ children }) => (
    <h3 className="my-0 text-base font-semibold leading-6 tracking-tight text-inherit">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="my-0 text-base font-semibold leading-6 tracking-tight text-inherit">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="my-0 text-sm font-semibold leading-6 tracking-tight text-inherit">{children}</h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 rounded-xl border border-(--agency-shell-border) bg-muted/55 px-3.5 py-2 italic text-inherit">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className="font-medium text-primary-700 underline decoration-primary-300 underline-offset-2 hover:decoration-primary-500"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  code: ({ children, className }) =>
    className ? (
      <code
        className={`${className} block overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-950 p-3 font-mono text-xs leading-6 text-slate-100 shadow-inner shadow-black/10`}
      >
        {children}
      </code>
    ) : (
      <code className="rounded-md border border-(--agency-shell-border) bg-muted px-1.5 py-0.5 font-mono text-[0.92em] text-(--agency-shell-text)">
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre className="my-1.5 overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-0 text-xs leading-6 whitespace-pre-wrap text-slate-100 shadow-inner shadow-black/10">
      {children}
    </pre>
  ),
};

export function AssistantMarkdown({ children }: { children: string }) {
  return (
    <div className="space-y-1 text-[15px] leading-6">
      <ReactMarkdown
        remarkPlugins={[preserveAssistantTabs]}
        components={assistantMarkdownComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
