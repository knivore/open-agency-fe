'use client';

import { Toaster } from 'sonner';
import { useAgencyTheme } from '@/app/providers';

export default function AppToaster() {
  const { theme } = useAgencyTheme();

  return (
    <Toaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      expand={false}
      visibleToasts={4}
      duration={5000}
      gap={10}
      offset={{ top: 76, right: 20 }}
      mobileOffset={12}
      containerAriaLabel="Open Agency notifications"
      toastOptions={{
        closeButtonAriaLabel: 'Dismiss notification',
        classNames: {
          toast:
            'border-(--agency-shell-border)! bg-(--agency-shell-panel-strong)! text-(--agency-shell-text)! shadow-[0_18px_60px_rgba(15,23,42,0.18)]! backdrop-blur-xl',
          title: 'text-sm! font-semibold! text-(--agency-shell-text)!',
          description: 'text-xs! leading-5! text-(--agency-shell-muted)!',
          actionButton:
            'rounded-md! bg-primary! px-3! py-1.5! text-xs! font-semibold! text-primary-foreground!',
          cancelButton:
            'rounded-md! border! border-(--agency-shell-border)! bg-transparent! px-3! py-1.5! text-xs! font-semibold! text-(--agency-shell-text)!',
          closeButton:
            'border-(--agency-shell-border)! bg-(--agency-shell-panel-strong)! text-(--agency-shell-muted)!',
        },
      }}
    />
  );
}
