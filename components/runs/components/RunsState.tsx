import { Alert, AlertDescription, AlertTitle } from '@/components/library/shadcn/alert';
import { Button } from '@/components/library/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function RunsLoadingCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-32 items-center justify-center">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

export function RunsEmptyCard({
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription>{description}</CardDescription>
        {actionLabel && onAction ? (
          <Button type="button" variant="outline" onClick={onAction}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RunsErrorAlert({
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
      <AlertCircle className="h-4 w-4" />
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
