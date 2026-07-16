import AppState from '@/components/app-shell/AppState';

export function RunsLoadingCard({ title, description }: { title: string; description: string }) {
  return <AppState variant="loading" title={title} description={description} />;
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
    <AppState
      variant="empty"
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
    />
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
    <AppState
      variant="error"
      title={title}
      description={message}
      actionLabel="Retry"
      onAction={onRetry}
      compact
    />
  );
}
