import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppShell from '@/components/app-shell/AppShell';

const navigation = vi.hoisted(() => ({ pathname: '/runs' }));
const availability = vi.hoisted(() => ({ devices: false, smartHome: false, diagnostics: false }));
const desktopMedia = vi.hoisted(() => ({ matches: false, onChange: null as (() => void) | null }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Dev User' } } }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => ({
    data: queryKey.includes('backendPhysicalDevicesAvailability')
      ? { available: availability.devices }
      : queryKey.includes('backendSmartHomeAvailability')
        ? { available: availability.smartHome }
        : { name: 'Jarvis' },
  }),
}));

vi.mock('@/app/providers', () => ({
  useAgencyTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('@/lib/userPreferences', () => ({
  useAgencyUserPreferences: () => ({
    preferences: {
      showDiagnostics: availability.diagnostics,
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
  beforeEach(() => {
    navigation.pathname = '/runs';
    availability.smartHome = false;
    availability.devices = false;
    availability.diagnostics = false;
    desktopMedia.matches = false;
    desktopMedia.onChange = null;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        get matches() {
          return desktopMedia.matches;
        },
        addEventListener: (_type: string, callback: () => void) => {
          desktopMedia.onChange = callback;
        },
        removeEventListener: vi.fn(),
      }))
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  it('groups destinations and keeps a single current destination for nested routes', () => {
    navigation.pathname = '/integrations/smart-home';
    availability.smartHome = true;
    render(
      <AppShell>
        <h1>Smart Home</h1>
      </AppShell>
    );
    const groups = screen.getByRole('navigation', { name: 'Workspace groups' });
    expect(within(groups).getByRole('link', { name: 'Build' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    const rail = screen.getByRole('navigation', { name: 'Build destinations' });
    expect(within(rail).getByRole('link', { name: 'Smart Home' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(rail).getByRole('link', { name: 'Integrations' })).not.toHaveAttribute(
      'aria-current'
    );
    navigation.pathname = '/runs';
    availability.smartHome = false;
  });

  it('keeps diagnostics opt-in and unavailable device routes out of navigation', () => {
    render(
      <AppShell>
        <h1>Runs</h1>
      </AppShell>
    );
    expect(screen.queryByRole('link', { name: 'Devices' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Diagnostics' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Open Agency navigation' });
    expect(within(drawer).queryByRole('link', { name: 'Smart Home' })).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole('link', { name: 'Physical Devices' })
    ).not.toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Customize Observatory' })).toHaveAttribute(
      'href',
      '/observatory/builder'
    );
    expect(within(drawer).getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });

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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveFocus()
    );
  });

  it('dismisses the modal drawer and focuses content when resizing to desktop', async () => {
    render(
      <AppShell>
        <h1>Runs</h1>
      </AppShell>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Open Agency navigation' })).toBeInTheDocument();
    act(() => {
      desktopMedia.matches = true;
      desktopMedia.onChange?.();
    });
    expect(
      screen.queryByRole('dialog', { name: 'Open Agency navigation' })
    ).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    expect(document.body).not.toHaveAttribute('data-scroll-locked');
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
