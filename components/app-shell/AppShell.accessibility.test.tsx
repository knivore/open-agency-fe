import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppShell from '@/components/app-shell/AppShell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/runs',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Dev User' } } }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { name: 'Jarvis' } }),
}));

vi.mock('@/app/providers', () => ({
  useAgencyTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('@/lib/userPreferences', () => ({
  useAgencyUserPreferences: () => ({
    preferences: {
      showDiagnostics: false,
      assistantLauncherMode: 'dock',
      assistantLauncherIcon: 'bot',
    },
  }),
}));

vi.mock('@/components/assistant/AssistantPageContext', () => ({
  AssistantPageContextProvider: ({ children }: { children: React.ReactNode }) => children,
  useAssistantPageContextMetadata: () => () => ({}),
}));

vi.mock('@/components/conversations/ConversationWorkspace', () => ({
  default: () => <div>Assistant conversation</div>,
}));

vi.mock('@/components/app-shell/BackendHealthIndicator', () => ({
  default: () => <span>Online</span>,
}));

vi.mock('@/components/app-shell/CommandPalette', () => ({
  default: () => <button type="button">Search Open Agency</button>,
}));

vi.mock('@/components/navbar/UserAvatar', () => ({
  default: () => <button type="button">Open user menu</button>,
}));

describe('AppShell accessibility', () => {
  it('provides a keyboard skip target and a labelled focus-trapped mobile navigation dialog', async () => {
    render(
      <AppShell>
        <h1>Runs</h1>
      </AppShell>
    );

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content'
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Open Agency navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation menu' }));
    expect(
      screen.queryByRole('dialog', { name: 'Open Agency navigation' })
    ).not.toBeInTheDocument();
  });

  it('keeps the personalized assistant launcher available outside the assistant page', () => {
    render(
      <AppShell>
        <h1>Runs</h1>
      </AppShell>
    );

    expect(screen.getByRole('button', { name: 'Open Jarvis' })).toHaveAttribute(
      'data-placement',
      'dock'
    );
    expect(screen.getByRole('button', { name: 'Open Jarvis assistant' })).toBeInTheDocument();
  });
});
