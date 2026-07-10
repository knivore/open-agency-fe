import { Alert, AlertDescription, AlertTitle } from '../library/shadcn/alert';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from 'lucide-react';

export function LoadingCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-32 items-center justify-center text-(--agency-shell-muted)">
          <LoaderCircle className="size-5 animate-spin" aria-label="Loading" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyCard({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted text-(--agency-shell-muted)">
          <Inbox className="size-[1.1rem]" />
        </span>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 text-center">
        <CardDescription>{description}</CardDescription>
        {actionLabel && onAction ? (
          <Button type="button" variant="outline" onClick={onAction}>
            <RefreshCw data-icon="inline-start" />
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ErrorAlert({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{message}</span>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
