'use client';

import { Moon, Sun } from 'lucide-react';

import { useOptionalAgencyTheme } from '@/app/providers';
import { cn } from '@/lib/utils';

export default function StandaloneThemeToggle({ className }: { className?: string }) {
  const agencyTheme = useOptionalAgencyTheme();
  if (!agencyTheme) {
    return null;
  }

  const { theme, toggleTheme } = agencyTheme;
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-full border border-(--agency-control-border) bg-(--agency-control-bg) text-(--agency-shell-muted) shadow-(--agency-outline-shadow) outline-none transition-colors hover:text-(--agency-shell-text) focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {isDark ? <Sun className="size-[1.1rem]" /> : <Moon className="size-[1.1rem]" />}
    </button>
  );
}
