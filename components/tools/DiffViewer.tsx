'use client';

function lineClassName(line: string) {
  if (line.startsWith('+++') || line.startsWith('---')) {
    return 'text-sky-700';
  }
  if (line.startsWith('+')) {
    return 'bg-emerald-50 text-emerald-800';
  }
  if (line.startsWith('-')) {
    return 'bg-red-50 text-red-800';
  }
  if (line.startsWith('@@')) {
    return 'bg-slate-100 text-slate-700';
  }
  return 'text-neutral-600';
}

export default function DiffViewer({ patch }: { patch?: string | null }) {
  if (!patch) {
    return <p className="text-sm text-neutral-500">No patch returned.</p>;
  }

  return (
    <pre className="max-h-[420px] overflow-auto rounded-2xl border border-neutral-200 bg-white p-4 text-xs leading-6 shadow-inner">
      {patch.split('\n').map((line, index) => (
        <div key={`${index}-${line}`} className={`whitespace-pre-wrap px-2 font-mono ${lineClassName(line)}`}>
          {line || ' '}
        </div>
      ))}
    </pre>
  );
}
