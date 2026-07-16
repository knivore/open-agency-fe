'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/library/shadcn/alert';
import { Button } from '@/components/library/shadcn/button';
import { workflowErrorPresentation } from '@/lib/workflows/workflowErrorPresentation';

interface WorkflowOperationErrorProps {
  fallbackTitle: string;
  message: string;
  onRetry?: () => void;
}

export default function WorkflowOperationError({
  fallbackTitle,
  message,
  onRetry,
}: WorkflowOperationErrorProps) {
  const presentation = workflowErrorPresentation(message, fallbackTitle);

  return (
    <Alert variant="destructive" className="py-3">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{presentation.title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <p>{presentation.summary}</p>
        <p className="font-medium">{presentation.guidance}</p>
        <div className="flex flex-wrap items-center gap-2">
          {onRetry ? (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          ) : null}
          <details className="min-w-0">
            <summary className="cursor-pointer rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Technical details
            </summary>
            <pre className="mt-2 max-h-36 max-w-full overflow-auto whitespace-pre-wrap rounded-md bg-background/70 p-3 font-mono text-[0.72rem] leading-5 text-foreground">
              {presentation.technicalDetails}
            </pre>
          </details>
        </div>
      </AlertDescription>
    </Alert>
  );
}
