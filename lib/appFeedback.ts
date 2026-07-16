import { toast } from 'sonner';

interface FeedbackAction {
  label: string;
  onClick: () => void;
}

interface FeedbackOptions {
  description?: string;
  action?: FeedbackAction;
  duration?: number;
}

function externalToastOptions(options: FeedbackOptions = {}) {
  return {
    position: 'top-right' as const,
    description: options.description,
    duration: options.duration,
    action: options.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
  };
}

export const appFeedback = {
  success(message: string, options?: FeedbackOptions) {
    return toast.success(message, externalToastOptions(options));
  },
  error(message: string, options?: FeedbackOptions) {
    return toast.error(message, externalToastOptions({ duration: 8000, ...options }));
  },
  info(message: string, options?: FeedbackOptions) {
    return toast.info(message, externalToastOptions(options));
  },
  warning(message: string, options?: FeedbackOptions) {
    return toast.warning(message, externalToastOptions({ duration: 7000, ...options }));
  },
};
